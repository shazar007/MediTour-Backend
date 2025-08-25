const mongoose = require("mongoose");
const AcceptedRequest = require("../../models/Rent A Car/acceptedRequests");
const vehicleRequest = require("../../models/Rent A Car/vehicleRequest");
const ObjectId = mongoose.Types.ObjectId;
const Vehicle = require("../../models/Rent A Car/vehicle");
const User = require("../../models/User/user");
const { sendchatNotification } = require("../../firebase/service/index.js");
const Notification = require("../../models/notification.js");
const stripePaymentTransaction = require("../../models/stripeTransactions");
const moment = require("moment");

// const { clearGlobalAppDefaultCred } = require("firebase-admin/lib/app/credential-factory");

async function isVehicleAvailable(vehicleId, startTime, endTime) {
  const existingReservations = await AcceptedRequest.find({
    vehicleId,
    $or: [
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } }, // Overlapping reservations
      { startTime: { $gte: startTime, $lte: endTime } }, // Reservation starts within the requested range
      { endTime: { $gte: startTime, $lte: endTime } }, // Reservation ends within the requested range
    ],
  });

  // If there are no overlapping reservations, the vehicle is available
  return existingReservations.length === 0;
}

const vehicleRequestController = {
  async getAllRequests(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = 10;
      const rentACarId = req.user._id;

      // Get the total number of pending requests for the rent-a-car service
      const totalVehicle = await AcceptedRequest.countDocuments({
        rentACarId,
        status: { $in: ["pending", "OnRoute"] },
      });

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalVehicle / requestsPerPage);

      // Calculate the number of requests to skip based on the current page
      const skip = (page - 1) * requestsPerPage;

      // Retrieve pending requests with pagination and populate vehicleId
      const requests = await AcceptedRequest.find({
        rentACarId,
        status: { $in: ["pending", "OnRoute"] },
      })
        .skip(skip)
        .limit(requestsPerPage)
        .populate("userId")
        .populate(
          "vehicleId",
          "vehicleName vehicleColour vehicleRegisterationNo"
        )
        .sort({ createdAt: -1 });

      // Add the "time ago" field to each request
      const requestsWithTimeAgo = requests.map((request) => {
        const timeAgo = moment(request.createdAt).fromNow();
        return {
          ...request.toObject(),
          timeAgo: timeAgo,
        };
      });

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        requests: requestsWithTimeAgo,
        requestLength: requests.length,
        auth: true,
        totalPages,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },

  async getRequest(req, res, next) {
    try {
      const requestId = req.query.requestId;
      const request = await AcceptedRequest.findById(requestId)
        .populate("userId")
        .populate("vehicleId");

      return res.status(200).json({ request });
    } catch (error) {
      return next(error);
    }
  },

  async getCustomersList(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const customersPerPage = 10;
      const rentACarId = req.user._id;

      const skip = (page - 1) * customersPerPage; // Calculate the number of customers to skip based on the current page

      // Find all accepted requests with status "pending" or "OnRoute"
      const acceptedRequestsList = await AcceptedRequest.find({
        rentACarId,
        status: { $in: ["pending", "OnRoute"] },
      })
        .skip(skip)
        .limit(customersPerPage)
        .populate("userId")
        .populate(
          "vehicleId",
          "vehicleName vehicleColour vehicleRegisterationNo"
        )
        .sort({ createdAt: -1 }); // Sort requests by creation date in descending order

      // Total count of requests with status "pending" or "OnRoute"
      const totalRequestsCount = await AcceptedRequest.countDocuments({
        rentACarId,
        status: { $in: ["pending", "OnRoute"] },
      });

      const totalPages = Math.ceil(totalRequestsCount / customersPerPage); // Calculate the total number of pages

      const customersSet = new Set(
        acceptedRequestsList.map((request) => request.userId._id)
      );
      const uniqueCustomers = Array.from(customersSet);

      // Find customers based on their unique IDs
      const customers = await User.find({ _id: { $in: uniqueCustomers } });

      const customersLength = customers.length;
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        acceptedRequestsList: acceptedRequestsList,
        totalRequestsCount,
        customersLength,
        auth: true,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
  async changeOrderStatus(req, res, next) {
    try {
      const newStatus = req.body.status;
      const rentACarId = req.user._id;

      if (!newStatus) {
        return res.status(404).json([]);
      }

      const acceptedRequestId = req.query.acceptedRequestId;
      const order = await AcceptedRequest.findById(acceptedRequestId);

      if (!order) {
        return res.status(404).json([]);
      }

      const result = await AcceptedRequest.findOneAndUpdate(
        { _id: ObjectId(acceptedRequestId) },
        { $set: { status: newStatus } },
        { returnDocument: "after" }
      );

      if (!result) {
        return res.status(404).json([]);
      }

      const userId = order.userId;

      if (newStatus === "completed") {
        sendchatNotification(
          userId,
          {
            title: "MediTour Global",
            message: "Your order has been completed!",
          },
          "user"
        );

        const notification = new Notification({
          senderId: rentACarId,
          senderModelType: "Rent A Car",
          receiverId: userId,
          receiverModelType: "Users",
          title: "MediTour Global",
          message: "Your order has been completed!",
        });
        await notification.save();
      } else if (newStatus === "OnRoute") {
        sendchatNotification(
          userId,
          {
            title: "MediTour Global",
            message: "Your order status changed to OnRoute",
          },
          "user"
        );

        const notification = new Notification({
          senderId: rentACarId,
          senderModelType: "Rent A Car",
          receiverId: userId,
          receiverModelType: "Users",
          title: "MediTour Global",
          message: "Your order status changed to OnRoute",
        });
        await notification.save();
      } else if (newStatus === "pending") {
        sendchatNotification(
          userId,
          {
            title: "MediTour Global",
            message: "Your order status changed to pending",
          },
          "user"
        );

        const notification = new Notification({
          senderId: rentACarId,
          senderModelType: "Rent A Car",
          receiverId: userId,
          receiverModelType: "Users",
          title: "MediTour Global",
          message: "Your order status changed to pending",
        });
        await notification.save();
      }

      res.status(200).json({
        result,
        auth: true,
        message: "Status changed successfully",
      });
    } catch (error) {
      return next(error);
    }
  },

  async getCompletedCustomers(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const customersPerPage = 10;
      const rentACarId = req.user._id;

      if (page < 1) {
        return res.status(400).json({ message: "Invalid page number" });
      }

      const skip = (page - 1) * customersPerPage; // Calculate the number of completed requests to skip based on the current page

      // Find all completed requests for the given rentACarId
      const completedRequestsList = await AcceptedRequest.find({
        rentACarId,
        status: "completed",
      })
        .populate("userId")
        .populate("vehicleId")
        .skip(skip)
        .limit(customersPerPage) // Limit the number of completed requests per page
        .sort({ updatedAt: -1 });

      // Total count of requests with status "completed"
      const totalCustomersCount = await AcceptedRequest.countDocuments({
        rentACarId,
        status: "completed",
      });

      const totalPages = Math.ceil(totalCustomersCount / customersPerPage); // Calculate the total number of pages
      const customersSet = new Set(
        completedRequestsList.map(
          (request) => request.userId && request.userId._id
        )
      );
      const uniqueCustomers = Array.from(customersSet);

      // Find customers based on their unique IDs
      const customers = await User.find({ _id: { $in: uniqueCustomers } });

      const customersLength = customers.length;
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        completedRequestsList: completedRequestsList,
        totalCustomersCount,
        customersLength,
        auth: true,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
  async getCustomerDetails(req, res, next) {
    try {
      const acceptedRequestId = req.query.acceptedRequestId;
      const customerDetail = await AcceptedRequest.findById(acceptedRequestId)
        .populate("vehicleId")
        .populate("userId");

      if (!customerDetail) {
        return res.status(404).json([]);
      }
      return res.status(200).json({ customerDetail });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = vehicleRequestController;
