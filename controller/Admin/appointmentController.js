const Admin = require("../../models/Admin/Admin.js");
const AppointmentRequest = require("../../models/All Doctors Models/request.js");
const Appointment = require("../../models/All Doctors Models/appointment.js");
const MedicineRequest = require("../../models/Pharmacy/medicineRequest.js");
const BidRequest = require("../../models/Pharmacy/bid.js");
const Booking = require("../../models/Pharmacy/booking.js");
const ParamedicRequest = require("../../models/Paramedic/request.js");
const Paramedic = require("../../models/Doctor/doctors.js");
const Doctor = require("../../models/Doctor/doctors.js");
const { sendchatNotification } = require("../../firebase/service/index.js");
const Notification = require("../../models/notification.js");

async function getNextAppointmentNo() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestVendor = await Booking.findOne({}).sort({ createdAt: -1 });

    let nextVendorId = 1;
    if (latestVendor && latestVendor.orderId) {
      // Extract the numeric part of the orderId and increment it
      const currentVendorId = parseInt(latestVendor.orderId.substring(3));
      nextVendorId = currentVendorId + 1;
    }

    // Generate the next orderId
    const nextOrderId = `ORD${nextVendorId.toString().padStart(4, "0")}`;

    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}
const adminAuthController = {
  async getAppointments(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = 10;
      const mrNo = req.query.mrNo;
      const vendorId = req.query.vendorId;
      const paidToVendor = req.query.paidToVendor;
      const appointmentType = req.query.appointmentType;
      const { startTime, endTime } = req.query;

      const query = {status: { $ne: "cancelled" }};
      if (appointmentType) {
        if (appointmentType === "hospital") {
          query.hospital = { $exists: true };
        } else if (appointmentType === "doctor") {
          query.hospital = { $exists: false }
          query.docCompanyId = { $exists: false }
        } else if (appointmentType === "company") {
          query.isCompany = true
        }
      }
      if (startTime && endTime) {
        query.createdAt = {
          $gte: new Date(startTime),
          $lte: new Date(endTime),
        };
      }
      if (paidToVendor && paidToVendor == "true") {
        query.paidToVendor = true;
      } else if (paidToVendor && paidToVendor == "false") {
        query.paidToVendor = false;
      }

      let totalRequests = await Appointment.countDocuments(query);

      const totalPages = Math.ceil(totalRequests / requestsPerPage);

      const skip = (page - 1) * requestsPerPage;

      let allRequests = await Appointment.find(query)
        .sort({ createdAt: -1 })
        .populate("patientId doctorId hospital ePrescription history docCompanyId")
        .skip(skip)
        .limit(requestsPerPage)
        .exec();

      // Filter appointment requests where mrNo matches
      if (mrNo) {
        const filteredRequests = allRequests.filter((appointment) => {
          return appointment.patientId.mrNo === mrNo;
        });
        allRequests = filteredRequests;
        totalRequests = filteredRequests.length;
      }
      let filteredRequests;
      if (vendorId) {
        if(appointmentType == "company"){
        filteredRequests = allRequests.filter((appointment) => {
          return appointment.docCompanyId._id === vendorId;
        });
        allRequests = filteredRequests;
        totalRequests = filteredRequests.length;
      }
        filteredRequests = allRequests.filter((appointment) => {
          return appointment.doctorId.vendorId === vendorId;
        });
        allRequests = filteredRequests;
        totalRequests = filteredRequests.length;
      }
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;


      return res.status(200).json({
        Appointments: allRequests,
        appointmentsLength: totalRequests,
        previousPage,
        nextPage,
        totalPages,
        auth: true,
      });
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },

  async getAppointment(req, res, next) {
    try {
      const requestId = req.query.id;
      const request = await Appointment.findById(requestId).populate(
        "patientId doctorId history ePrescription"
      );
      if (!request) {
        return res.status(200).json({
          auth: false,
          message: "Request not found!",
        });
      }
      return res.status(200).json({
        request: request,
        auth: true,
      });
    } catch (error) {
      next(error);
    }
  },

  async getMedicineRequests(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = 10;

      const totalRequests = await MedicineRequest.countDocuments({
        status: "pending",
      }); // Get the total number of requests for the user

      const totalPages = Math.ceil(totalRequests / requestsPerPage); // Calculate the total number of pages

      const skip = (page - 1) * requestsPerPage; // Calculate the number of requests to skip based on the current page
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      const allRequests = await MedicineRequest.find({ status: "pending" })
        .sort({ createdAt: -1 }) // Sort by createdAt field in descending order
        .populate("medicineIds.id patientId").populate({
          path: "bidIds", // Populate bidIds array
          model: "PharmacyBid", // Reference to the Bid Request model
        })
        .skip(skip)
        .limit(requestsPerPage)
        .lean(); // Convert documents to plain JavaScript objects

      const requestsWithBidCount = await Promise.all(
        allRequests.map(async (request) => {
          const bidCount = await BidRequest.countDocuments({
            requestId: request._id,
          }); // Await the bidCount query
          return {
            ...request,
            bidCount,
          };
        })
      );

      return res.status(200).json({
        medicineRequests: requestsWithBidCount,
        requestsLength: totalRequests,
        previousPage: previousPage,
        totalPages: totalPages,
        nextPage: nextPage,
        auth: true,
      });
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },
  async getBids(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = 10;
      const requestId = req.query.requestId;

      const totalBids = await BidRequest.countDocuments({ requestId }); // Get the total number of requests for the user

      const totalPages = Math.ceil(totalBids / requestsPerPage); // Calculate the total number of pages

      const skip = (page - 1) * requestsPerPage; // Calculate the number of requests to skip based on the current page
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      const allBids = await BidRequest.find({ requestId })
        .sort({ createdAt: -1 }) // Sort by createdAt field in descending order
        .populate("availableMedIds pharmacyId")
        .skip(skip)
        .limit(requestsPerPage);

      return res.status(200).json({
        allBids: allBids,
        totalBids: totalBids,
        previousPage: previousPage,
        totalPages: totalPages,
        nextPage: nextPage,
        auth: true,
      });
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },
  async acceptBidRequest(req, res, next) {
    try {
      const adminId = req.user._id;
      const bidRequestId = req.query.bidRequestId;
      const bid = await BidRequest.findById(bidRequestId);
      if (!bid) {
        return res.status(404).json([]);
      }

      const pharmacyId = bid.pharmacyId;
      const requestId = bid.requestId;
      const medRequest = await MedicineRequest.findById(requestId);
      const userId = medRequest.patientId;
      const paymentId = medRequest.paymentId;
      const paidByUserAmount = medRequest.paidByUserAmount;
      const amount = medRequest.amount;
      const processingFee = medRequest.processingFee;
      const addedAt = new Date()
      medRequest.addedAt = addedAt;

      // medRequest.status = "completed";
      medRequest.pharmacyId = pharmacyId
      await medRequest.save();
      const orderId = await getNextAppointmentNo();
      // const saveBooking = new Booking({
      //   orderId,
      //   requestId,
      //   bidRequestId,
      //   paymentId,
      //   paidByUserAmount,
      //   pharmacyId,
      //   userId,
      //   isPaidFull: true,
      //   amount,
      //   processingFee,
      // });
      // await saveBooking.save();
      bid.status = "completed";
      await bid.save();

      sendchatNotification(
        pharmacyId,
        {
          title: "MediTour Global",
          message: `Your bid request has been accepted!`,
        },
        "pharmacy"
      );
      const notification = new Notification({
        senderId: adminId,
        senderModelType: "Admin",
        receiverId: pharmacyId,
        receiverModelType: "Pharmacy",
        title: "MediTour Global",
        message: `Your bid request has been accepted!`,
      });
      await notification.save();

      sendchatNotification(
        userId,
        {
          title: "MediTour Global",
          message: `Your medicine request has been accepted!`,
        },
        "user"
      );
      const notification1 = new Notification({
        senderId: adminId,
        senderModelType: "Admin",
        receiverId: userId,
        receiverModelType: "Users",
        title: "MediTour Global",
        message: `Your medicine request has been accepted!`,
      });
      await notification1.save();

      res.json({
        auth: true,
        message: "Bid request has been accepted successfully!",
      });
    } catch (error) {
      next(error);
    }
  },

  async changeStatus(req, res, next) {
    try {
      const requestId = req.query.requestId;
      const status = req.body.status;
      const medRequest = await MedicineRequest.findById(requestId);
      medRequest.status = status;
      await medRequest.save();
      res.json({
        auth: true,
        message: `Order status changed to ${status}`,
      });
    } catch (error) {
      next(error);
    }
  },

  async rejectRequest(req, res, next) {
    try {
      const bidRequestId = req.query.bidRequestId;
      const booking = await BidRequest.findById(bidRequestId);
      if (!booking) {
        return res.status(404).json([]);
      }
      await BidRequest.findByIdAndDelete(bidRequestId);
      return res.status(200).json({
        auth: true,
        message: "Request rejected successfully",
      });
    } catch (error) {
      return next(error);
    }
  },

  //...................paramedic......................//
  async getParamedicRequests(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = 10;
      const status = req.query.status;

      const totalRequests = await ParamedicRequest.countDocuments({
        status,
      });

      const totalPages = Math.ceil(totalRequests / requestsPerPage);

      const skip = (page - 1) * requestsPerPage;
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      const allRequests = await ParamedicRequest.find({ status })
        .sort({ createdAt: -1 })
        .populate({
          path: "userId",
          select: "name email gender mrNo phone dateOfBirth",
        })
        .populate("paramedicId")
        .skip(skip)
        .limit(requestsPerPage);

      return res.status(200).json({
        paramedicRequests: allRequests,
        requestsLength: allRequests.length,
        previousPage: previousPage,
        totalPages: totalPages,
        nextPage: nextPage,
        auth: true,
      });
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },

  async acceptParamedicRequest(req, res, next) {
    try {
      const adminId = req.user._id;
      const requestId = req.query.requestId;
      const request = await ParamedicRequest.findById(requestId);
      const userId = request.userId;
      let { appointmentDateAndTime, paramedicId } = req.body;
      if (!request) {
        return res.status(404).json([]);
      }
      appointmentDateAndTime = new Date(appointmentDateAndTime);
      if (appointmentDateAndTime < Date.now()) {
        const error = new Error("Appointment time cannot be in the past!");
        error.status = 400;
        return next(error);
      }
      request.appointmentDateAndTime = appointmentDateAndTime;
      request.paramedicId = paramedicId;

      request.status = "accepted";
      await request.save();

      sendchatNotification(
        paramedicId,
        {
          title: "MediTour Global",
          message: `Your have a new booking!`,
        },
        "Doctor"
      );
      const notification = new Notification({
        senderId: adminId,
        senderModelType: "Admin",
        receiverId: paramedicId,
        receiverModelType: "Doctor",
        title: "MediTour Global",
        message: `Your have a new booking!`,
      });
      await notification.save();

      sendchatNotification(
        userId,
        {
          title: "MediTour Global",
          message: `Your request has been accepted!`,
        },
        "user"
      );
      const notification1 = new Notification({
        senderId: adminId,
        senderModelType: "Admin",
        receiverId: userId,
        receiverModelType: "Users",
        title: "MediTour Global",
        message: `Your request has been accepted!`,
      });
      await notification1.save();

      res.json({
        auth: true,
        message: "Request has been accepted successfully!",
      });
    } catch (error) {
      next(error);
    }
  },

  async searchParamedic(req, res, next) {
    try {
      const lat = parseFloat(req.query.lat);
      const lng = parseFloat(req.query.long);
      const query = req.query.search;
      const radius = parseInt(req.query.radius) || 10000;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      let paramedicQuery = {};
      if (lat && lng) {
        paramedicQuery = {
          location: {
            $geoWithin: {
              $centerSphere: [[lng, lat], radius / 6378137],
            },
          },
        };
      }
      paramedicQuery.blocked = false;
      paramedicQuery.paidActivation = true;
      paramedicQuery.doctorKind = "paramedic";

      if (query) {
        const regex = new RegExp(query, "i");
        paramedicQuery.name = regex;
      }

      const totalParamedics = await Paramedic.countDocuments(paramedicQuery);
      const totalPages = Math.ceil(totalParamedics / limit);
      const skip = (page - 1) * limit;
      if (lat && lng) {
        paramedicQuery.location = {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [lng, lat],
            },
            $maxDistance: radius,
          },
        };
      }
      const paramedics = await Paramedic.find(paramedicQuery)
        .skip(skip)
        .limit(limit);
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        paramedics,
        previousPage: previousPage,
        nextPage: nextPage,
        totalPages: totalPages,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = adminAuthController;
