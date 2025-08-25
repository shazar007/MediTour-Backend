const InsuranceRequest = require("../../models/Insurance/insuranceRequest");
const InsuranceBooking = require("../../models/Insurance/insuranceBooking");
const { sendchatNotification } = require("../../firebase/service/index.js");
const stripePaymentTransaction = require("../../models/stripeTransactions");
const Notification = require("../../models/notification.js");
const exchangeRateApi = require("../../utils/ExchangeRate")

const insuranceRequestController = {
  async getAllRequests(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const requestsPerPage = 10;
      const insuranceCompanyId = req.user._id;

      // Get the total number of insurance requests (unchanged)
      const totalInsurance = await InsuranceRequest.countDocuments({
        status: "pending",
        insuranceCompanyId,
      });

      // Calculate total pages (unchanged)
      const totalPages = Math.ceil(totalInsurance / requestsPerPage);

      // Calculate skip based on page (unchanged)
      const skip = (page - 1) * requestsPerPage;

      // Fetch insurance requests with pagination
      const insurances = await InsuranceRequest.find({
        insuranceCompanyId,
        status: "pending",
      })
        .populate("userId", "name")
        .sort({ createdAt: -1 }) // Sort by creation date descending
        .skip(skip) // Apply skip based on page
        .limit(requestsPerPage); // Limit results per page

      // Determine previous and next page numbers (unchanged)
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      // Return the response
      return res.status(200).json({
        insurances,
        totalLength: totalInsurance,
        auth: true,
        totalPages,
        previousPage,
        nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },

  async getRequest(req, res, next) {
    try {
      const requestId = req.query.requestId;
      const request = await InsuranceRequest.findById(requestId).populate(
        "insuranceCompanyId insuranceId userId"
      );
      if (!request) {
        return res.status(404).json([]);
      }
      return res.status(200).json({
        request: request,
        auth: true,
      });
    } catch (error) {
      next(error);
    }
  },
  async addRequests(req, res, next) {
    try {
      const { insuranceId, userId, userName, insuranceFor } = req.body;
      const insuranceCompanyId = req.user._id;

      // Create a new insurance request
      const request = new InsuranceRequest({
        insuranceCompanyId,
        insuranceId,
        userId,
        userName,
        insuranceFor,
      });

      // Save the new insurance request to the database
      await request.save();

      // Send a chat notification to the customer
      sendchatNotification(
        customerId,
        {
          title: "MediTour Global",
          message: `Your request added successfully!`,
        },
        "user"
      );

      // Create and save a notification for the customer
      const notification = new Notification({
        senderId: insuranceCompanyId, // Assuming ambulanceId is defined elsewhere
        senderModelType: "Insurance",
        receiverId: customerId, // Assuming customerId is defined elsewhere
        title: "MediTour Global",
        message: "Your request added successfully!",
      });
      await notification.save();

      // Respond with success message and details of the new appointment
      return res.status(200).json({
        auth: true,
        newAppointment: request, // Assuming newAppointment should be request
        message: "Request Added successfully",
      });
    } catch (error) {
      // Pass any errors to the error handling middleware
      return next(error);
    }
  },

  async acceptRequest(req, res, next) {
    try {
      const requestId = req.body.requestId;
      const insuranceFile = req.body.insuranceFile;
      const insuranceCompanyId = req.user._id;
      const request = await InsuranceRequest.findById(requestId);
      if (!request) {
        return res.status(404).json([]);
      }
      if (request.status == "accept") {
        return res.status(200).json({
          auth: false,
          message: "Request already accepted",
        });
      } 
      request.status = "accept";
      request.insuranceFile = insuranceFile;
      const insuranceId = request.insuranceId;
      const cnicFile = request.cnicFile;
      const totalAmount = request.totalAmount;
      const insuranceModelType = request.insuranceModelType;
      const paymentId = request.paymentId;
      const processingFee = request.processingFee;
      const paidByUserAmount = request.paidByUserAmount;
      const gatewayName= request.gatewayName;
      const userId = request.userId;
      // const userName = request.userName;
      // const mrNo = request.mrNo;
      // const phone = request.phone;
      const location = request.location;
      const cnic = request.cnic;
      const insuranceFor = request.insuranceFor;
      await request.save();
      const dollarAmount = await exchangeRateApi(totalAmount)

      // Here we add the isPaidFull field, setting it to true or false based on your logic
      const isPaidFull = paidByUserAmount >= totalAmount; // Assuming payment in full if the paid amount equals or exceeds the total amount

      const newBooking = new InsuranceBooking({
        paymentId,
        processingFee,
        paidByUserAmount,
        insuranceCompanyId,
        insuranceId,
        insuranceModelType,
        userId,
        // userName,
        // mrNo,
        // phone,
        location,
        cnic,
        insuranceFor,
        totalAmount,
        dollarAmount,
        cnicFile,
        insuranceFile,
        gatewayName,
        isPaidFull: true,
      });
      await newBooking.save();
      // Send a chat notification to the customer
      sendchatNotification(
        userId,
        {
          title: "MediTour Global",
          message: `Your insurance request has been accepted!`,
        },
        "user"
      );

      // Create and save a notification for the customer
      const notification = new Notification({
        senderId: insuranceCompanyId, // Assuming ambulanceId is defined elsewhere
        senderModelType: "Insurance",
        receiverModelType: "Insurance",
        receiverId: userId, // Assuming userId is defined elsewhere
        title: "MediTour Global",
        message: `Your insurance request has been accepted!`,
      });
      await notification.save();

      // Respond with success message and details of the new appointment
      return res.status(200).json({
        auth: true,
        newAppointment: request,
        booking: newBooking,
        message: `Your insurance request has been accepted!`,
      });
    } catch (error) {
      // Pass any errors to the error handling middleware
      return next(error);
    }
  },

  async rejectRequest(req, res, next) {
    try {
      const requestId = req.query.requestId;
      const booking = await InsuranceRequest.findById(requestId);
      if (!booking) {
        return res.status(404).json([]);
      }
      await InsuranceRequest.findByIdAndDelete(requestId);
      // Send a chat notification to the customer
      sendchatNotification(
        customerId,
        {
          title: "MediTour Global",
          message: `Your insurance request has been rejected!`,
        },
        "user"
      );

      // Create and save a notification for the customer
      const notification = new Notification({
        senderId: insuranceCompanyId, // Assuming ambulanceId is defined elsewhere
        senderModelType: "Insurance",
        receiverId: customerId, // Assuming customerId is defined elsewhere
        title: "MediTour Global",
        message: `Your insurance request has been rejected!`,
      });
      await notification.save();

      // Respond with success message and details of the new appointment
      return res.status(200).json({
        auth: true,
        newAppointment: request, // Assuming newAppointment should be request
        message: `Your insurance request has been rejected!`,
      });
    } catch (error) {
      // Pass any errors to the error handling middleware
      return next(error);
    }
  },
  async getAcceptedInsuredPersons(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const requestsPerPage = 10;
      const insuranceCompanyId = req.user._id;

      // Get the total number of insurance requests
      const totalInsurance = await InsuranceBooking.countDocuments({
        insuranceCompanyId,
      });

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalInsurance / requestsPerPage);

      // Calculate the number of requests to skip based on the current page
      const skip = (page - 1) * requestsPerPage;

      // Fetch insurance requests, sorted by creation date in descending order
      const insurances = await InsuranceBooking.find({
        insuranceCompanyId,
      })
        .populate("insuranceId userId insuranceCompanyId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(requestsPerPage);

      // Determine previous and next page numbers
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      // Return the response
      return res.status(200).json({
        insurances: insurances,
        totalLength: totalInsurance,
        auth: true,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
  async getInsuredPerson(req, res, next) {
    try {
      const insuranceBookingId = req.query.insuranceBookingId;
      const insured = await InsuranceBooking.findById(
        insuranceBookingId
      ).populate("userId insuranceId insuranceCompanyId");

      if (!insured) {
        return res.status(404).json([]);
      }
      return res.status(200).json({ insured });
    } catch (error) {
      return next(error);
    }
  },

  async insurancePayment(req, res, next) {
    try {
      const insuranceBookingId = req.query.insuranceBookingId;
      const { paymentId, paidByUserAmount } = req.body;
      const booking = await InsuranceBooking.findById(insuranceBookingId);

      if (!booking) {
        return res.status(404).json([]);
      }
      booking.paymentId = paymentId;
      booking.paidByUserAmount = paidByUserAmount;
      booking.isPaidFull = true;
      await booking.save();
      const stripePaymentToRegister = new stripePaymentTransaction({
        paymentId,
        paidByUserAmount,
        isPaidFull: true,
      });
      stripeController = await stripePaymentToRegister.save();
      return res
        .status(200)
        .json({ booking, message: "Payment Added Successfully" });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = insuranceRequestController;
