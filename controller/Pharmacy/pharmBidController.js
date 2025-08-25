const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const pharmOrder = require("../../models/order.js");
const moment = require("moment");
const Tests = require("../../models/Laboratory/tests.js");
const Pharmacy = require("../../models/Pharmacy/pharmacy.js");
const BidRequest = require("../../models/Pharmacy/bid.js");
const MedicineRequest = require("../../models/Pharmacy/medicineRequest.js");
const { sendchatNotification } = require("../../firebase/service/index.js");
const Notification = require("../../models/notification.js");
const Joi = require("joi");
const Admin = require("../../models/Admin/Admin.js");

const pharmOrderController = {
  async addBidRequest(req, res, next) {
    try {
      const pharmacyId = req.user._id;
      const bidSchema = Joi.object({
        requestId: Joi.string().required(),
        availableMedIds: Joi.array().required(),
        partialOrFull: Joi.string().required(),
      });
  
      const { error } = bidSchema.validate(req.body);
  
      if (error) {
        return next(error);
      }
  
      const { requestId, availableMedIds, partialOrFull } = req.body;
  
      // Check if the pharmacy has already placed a bid for this request
      const alreadyBid = await BidRequest.findOne({ pharmacyId, requestId });
      if (alreadyBid) {
        const error = {
          status: 409,
          message: "You have already bid against the following request!",
        };
        return next(error);
      }

      const alreadyBooked = await MedicineRequest.findOne({
        _id: requestId,
        pharmacyId: { $exists: true },
      });
      if (alreadyBooked) {
        const error = {
          status: 409,
          message: "Request has already been booked!",
        };
        return next(error);
      }
  
      // Find the related medicine request
      const medicineRequest = await MedicineRequest.findById(requestId);
      
      // If medicineRequest is not found, return a 404 error
      if (!medicineRequest) {
        return res.status(404).json([]);
      }
  
      // Create and save the new bid
      let bid;
      try {
        const bidToRegister = new BidRequest({
          requestId,
          pharmacyId,
          availableMedIds,
          partialOrFull,
        });
  
        bid = await bidToRegister.save();
  
        // Add the bid ID to the medicineRequest's bidIds array
        medicineRequest.bidIds.push(bid._id);
  
        // Save the updated medicineRequest document
        await medicineRequest.save();
  
        // Send notifications to all admins
        const admins = await Admin.find({});
        admins.forEach((admin) => {
          sendchatNotification(
            admin._id,
            {
              title: "MediTour Global",
              message: `You have received a new bid request!`,
            },
            "admin"
          );
        });
  
        // Create notifications for each admin
        const notifications = admins.map((admin) => ({
          senderId: pharmacyId,
          senderModelType: "Pharmacy",
          receiverId: admin._id,
          receiverModelType: "Admin",
          title: "MediTour Global",
          message: "You have received a new bid request!",
        }));
  
        // Insert notifications into the database
        await Notification.insertMany(notifications);
      } catch (error) {
        return next(error);
      }
  
      return res.status(201).json({ bidRequest: bid, auth: true });
    } catch (error) {
      next(error);
    }
  },
  

  async getMedicineRequests(req, res, next) {
    try {
      const pharmacyId = req.user._id;
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = 10;
  
      const pharmacy = await Pharmacy.findById(pharmacyId);
      if (pharmacy.activationRequest=="inProgress") {
        const error = {
          status: 403,
          message: "Your account will be activated within the next hour",
        };
        return next(error);
      } else if(pharmacy.activationRequest=="pending") {
        const error = {
          status: 403,
          message: "Please pay the activation fee to activate your account",
        };
        return next(error);
      }else if(pharmacy.blocked==true) {
        const error = {
          status: 403,
          message: "This user is deleted",
        };
        return next(error);
      }

      if (pharmacy.hospitalIds?.length > 0 && pharmacy.isActive === false) {
        const error = {
          status: 403,
          message: "Your account is inactive by the Hospital.",
        };
        return next(error);
      }
      const totalRequests = await MedicineRequest.countDocuments({
        status: "pending",
        pharmacyId: { $exists: false }, // Filter out requests that already have a pharmacyId
      });
  
      const totalPages = Math.ceil(totalRequests / requestsPerPage); // Calculate the total number of pages
  
      const skip = (page - 1) * requestsPerPage; // Calculate the number of requests to skip based on the current page
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;
  
      const allRequests = await MedicineRequest.find({
        status: "pending",
        pharmacyId: { $exists: false }, // Filter out requests that already have a pharmacyId
      })
        .sort({ createdAt: -1 }) // Sort by createdAt field in descending order
        .populate("medicineIds.id patientId")
        .populate({
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
          });
          const bid = await BidRequest.findOne({
            pharmacyId: pharmacyId,
            requestId: request._id,
          });
          let requestSent;
          if (bid) {
            requestSent = true;
          } else {
            requestSent = false;
          }
          return {
            ...request,
            bidCount,
            requestSent,
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
  }
  
};

module.exports = pharmOrderController;
