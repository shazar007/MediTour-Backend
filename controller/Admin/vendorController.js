const express = require("express");
const app = express();
const axios = require("axios");
const mongoose = require("mongoose");
const Joi = require("joi");
const geolib = require("geolib");
const Laboratory = require("../../models/Laboratory/laboratory.js");
const Hospitals = require("../../models/Hospital/hospital.js");
const Doctors = require("../../models/Doctor/doctors.js");
const { sendchatNotification } = require("../../firebase/service/index.js");
const Notification = require("../../models/notification.js");
const Pharmacy = require("../../models/Pharmacy/pharmacy.js");
const Tour = require("../../models/Travel Agency/tour.js");
const Hotel = require("../../models/Hotel/hotel.js");
const Insurance = require("../../models/Insurance/insurance.js");
const Donations = require("../../models/Donation/donationCompany.js");
const Pharmaceutical = require("../../models/Pharmaceutical/pharmaceutical.js");
const Ambulance = require("../../models/Ambulance/ambulanceCompany.js");
const AccessToken = require("../../models/accessToken");
const dotenv = require("dotenv").config();
// Import the correct model
const RentACar = require("../../models/Rent A Car/rentCar.js");
const TravelAgency = require("../../models/Travel Agency/travelAgency.js");
const User = require("../../models/User/user.js");
const AmbulanceCompany = require("../../models/Ambulance/ambulanceCompany.js");
const doctors = require("../../models/Doctor/doctors.js");
const ActivationRequest = require("../../models/activationRequest.js");
const DoctorCompany = require("../../models/DoctorCompany/docCompany.js");
const TravelCompany = require("../../models/Travel Company/travelCompany.js");
const VerificationCode = require("../../models/verificationCode.js");

