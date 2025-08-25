const express = require("express");
const { sendchatNotification } = require("../../firebase/service");
const AmbRequest = require("../../models/Ambulance/ambRequest");
const BidRequest = require("../../models/Ambulance/bid");
const UserRequest = require("../../models/Ambulance/ambRequest");
const Booking = require("../../models/Ambulance/booking");
const Notification = require("../../models/notification");
const ambulance = require("../../models/Ambulance/ambulanceCompany.js");
const stripePaymentTransaction = require("../../models/stripeTransactions");
const Admin = require("../../models/Admin/Admin");
const exchangeRateApi = require("../../utils/ExchangeRate.js");

async function getNextOrderNo() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestOrder = await AmbRequest.findOne({}).sort({ createdAt: -1 });

    let nextOrderIdNumber = 1;
    if (latestRequest && latestRequest.orderId) {
      // Extract the numeric part of the orderId and increment it
      const currentOrderIdNumber = parseInt(latestRequest.orderId.substring(3));
      nextOrderIdNumber = currentOrderIdNumber + 1;
    }

    // Generate the next orderId
    const nextOrderId = `AMB${nextOrderIdNumber.toString().padStart(4, "0")}`;
    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}

const ambulanceController = {
  async addAmbulanceRequest(req, res, next) {
    try {
      const userId = req.user._id;
      const { pickUp, dropOff } = req.body;

      if (!pickUp || !dropOff) {
        const error = new Error("Missing Parameters!");
        error.status = 400;
        return next(error);
      }

      // Check if an ambulance request already exists with the same details
      const existingRequest = await AmbRequest.findOne({
        userId,
        pickUp,
        dropOff,
      });

      if (existingRequest) {
        return res.status(400).json({
          success: false,
          message: "You have already requested an ambulance for these details.",
        });
      }

      // Create a new ambulance request instance
      const ambulanceRequest = new AmbRequest({
        userId,
        pickUp,
        dropOff,
      });

      // Save the ambulance request to the database
      await ambulanceRequest.save();

      if (ambulanceRequest) {
        // Retrieve all ambulance companies
        const ambulances = await ambulance.find({});

        // Prepare notification data
        const notifications = ambulances.map((ambulance) => ({
          senderId: userId,
          senderModelType: "Users",
          receiverId: ambulance._id,
          receiverModelType: "Ambulance Company",
          title: "MediTour Global",
          message: "You have a new booking request",
          createdAt: new Date(), // Set the creation date for notifications
        }));

        // Insert notifications into the database in bulk for efficiency
        await Notification.insertMany(notifications);

        // Send chat notifications to all ambulance companies asynchronously
        ambulances.forEach((ambulance) => {
          sendchatNotification(
            ambulance._id,
            {
              title: "MediTour Global",
              message: "You have a new booking request.",
            },
            "Ambulance Company"
          );
        });
      }

      // Return the created booking request in the response
      res.status(201).json({
        success: true,
        booking: ambulanceRequest,
      });
    } catch (error) {
      // Pass any errors to the error handling middleware
      return next(error);
    }
  },
  async getUserRequests(req, res, next) {
    try {
      const userId = req.user._id;
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter, default to 1
      const limit = parseInt(req.query.limit) || 10; // Get the limit from the query parameter, default to 10 requests per page

      // Get the total number of user requests
      const totalRequests = await UserRequest.countDocuments({
        userId,
        status: { $nin: ["accept"] },
      });

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalRequests / limit);

      // Calculate the number of requests to skip based on the current page
      const skip = (page - 1) * limit;

      // Fetch user requests with pagination
      const userRequests = await UserRequest.find({
        userId,
        status: { $nin: ["accept"] },
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      // Determine previous and next page numbers
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Return the user requests with pagination metadata
      res.json({
        auth: true,
        userRequests,
        currentPage: page,
        totalPages,
        previousPage,
        nextPage,
        totalRequests,
      });
    } catch (error) {
      next(error);
    }
  },

  async getBidRequests(req, res, next) {
    try {
      const requestId = req.query.requestId;
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = parseInt(req.query.limit) || 10; // Default to 10 bids per page

      // Get the total number of bids for the given request
      const totalBids = await BidRequest.countDocuments({ requestId });

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalBids / requestsPerPage);

      // Calculate the number of bids to skip based on the current page
      const skip = (page - 1) * requestsPerPage;

      // Fetch bids for the given requestId with pagination and populate ambulance details
      let bids = await BidRequest.find({ requestId })
        .populate({ path: "ambulanceId", select: "name logo blocked" }) // Include `blocked` field
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(requestsPerPage);

      // Filter out bids where ambulanceId.blocked is true
      bids = bids.filter((bid) => bid.ambulanceId && !bid.ambulanceId.blocked);

      // Recalculate the totalBids after filtering
      const filteredTotalBids = bids.length;

      // Determine previous and next page numbers
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Return the bid requests with pagination metadata
      res.json({
        auth: true,
        bidRequests: bids,
        totalBids: filteredTotalBids, // Use filtered count
        currentPage: page,
        totalPages: totalPages,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      next(error);
    }
  },

  async rejectBidRequest(req, res, next) {
    try {
      const requestId = req.query.requestId;
      const bid = await BidRequest.findById(requestId);
      if (!bid) {
        return res.status(404).json([]); // Send empty response
      }
      bid.status = "rejected";
      await bid.save();
      res.json({
        auth: true,
        message: "Bid Request has been rejected!",
      });
    } catch (error) {
      next(error);
    }
  },
  async deleteUserRequest(req, res, next) {
    try {
      const requestId = req.query.requestId;
      const userRequest = await UserRequest.findByIdAndDelete(requestId);
      if (!userRequest) {
        return res.status(404).json([]); // Send empty response
      }
      res.json({
        auth: true,
        message: "Request has been deleted!",
      });
    } catch (error) {
      next(error);
    }
  },

  async acceptBidRequest(req, res, next) {
    try {
      const bidRequestId = req.query.bidRequestId;
      const userId = req.user._id;
      const bid = await BidRequest.findById(bidRequestId);
      if (!bid) {
        return res.status(404).json([]); // Send empty response
      }

      const ambulanceId = bid.ambulanceId;
      const requestId = bid.requestId;

      const {
        paymentId,
        paidByUserAmount,
        name,
        email,
        age,
        address,
        phone,
        processingFee,
        gatewayName,
      } = req.body;

      const userRequest = await UserRequest.findById(requestId);

      userRequest.status = "accept";
      await userRequest.save();
      const totalAmount = bid.price;
      const isPaidFull = true;

      let paymentIdArray = [];
      bid.status = "booked";
      await bid.save();

      if (gatewayName === "stripe") {
        paymentIdArray.push({
          id: paymentId,
          status: "completed",
          createdAt: new Date(),
        });
      } else if (gatewayName === "blinq") {
        paymentIdArray.push({
          id: paymentId,
          status: "pending",
          createdAt: new Date(),
        });
      }
      const dollarAmount = await exchangeRateApi(totalAmount);

      const saveBooking = new Booking({
        paymentId: paymentIdArray,
        ambulanceId,
        userId,
        name,
        email,
        age,
        address,
        requestId,
        bidRequestId,
        phone,
        isPaidFull,
        totalAmount,
        dollarAmount,
        ...(paidByUserAmount && { paidByUserAmount }),
        ...(processingFee && { processingFee }),
        gatewayName,
      });
      await saveBooking.save();
      if (gatewayName !== "blinq") {
        const stripePaymentToRegister = new stripePaymentTransaction({
          id: saveBooking._id,
          idModelType: "Ambulance Booking",
          paymentId,
          gatewayName,
          paidByUserAmount,
          isPaidFull,
        });
        stripeController = await stripePaymentToRegister.save();

        sendchatNotification(
          ambulanceId,
          {
            title: "MediTour Global",
            message: `Your bid request has been accepted by ${name}!`,
          },
          "Ambulance Company"
        );
        const notification = new Notification({
          senderId: userId,
          senderModelType: "Users",
          receiverId: ambulanceId,
          receiverModelType: "Ambulance Company",
          title: "MediTour Global",
          message: `Your bid request has been accepted by ${name}!`,
        });
        await notification.save();
        // Fetch all admins
        const admins = await Admin.find(); // Adjust this to match your admin retrieval logic

        // Create notifications for each admin
        const adminNotifications = admins.map((admin) => ({
          senderId: userId,
          senderModelType: "Users",
          receiverId: admin._id,
          receiverModelType: "Admin",
          title: "MediTour Global",
          message: `Payment of ${paidByUserAmount} received from ${name} for ${bid.ambulanceName}.`,
        }));

        // Insert notifications into the database
        await Notification.insertMany(adminNotifications);

        // Send chat notifications to all admins asynchronously
        admins.forEach((admin) => {
          sendchatNotification(
            admin._id,
            {
              title: "MediTour Global",
              message: `Payment of ${paidByUserAmount} received from ${name} for ${bid.ambulanceName}.`,
            },
            "admin"
          );
        });
      }

      res.json({
        auth: true,
        saveBooking,
        message: "Bid request has been accepted successfully!",
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = ambulanceController;
