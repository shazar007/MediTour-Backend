const express = require("express");
const app = express();
const ActivationRequest = require("../../models/activationRequest");
const Laboratory = require("../../models/Laboratory/laboratory.js");
const Hospitals = require("../../models/Hospital/hospital.js");
const Doctors = require("../../models/Doctor/doctors.js");
const Pharmaceutical = require("../../models/Pharmaceutical/pharmaceutical.js");
const Pharmacy = require("../../models/Pharmacy/pharmacy.js");
const Hotel = require("../../models/Hotel/hotel.js");
const { sendchatNotification } = require("../../firebase/service/index.js");
const Notification = require("../../models/notification.js");
const Insurance = require("../../models/Insurance/insurance.js");
const Donations = require("../../models/Donation/donationCompany.js");
const RentACar = require("../../models/Rent A Car/rentCar.js");
const TravelAgency = require("../../models/Travel Agency/travelAgency.js");
const AmbulanceCompany = require("../../models/Ambulance/ambulanceCompany.js");
const DoctorCompany = require("../../models/DoctorCompany/docCompany.js");
const TravelCompany = require("../../models/Travel Company/travelCompany.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");
const { sendVendorActivationEmail } = require("../email.js");

const activationController = {
  async getActivationRequest(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const skip = (page - 1) * limit;

      const requestCount = await ActivationRequest.countDocuments();
      const totalPages = Math.ceil(requestCount / limit);

      const requests = await ActivationRequest.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      // Populate vendorId dynamically based on modelType
      const populatedRequests = await Promise.all(
        requests.map(async (request) => {
          const { modelType, vendorId } = request;

          switch (modelType) {
            case "doctor":
              request.vendorId = await Doctors.findById(vendorId).select(
                "name email phoneNumber paidActivation vendorId"
              );
              break;
            case "pharmacy":
              request.vendorId = await Pharmacy.findById(vendorId).select(
                "name email phoneNumber paidActivation vendorId"
              );
              break;
            case "hospital":
              request.vendorId = await Hospitals.findById(vendorId).select(
                "name email phoneNumber paidActivation vendorId"
              );
              break;
            case "laboratory":
              request.vendorId = await Laboratory.findById(vendorId).select(
                "name email phoneNumber paidActivation vendorId"
              );
              break;
            case "hotel":
              request.vendorId = await Hotel.findById(vendorId).select(
                "name email phoneNumber paidActivation vendorId"
              );
              break;
            case "rentacar":
              request.vendorId = await RentACar.findById(vendorId).select(
                "name email phoneNumber paidActivation vendorId"
              );
              break;
            case "insurance":
              request.vendorId = await Insurance.findById(vendorId).select(
                "name email phoneNumber paidActivation vendorId"
              );
              break;
            case "donation":
              request.vendorId = await Donations.findById(vendorId).select(
                "name email phoneNumber paidActivation vendorId"
              );
              break;
            case "ambulance":
              request.vendorId = await AmbulanceCompany.findById(
                vendorId
              ).select("name email phoneNumber paidActivation vendorId");
              break;
            case "travelagency":
              request.vendorId = await TravelAgency.findById(vendorId).select(
                "name email phoneNumber paidActivation vendorId"
              );
              break;
            case "pharmaceutical":
              request.vendorId = await Pharmaceutical.findById(vendorId).select(
                "name email phoneNumber paidActivation vendorId"
              );
              break;
            case "doctor company":
              request.vendorId = await DoctorCompany.findById(vendorId).select(
                "name email phoneNumber paidActivation vendorId"
              );
              break;
            case "travel company":
              request.vendorId = await TravelCompany.findById(vendorId).select(
                "name email phoneNumber paidActivation vendorId"
              );
              break;
            default:
              request.vendorId = null; // If the modelType is invalid or unsupported
              break;
          }
          return request;
        })
      );

      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      res.status(200).json({
        requests: populatedRequests,
        requestCount,
        totalPages,
        previousPage,
        nextPage,
        auth: true,
      });
    } catch (error) {
      console.error("Error fetching activation requests:", error);
      return next(error);
    }
  },

  async activateVendor(req, res, next) {
    try {
      const { vendorType, vendorId } = req.body;
      const adminId = req.user?._id; // Add check for user._id presence
      const activationRequest = "accepted";
      let vendor, vendorName, notificationMessage, normalizedType;
      let receiverModelType;

      // Determine the vendor's receiverModelType and activation logic based on vendorType
      switch (vendorType) {
        case "pharmacy":
          vendor = await Pharmacy.findByIdAndUpdate(
            vendorId,
            { paidActivation: true, activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "Pharmacy Vendor";
          notificationMessage = `Hello ${vendorName}, your Pharmacy account has been activated!`;
          receiverModelType = "Pharmacy";
          normalizedType = "pharmacy";
          break;
        case "laboratory":
          vendor = await Laboratory.findByIdAndUpdate(
            vendorId,
            { paidActivation: true, activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "Laboratory Vendor";
          notificationMessage = `Hello ${vendorName}, your Laboratory account has been activated!`;
          receiverModelType = "Laboratory";
          normalizedType = "lab";
          break;
        case "hospital":
          console.log("hospital");
          vendor = await Hospitals.findByIdAndUpdate(
            vendorId,
            { paidActivation: true, activationRequest, doctorsAllowed: 3, labsAllowed: 1, pharmaciesAllowed: 1 },
            { new: true }
          );
          console.log("hospital");
          vendorName = vendor?.name || "Hospital Vendor";
          notificationMessage = `Hello ${vendorName}, your Hospital account has been activated!`;
          receiverModelType = "Hospital";
          normalizedType = "Hospital";
          break;
        case "rentacar":
          vendor = await RentACar.findByIdAndUpdate(
            vendorId,
            { paidActivation: true, activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "Rent A Car Vendor";
          notificationMessage = `Hello ${vendorName}!, your account has been activated!`;
          receiverModelType = "Rent A Car";
          normalizedType = "rentACar";
          break;
        case "travelagency":
          vendor = await TravelAgency.findByIdAndUpdate(
            vendorId,
            { paidActivation: true, activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "Travel Agency Vendor";
          notificationMessage = `Hello ${vendorName}, your Travel Agency account has been activated!`;
          receiverModelType = "Travel Agency";
          normalizedType = "agency";
          break;
        case "hotel":
          vendor = await Hotel.findByIdAndUpdate(
            vendorId,
            { paidActivation: true, activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "Hotel Vendor";
          notificationMessage = `Hello ${vendorName}, your Hotel account has been activated!`;
          receiverModelType = "Hotel";
          normalizedType = "travel";
          break;
        case "donation":
          vendor = await Donations.findByIdAndUpdate(
            vendorId,
            { paidActivation: true, activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "Donation Vendor";
          notificationMessage = `Hello ${vendorName}, your Donation account has been activated!`;
          receiverModelType = "Donation Company";
          normalizedType = "Donation";
          break;
        case "ambulance":
          vendor = await AmbulanceCompany.findByIdAndUpdate(
            vendorId,
            { paidActivation: true, activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "Ambulance Vendor";
          notificationMessage = `Hello ${vendorName}, your Ambulance account has been activated!`;
          receiverModelType = "Ambulance Company";
          normalizedType = "Ambulance Company";
          break;
        case "insurance":
          vendor = await Insurance.findByIdAndUpdate(
            vendorId,
            { paidActivation: true, activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "Insurance Vendor";
          notificationMessage = `Hello ${vendorName}, your Insurance account has been activated!`;
          receiverModelType = "Insurance";
          normalizedType = "insurance";
          break;
        case "pharmaceutical":
          vendor = await Pharmaceutical.findByIdAndUpdate(
            vendorId,
            { paidActivation: true, activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "Pharmaceutical Vendor";
          notificationMessage = `Hello ${vendorName}, your Pharmaceutical account has been activated!`;
          receiverModelType = "Pharmaceutical";
          normalizedType = "Pharmaceutical";
          break;
        case "doctor":
          vendor = await Doctors.findByIdAndUpdate(
            vendorId,
            { paidActivation: true, activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "Doctor Vendor";
          notificationMessage = `Hello ${vendorName}, your Doctor account has been activated!`;
          receiverModelType = "Doctor";
          normalizedType = "Doctor";
          break;
        case "doctor company":
          vendor = await DoctorCompany.findByIdAndUpdate(
            vendorId,
            { paidActivation: true, activationRequest, doctorsAllowed: 3 },
            { new: true }
          );
          vendorName = vendor?.name || "Doctor Company Vendor";
          notificationMessage = `Hello ${vendorName}, your Doctor Company account has been activated!`;
          receiverModelType = "Doctor Company";
          normalizedType = "Doctor Company";
          break;
        case "travel company":
          vendor = await TravelCompany.findByIdAndUpdate(
            vendorId,
            { paidActivation: true, activationRequest},
            { new: true }
          );
          vendorName = vendor?.name || "Travel Company Vendor";
          notificationMessage = `Hello ${vendorName}, your Travel Company account has been activated!`;
          receiverModelType = "Travel Company";
          normalizedType = "Travel Company";
          break;
        default:
          return res.status(400).json({ message: "Invalid vendor type" });
      }

      // Check if vendor was successfully updated
      if (!vendor) {
        return res.status(404).json({
          auth: false,
          message: "Vendor not found!"
        });
      }

      // Send notification based on the normalized type
      // Send activation email
      await sendVendorActivationEmail(vendor, receiverModelType);
      sendchatNotification(
        vendorId,
        { title: "Account Activated", message: notificationMessage },
        normalizedType // Pass the normalized type here
      );

      // Save the notification to the database
      const activeVendorNotification = new Notification({
        senderId: adminId,
        senderModelType: "Admin",
        receiverId: vendorId,
        receiverModelType: receiverModelType, // Correct receiver model type
        title: "Account Activated",
        message: notificationMessage,
      });
      await activeVendorNotification.save();

      // Optionally delete old tokens if needed
      await RefreshToken.deleteOne({ userId: vendorId });
      await AccessToken.deleteOne({ userId: vendorId });

      res.status(200).json({
        auth: true,
        message: "Vendor has been activated!",
      });
    } catch (error) {
      return next(error);
    }
  },
};
module.exports = activationController;