const vendorController = {
  async getAllVendors(req, res, next) {
    try {
      const vendorType = req.query.vendorType;
      const search = req.query.search;
      const regex = new RegExp(search, "i");

      const limit = 10; // Define the limit for vendors per page
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const skip = (page - 1) * limit;

      let vendorList;
      let totalCount = 0;

      if (vendorType === "Pharmacy") {
        vendorList = await Pharmacy.find({ name: regex })
          .skip(skip)
          .sort({ createdAt: -1 })
          .limit(limit);
        totalCount = await Pharmacy.countDocuments({});
      } else if (vendorType === "Laboratory") {
        vendorList = await Laboratory.find({ name: regex })
          .skip(skip)
          .sort({ createdAt: -1 })
          .limit(limit);
        totalCount = await Laboratory.countDocuments({});
      } else if (vendorType === "Hospital") {
        vendorList = await Hospitals.find({ name: regex })
          .skip(skip)
          .sort({ createdAt: -1 })
          .limit(limit);
        totalCount = await Hospitals.countDocuments({});
      } else if (vendorType === "Rent A Car") {
        vendorList = await RentACar.find({ name: regex })
          .skip(skip)
          .sort({ createdAt: -1 })
          .limit(limit);
        totalCount = await RentACar.countDocuments({});
      } else if (vendorType === "Travel Agency") {
        vendorList = await TravelAgency.find({ name: regex })
          .skip(skip)
          .sort({ createdAt: -1 })
          .limit(limit);
        totalCount = await TravelAgency.countDocuments({});
      } else if (vendorType === "Hotels") {
        vendorList = await Hotel.find({ name: regex })
          .skip(skip)
          .sort({ createdAt: -1 })
          .limit(limit);
        totalCount = await Hotel.countDocuments({});
      } else if (vendorType === "Donations") {
        vendorList = await Donations.find({ name: regex })
          .skip(skip)
          .sort({ createdAt: -1 })
          .limit(limit);
        totalCount = await Donations.countDocuments({});
      } else if (vendorType === "Insurance") {
        vendorList = await Insurance.find({ name: regex })
          .skip(skip)
          .sort({ createdAt: -1 })
          .limit(limit);
        totalCount = await Insurance.countDocuments({});
      } else if (vendorType === "Users") {
        vendorList = await User.find({ name: regex })
          .skip(skip)
          .sort({ createdAt: -1 })
          .limit(limit);
        totalCount = await User.countDocuments({});
      } else if (vendorType === "Ambulance") {
        vendorList = await Ambulance.find({ name: regex })
          .skip(skip)
          .sort({ createdAt: -1 })
          .limit(limit);
        totalCount = await Ambulance.countDocuments({});
      } else if (vendorType === "Doctors") {
        vendorList = await Doctors.find({ name: regex })
          .skip(skip)
          .sort({ createdAt: -1 })
          .limit(limit);
        totalCount = await Doctors.countDocuments({});
      } else if (vendorType === "Pharmaceutical") {
        vendorList = await Pharmaceutical.find({ name: regex })
          .skip(skip)
          .sort({ createdAt: -1 })
          .limit(limit);
        totalCount = await Pharmaceutical.countDocuments({});
      } else {
        return res.status(400).json({
          error: "Invalid vendorType",
        });
      }

      // Implementing pagination
      const totalPages = Math.ceil(totalCount / limit);
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        totalCount,
        currentPage: page,
        totalPages: totalPages,
        previousPage: previousPage,
        nextPage: nextPage,
        vendors: vendorList,
      });
    } catch (error) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  },
  async blockVendor(req, res, next) {
    try {
      const { vendorType, vendorId, blocked } = req.body;

      let vendor;
      switch (vendorType) {
        case "Pharmacy":
          vendor = await Pharmacy.findByIdAndUpdate(
            vendorId,
            { blocked },
            { new: true }
          );
          break;
        case "Laboratory":
          vendor = await Laboratory.findByIdAndUpdate(
            vendorId,
            { blocked },
            { new: true }
          );
          break;
        case "Hospital":
          vendor = await Hospitals.findByIdAndUpdate(
            vendorId,
            { blocked },
            { new: true }
          );
          break;
        case "Rent A Car":
          vendor = await RentACar.findByIdAndUpdate(
            vendorId,
            { blocked },
            { new: true }
          );
          break;
        case "Travel Agency":
          vendor = await TravelAgency.findByIdAndUpdate(
            vendorId,
            { blocked },
            { new: true }
          );
          break;
        case "Hotels":
          vendor = await Hotel.findByIdAndUpdate(
            vendorId,
            { blocked },
            { new: true }
          );
          break;
        case "Donations":
          vendor = await Donations.findByIdAndUpdate(
            vendorId,
            { blocked },
            { new: true }
          );
          break;
        case "Ambulance":
          vendor = await AmbulanceCompany.findByIdAndUpdate(
            vendorId,
            { blocked },
            { new: true }
          );
          break;
        case "Insurance":
          vendor = await Insurance.findByIdAndUpdate(
            vendorId,
            { blocked },
            { new: true }
          );
          break;
        case "Users":
          vendor = await User.findByIdAndUpdate(
            vendorId,
            { blocked },
            { new: true }
          );
          break;
        case "Pharmaceuticals":
          vendor = await Pharmaceutical.findByIdAndUpdate(
            vendorId,
            { blocked },
            { new: true }
          );
          break;
        case "Doctors":
          vendor = await Doctors.findByIdAndUpdate(
            vendorId,
            { blocked },
            { new: true }
          );

          break;
        default:
          return res.status(400).json({ message: "Invalid vendor type" });
      }

      if (!vendor) {
        return res.status(404).json([]);
      }

      // Expire the token if the vendor is being blocked
      if (blocked) {
        // Find and delete the access token associated with the vendorId
        const accessToken = await AccessToken.findOneAndDelete({
          userId: vendorId,
        });
        if (accessToken) {
          console.log(`Deleted token: ${accessToken.token}`);
        } else {
          console.log("No access token found for this vendor");
        }
      }

      res.status(200).json({
        message: `Vendor ${blocked ? "blocked" : "unblocked"} successfully`,
        vendor,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  async recommendVendor(req, res, next) {
    try {
      const { vendorId, isRecommended, vendorType } = req.body;
      const _id = vendorId;

      let vendor;

      switch (vendorType) {
        case "Pharmacy":
          vendor = await Pharmacy.findByIdAndUpdate(
            _id,
            { $set: { isRecommended } },
            { new: true }
          );
          break;
        case "Laboratory":
          vendor = await Laboratory.findByIdAndUpdate(
            _id,
            { $set: { isRecommended } },
            { new: true }
          );
          break;
        case "Hospital":
          vendor = await Hospitals.findByIdAndUpdate(
            _id,
            { $set: { isRecommended } },
            { new: true }
          );
          break;
        case "Doctors":
          vendor = await Doctors.findByIdAndUpdate(
            _id,
            { $set: { isRecommended } },
            { new: true }
          );
          break;
        default:
          return res.status(400).json({ message: "Invalid vendor type" });
      }

      if (!vendor) {
        return res.status(404).json([]);
      }

      res.status(200).json({
        message: `Vendor ${isRecommended ? "recommended" : "unrecommended"
          } successfully`,
        vendor,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  async blink(req, res, next) {
    try {
      const { InvoiceNumber, InvoiceAmount, IssueDate, CustomerName } =
        req.body;
      if (!InvoiceNumber || !InvoiceAmount || !IssueDate || !CustomerName) {
        return res.status(400).send({
          message: "Please send all the required parameters!",
        });
      }
      const response = await axios({
        method: "post", // POST request to send body
        url: process.env.blinqAuthUrl,
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          ClientID: process.env.blinqClientID,
          ClientSecret: process.env.blinqClientSecret,
        },
      });

      const token = response.headers["token"];

      const response1 = await axios({
        method: "post", // POST request for second API call
        url: process.env.blinqInvoiceUrl,
        headers: {
          "Content-Type": "application/json",
          token: `${token}`,
        },
        data: [
          {
            InvoiceNumber: `${InvoiceNumber}`,
            InvoiceAmount: `${InvoiceAmount}`,
            InvoiceDueDate: "2025/04/25",
            InvoiceType: "Service",
            IssueDate: `${IssueDate}`,
            CustomerName: `${CustomerName}`,
          },
        ],
      });

      return res.json({ data: response1.data });
    } catch (error) {
      next(error);
    }
  },
  async sendActivationRequest(req, res, next) {
    try {
      let { vendorType, vendorId, paymentId, gatewayName } = req.body;
      const adminId = req.user?._id; // Add check for user._id presence

      // Fetch the vendor based on the vendor type and vendor ID
      let vendor;
      switch (vendorType) {
        case "pharmacy":
          vendor = await Pharmacy.findById(vendorId);
          break;
        case "laboratory":
          vendor = await Laboratory.findById(vendorId);
          break;
        case "hospital":
          vendor = await Hospitals.findById(vendorId);
          break;
        case "rentacar":
          vendor = await RentACar.findById(vendorId);
          break;
        case "insurance":
          vendor = await Insurance.findById(vendorId);
          break;
        case "hotel":
          vendor = await Hotel.findById(vendorId);
          break;
        case "donation":
          vendor = await Donations.findById(vendorId);
          break;
        case "ambulance":
          vendor = await AmbulanceCompany.findById(vendorId);
          break;
        case "travelagency":
          vendor = await TravelAgency.findById(vendorId);
          break;
        case "pharmaceutical":
          vendor = await Pharmaceutical.findById(vendorId);
          break;
        case "doctor":
          vendor = await Doctors.findById(vendorId);
          break;
        case "doctor company":
          vendor = await DoctorCompany.findById(vendorId);
          break;
        case "travel company":
          vendor = await TravelCompany.findById(vendorId);
          break;
        default:
          return res.status(400).json({ message: "Invalid vendor type" });
      }

      // Check if the vendor's activation request is already in progress or accepted
      if (vendor) {
        if (vendor.activationRequest === "inProgress") {
          return res.status(400).json({
            message:
              "Activation request is already in progress. Your account will be activated shortly.",
          });
        } else if (vendor.activationRequest === "accepted") {
          return res.status(400).json({
            message:
              "Activation request has already been accepted. Your account is active!",
          });
        }
      }

      // Proceed if the request is not in progress or accepted
      const blinqActivation = new ActivationRequest({
        vendorId,
        modelType: vendorType,
        gatewayName,
        paymentId,
      });
      await blinqActivation.save();

      const activationRequest = "inProgress";
      let vendorName, notificationMessage, receiverModelType, normalizedType;
      switch (vendorType) {
        case "pharmacy":
          vendor = await Pharmacy.findByIdAndUpdate(
            vendorId,
            { activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "pharmacy Vendor";
          notificationMessage = `Payment Received, ${vendorName}! Your account will be fully activated within 24 hours. Thank you for your patience!`;
          receiverModelType = "Pharmacy";
          normalizedType = "pharmacy";
          break;
        case "laboratory":
          vendor = await Laboratory.findByIdAndUpdate(
            vendorId,
            { activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "laboratory Vendor";
          notificationMessage = `Payment Received, ${vendorName}! Your account will be fully activated within 24 hours. Thank you for your patience!`;
          receiverModelType = "Laboratory";
          normalizedType = "lab";
          break;
        case "hospital":
          vendor = await Hospitals.findByIdAndUpdate(
            vendorId,
            { activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "hospital Vendor";
          notificationMessage = `Payment Received, ${vendorName}! Your account will be fully activated within 24 hours. Thank you for your patience!`;
          receiverModelType = "Hospital";
          normalizedType = "Hospital";
          break;
        case "rentacar":
          vendor = await RentACar.findByIdAndUpdate(
            vendorId,
            { activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "rentacar Vendor";
          notificationMessage = `Payment Received, ${vendorName}! Your account will be fully activated within 24 hours. Thank you for your patience!`;
          receiverModelType = "Rent A Car";
          normalizedType = "rentACar";
          break;
        case "insurance":
          vendor = await Insurance.findByIdAndUpdate(
            vendorId,
            { activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "travelagency Vendor";
          notificationMessage = `Payment Received, ${vendorName}! Your account will be fully activated within 24 hours. Thank you for your patience!`;
          receiverModelType = "Insurance";
          normalizedType = "insurance";
          break;
        case "hotel":
          vendor = await Hotel.findByIdAndUpdate(
            vendorId,
            { activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "hotel Vendor";
          notificationMessage = `Payment Received, ${vendorName}! Your account will be fully activated within 24 hours. Thank you for your patience!`;
          receiverModelType = "Hotel";
          normalizedType = "travel";
          break;
        case "donation":
          vendor = await Donations.findByIdAndUpdate(
            vendorId,
            { activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "donation Vendor";
          notificationMessage = `Payment Received, ${vendorName}! Your account will be fully activated within 24 hours. Thank you for your patience!`;
          receiverModelType = "Donation Company";
          normalizedType = "Donation";
          break;
        case "ambulance":
          vendor = await AmbulanceCompany.findByIdAndUpdate(
            vendorId,
            { activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "ambulance Vendor";
          notificationMessage = `Payment Received, ${vendorName}! Your account will be fully activated within 24 hours. Thank you for your patience!`;
          receiverModelType = "Ambulance Company";
          normalizedType = "Ambulance Company";
          break;
        case "travelagency":
          vendor = await TravelAgency.findByIdAndUpdate(
            vendorId,
            { activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "insurance Vendor";
          notificationMessage = `Payment Received, ${vendorName}! Your account will be fully activated within 24 hours. Thank you for your patience!`;
          receiverModelType = "Travel Agency";
          normalizedType = "agency";
          break;
        case "pharmaceutical":
          vendor = await Pharmaceutical.findByIdAndUpdate(
            vendorId,
            { activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "pharmaceutical Vendor";
          notificationMessage = `Payment Received, ${vendorName}! Your account will be fully activated within 24 hours. Thank you for your patience!`;
          receiverModelType = "Pharmaceutical";
          normalizedType = "Pharmaceutical";
          break;
        case "doctor":
          vendor = await Doctors.findByIdAndUpdate(
            vendorId,
            { activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "doctor Vendor";
          notificationMessage = `Payment Received, ${vendorName}! Your account will be fully activated within 24 hours. Thank you for your patience!`;
          receiverModelType = "Doctor";
          normalizedType = "Doctor";
          break;
        case "doctor company":
          vendor = await DoctorCompany.findByIdAndUpdate(
            vendorId,
            { activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "Doctor Company Vendor";
          notificationMessage = `Payment Received, ${vendorName}! Your account will be fully activated within 24 hours. Thank you for your patience!`;
          receiverModelType = "Doctor Company";
          normalizedType = "Doctor Company";
          break;
        case "travel company":
          vendor = await TravelCompany.findByIdAndUpdate(
            vendorId,
            { activationRequest },
            { new: true }
          );
          vendorName = vendor?.name || "Travel Company Vendor";
          notificationMessage = `Payment Received, ${vendorName}! Your account will be fully activated within 24 hours. Thank you for your patience!`;
          receiverModelType = "Travel Company";
          normalizedType = "Travel Company";
          break;
        default:
          return res.status(400).json({ message: "Invalid vendor type" });
      }
      // Check if vendor exists and type matches
      if (!vendor) {
        return res
          .status(404)
          .json({ message: "Invalid vendor ID or type provided" });
      }

      if (vendor.modelType && vendor.modelType !== vendorType) {
        return res.status(400).json({
          message: "Invalid vendor ID or type provided",
        });
      }
      // Send notification based on the normalized type
      sendchatNotification(
        vendorId,
        {
          title: "Account Activation in progress",
          message: notificationMessage,
        },
        normalizedType // Pass the normalized type here
      );

      // Save the notification to the database
      const activeVendorNotification = new Notification({
        senderId: adminId,
        senderModelType: "Admin",
        receiverId: vendorId,
        receiverModelType: receiverModelType, // Correct receiver model type
        title: "Account Activaton In Progress",
        message: notificationMessage,
      });
      await activeVendorNotification.save();

      res.status(200).json({
        message: "Vendor would be activated after some time!",
        vendor: vendor,
      });
    } catch (error) {
      return next(error);
    }
  },
  async acceptInvitation(req, res, next) {
    try {
      const { email, type, code, travelCompanyId } = req.body;

      // Validate the verification code
      const verificationCode = await VerificationCode.findOne({ code });
      if (!verificationCode) {
        return res
          .status(400)
          .json({ message: "Invalid verification code. Please try again." });
      }

      if (email !== verificationCode.email) {
        return res
          .status(400)
          .json({ message: "User details do not match the verification." });
      }

      // Common checks for travel company existence
      let travelCompany = null;
      if (travelCompanyId) {
        travelCompany = await TravelCompany.findById(travelCompanyId);
        if (!travelCompany) {
          return res.status(404).json({ message: "Travel company not found!" });
        }
      }

      // Handle type-specific logic
      let entity = null;
      let senderModelType;
      if (type === "agency") {
        entity = await TravelAgency.findOne({ email });
        if (!entity) {
          return res.status(404).json({ message: "Travel Agency not found!" });
        }
        senderModelType = "Travel Agency";

        // Check if the agency is already associated with the current company
        if (
          entity.travelCompanyId &&
          entity.travelCompanyId.toString() === travelCompanyId.toString()
        ) {
          return res.status(400).json({
            message: "Agency is already associated with your company!",
          });
        }

        // Check if the agency is associated with another company
        if (
          entity.travelCompanyId &&
          entity.travelCompanyId.toString() !== travelCompanyId.toString()
        ) {
          return res.status(403).json({
            message: "Agency is already associated with another company!",
          });
        }

        // Associate the agency with the travel company
        entity.travelCompanyId = travelCompanyId;
        entity.entityType = "company";
        if (!travelCompany.agencyIds.includes(entity._id)) {
          travelCompany.agencyIds.push(entity._id);
          await travelCompany.save();
        }
      } else if (type === "hotel") {
        entity = await Hotel.findOne({ email });
        if (!entity) {
          return res.status(404).json({ message: "Hotel not found!" });
        }
        senderModelType = "Hotel";

        // Check if the hotel is already associated with the current company
        if (
          entity.travelCompanyId &&
          entity.travelCompanyId.toString() === travelCompanyId.toString()
        ) {
          return res.status(400).json({
            message: "Hotel is already associated with your company!",
          });
        }

        // Check if the hotel is associated with another company
        if (
          entity.travelCompanyId &&
          entity.travelCompanyId.toString() !== travelCompanyId.toString()
        ) {
          return res.status(403).json({
            message: "Hotel is already associated with another company!",
          });
        }

        // Associate the hotel with the travel company
        entity.travelCompanyId = travelCompanyId;
        entity.entityType = "company";
        if (!travelCompany.hotelIds.includes(entity._id)) {
          travelCompany.hotelIds.push(entity._id);
          await travelCompany.save();
        }
      } else {
        return res.status(400).json({ message: "Invalid type provided." });
      }

      // Save the updated entity
      await entity.save();

      // Invalidate the verification code
      await VerificationCode.deleteMany({ email });
      let normalizedType = "Travel Company";
      const messageType =
        type === "agency" ? "Travel Agency" : type === "hotel" ? "Hotel" : null;
      let notificationMessage = `We're excited to inform you that your invitation to collaborate has been accepted by ${messageType} named ${entity.name}`;
      console.log("notificationMessage", notificationMessage);

      sendchatNotification(
        travelCompanyId,
        { title: "Invitation Accepted", message: notificationMessage },
        normalizedType // Pass the normalized type here
      );

      // Save the notification to the database
      const activeVendorNotification = new Notification({
        senderId: entity._id,
        senderModelType,
        receiverId: travelCompanyId,
        receiverModelType: normalizedType, // Correct receiver model type
        title: "Invitation Accepted",
        message: notificationMessage,
      });
      await activeVendorNotification.save();

      // Final response
      return res.status(200).json({
        status: true,
        message:
          "Your account has been successfully verified and associations updated.",
      });
    } catch (error) {
      return next(error);
    }
  },

  async getTravelCompanies(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const search = req.query.search
      const nameRegex = new RegExp(search, "i");

      const skip = (page - 1) * limit;

      const travelCompaniesCount = await TravelCompany.countDocuments({  paidActivation: true, blocked: false, name: { $regex: nameRegex },});

      const totalPages = Math.ceil(travelCompaniesCount / limit);

      const travelCompanies = await TravelCompany.find({ paidActivation: true, blocked: false, name: { $regex: nameRegex }, })
        .skip(skip)
        .limit(limit);

      // Calculate previous and next page numbers
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Return the response with the required data
      return res.json({
        totalCount: travelCompaniesCount,
        currentPage: page,
        totalPages: totalPages,
        previousPage: previousPage,
        nextPage: nextPage,
        data: travelCompanies
      });
    } catch (error) {
      next(error);
    }
  }

};
module.exports = vendorController;
