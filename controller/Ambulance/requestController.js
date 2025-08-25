const express = require("express");
const app = express();
const Joi = require("joi");
const UserRequest = require("../../models/Ambulance/ambRequest.js");
const AmbulanceCompany = require("../../models/Ambulance/ambulanceCompany.js");
const BidRequest = require("../../models/Ambulance/bid.js");
const Booking = require("../../models/Ambulance/booking.js");
const { sendchatNotification } = require("../../firebase/service/index.js");
const Notification = require("../../models/notification.js");

const agencyFlightController = {
  async getAllRequests(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = 10;
      const ambulanceId = req.user._id;
      const ambulance = await AmbulanceCompany.findById(ambulanceId);
      if (ambulance.activationRequest=="inProgress") {
        const error = {
          status: 403,
          message: "Your account will be activated within the next hour",
        };
        return next(error);
      } else if(ambulance.activationRequest=="pending") {
        const error = {
          status: 403,
          message: "Please pay the activation fee to activate your account",
        };
        return next(error);
      }

      // Retrieve all user requests with pagination
      const totalRequests = await UserRequest.countDocuments({
        status: "pending",
      });
      const totalPages = Math.ceil(totalRequests / requestsPerPage);
      const skip = (page - 1) * requestsPerPage;

      // Fetch user requests and populate user details
      let userRequests = await UserRequest.find({ status: "pending" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(requestsPerPage)
        .populate({
          path: "userId",
          select: "name phone",
        });

      // Prepare an array to hold modified user request data for response
      let userRequestsResponse = [];

      // Check if there are bid requests from the logged-in ambulance for each user request
      for (let i = 0; i < userRequests.length; i++) {
        const userRequest = userRequests[i];

        // Check if there's a bid request from the current ambulance
        const bidRequest = await BidRequest.findOne({
          ambulanceId: ambulanceId,
          requestId: userRequest._id,
        });

        // Determine if a bid request has been sent
        const bidSent = !!bidRequest;

        // Construct modified user request data for response
        let modifiedUserRequest = {
          _id: userRequest._id,
          pickUp: userRequest.pickUp,
          dropOff: userRequest.dropOff,
          // Include other fields you want to send in response
          userId: userRequest.userId,
          createdAt: userRequest.createdAt,
          status: userRequest.status,
          // Add a property indicating whether a bid request has been sent
          bidSent: bidSent,
        };

        userRequestsResponse.push(modifiedUserRequest);
      }
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      // Respond with the modified user requests list including bidSent information
      res.json({
        auth: true,
        userRequests: userRequestsResponse,
        totalRequests: totalRequests,
        totalPages,
        previousPage,
        nextPage,
      });
    } catch (error) {
      next(error);
    }
  },
  async getRequest(req, res, next) {
    try {
      const ambulanceId = req.user._id;
      const requestId = req.query.requestId;
      const userRequest = await UserRequest.findById(requestId).populate(
        "userId"
      );
      const bid = await BidRequest.findOne({ requestId, ambulanceId });
      res.json({
        auth: true,
        userRequest: userRequest,
        bid: bid,
      });
    } catch (error) {
      next(error);
    }
  },

  async addBidRequest(req, res, next) {
    try {
      const ambulanceId = req.user._id;
      const bidSchema = Joi.object({
        requestId: Joi.string().required(),
        ambulanceName: Joi.string().required(),
        ambulanceNo: Joi.string().required(),
        price: Joi.number().required(),
      });

      const { error } = bidSchema.validate(req.body);

      if (error) {
        return next(error);
      }
      const { requestId, ambulanceName, ambulanceNo, price } = req.body;
      const alreadyBid = await BidRequest.findOne({ ambulanceId, requestId });
      if (alreadyBid) {
        const error = {
          status: 409,
          message: "You have already bid against the following request!",
        };
        return next(error);
      }
      const userRequest = await UserRequest.findById(requestId);
      const userId = userRequest.userId;
      let bid;
      try {
        const bidToRegister = new BidRequest({
          requestId,
          ambulanceId,
          ambulanceName,
          ambulanceNo,
          price,
        });

        bid = await bidToRegister.save();
        sendchatNotification(
          userId,
          {
            title: "MediTour Global",
            message: `You have received a new bid request!`,
          },
          "user"
        );
        const notification = new Notification({
          senderId: ambulanceId,
          senderModelType: "Ambulance Company",
          receiverId: userId,
          receiverModelType: "Users",
          title: "MediTour Global",
          message: "You have received a new bid request!",
        });
        await notification.save();
      } catch (error) {
        return next(error);
      }

      return res.status(201).json({ bidRequest: bid, auth: true });
    } catch (error) {
      next(error);
    }
  },

  async getAmbulanceBookings(req, res, next) {
    try {
      const ambulanceId = req.user._id;
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const bookingsPerPage = 10;

      const totalBookings = await Booking.countDocuments({ ambulanceId });
      const totalPages = Math.ceil(totalBookings / bookingsPerPage);

      const skip = (page - 1) * bookingsPerPage;
      const bookings = await Booking.find({ ambulanceId })
        .populate("ambulanceId bidRequestId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(bookingsPerPage);

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;
      res.json({
        auth: true,
        bookings: bookings,
        totalBookings: totalBookings,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      next(error);
    }
  },

  async changeBookingStatus(req, res, next) {
    try {
      const bookingId = req.query.bookingId;
      const newStatus = req.query.status;
      const booking = await Booking.findById(bookingId);

      if (!booking) {
        return res.status(404).json([]);
      }

      booking.status = newStatus;
      await booking.save();

      if (newStatus === "completed") {
        sendchatNotification(
          booking.userId,
          {
            title: "MediTour Global",
            message: "Your booking for an ambulance has been completed!",
          },
          "user"
        );

        const notification = new Notification({
          senderId: booking.ambulanceId,
          senderModelType: "Ambulance Company",
          receiverId: booking.userId,
          receiverModelType: "Users",
          title: "MediTour Global",
          message: "Your booking for an ambulance has been completed!",
        });
        await notification.save();
      } else if (newStatus === "in-progress") {
        sendchatNotification(
          booking.userId,
          {
            title: "MediTour Global",
            message:
              'Your booking status for an ambulance changed to "in-progress"',
          },
          "user"
        );

        const notification = new Notification({
          senderId: booking.ambulanceId,
          senderModelType: "Ambulance Company",
          receiverId: booking.userId,
          receiverModelType: "Users",
          title: "MediTour Global",
          message:
            'Your booking status for an ambulance changed to "in-progress"',
        });
        await notification.save();
      }

      return res.status(200).json({
        auth: true,
        message: "Status changed successfully",
        booking,
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = agencyFlightController;
