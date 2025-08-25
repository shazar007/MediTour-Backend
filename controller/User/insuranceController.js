const Insurance = require("../../models/Insurance/insurance");
const FamilyHealthInsurance = require("../../models/Insurance/familyHealthInsurance");
const IndividualHealthInsurance = require("../../models/Insurance/individualHealthInsurance");
const FamilyTravelInsurance = require("../../models/Insurance/familyTravelInsurance");
const IndividualTravelInsurance = require("../../models/Insurance/individualTravelInsurance");
const ParentsHealthInsurance = require("../../models/Insurance/parentsHealthInsurance");
const InsuranceRequest = require("../../models/Insurance/insuranceRequest");
const InsuranceBooking = require("../../models/Insurance/insuranceBooking");
const stripePaymentTransaction = require("../../models/stripeTransactions");
const axios = require("axios");
const fs = require("fs");
const moment = require("moment");
const { sendchatNotification } = require("../../firebase/service");
const Notification = require("../../models/notification");
const Admin = require("../../models/Admin/Admin");
const User = require("../../models/User/user");

const insuranceController = {
  async getNearbyInsuranceCompanies(req, res, next) {
    try {
      // const lat = parseFloat(req.query.lat);
      // const lng = parseFloat(req.query.long);
      // const query = req.query.search;
      // const radius = parseInt(req.query.radius) || 1000;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 5;

      // let insuranceQuery = {
      //   location: {
      //     $geoWithin: {
      //       $centerSphere: [[lng, lat], radius / 6378137], // Convert radius to radians
      //     },
      //   },
      // };

      // // Apply search query if provided
      // if (query) {
      //   const regex = new RegExp(query, "i");
      //   insuranceQuery.name = regex;
      // }

      // Calculate the skip value based on the page and limit
      const totalInsurances = await Insurance.countDocuments({
        blocked: false,
      }); // Get the total number of labs
      const totalPages = Math.ceil(totalInsurances / limit);
      const skip = (page - 1) * limit;
      // insuranceQuery.location = {
      //   $near: {
      //     $geometry: {
      //       type: "Point",
      //       coordinates: [lng, lat],
      //     },
      //     $maxDistance: radius,
      //   },
      // };
      // Fetch pharmacies with pagination
      let insuranceCompanies = await Insurance.find({ blocked: false })
        .skip(skip)
        .limit(limit);
      // Calculate total pages

      // Determine next and previous pages
      const nextPage = page < totalPages ? page + 1 : null;
      const prevPage = page > 1 ? page - 1 : null;

      return res.status(200).json({
        insuranceCompanies,
        totalInsurances,
        nextPage,
        prevPage,
        totalPages,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },

  async searchHealthInsurance(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1; // Get the page number from the query parameter
      const insurancePerPage = 30; // Number of insurances per page
      const { planType } = req.body;

      // Initialize variables for total count and insurances
      let totalCount;
      let insurances;

      // Pagination logic
      const skip = (page - 1) * insurancePerPage;

      if (planType === "family plan") {
        totalCount = await FamilyHealthInsurance.countDocuments(); // Total number of family plans
        insurances = await FamilyHealthInsurance.find()
          .populate("insuranceId")
          .skip(skip)
          .limit(insurancePerPage);
      } else if (planType === "individual plan") {
        totalCount = await IndividualHealthInsurance.countDocuments(); // Total number of individual plans
        insurances = await IndividualHealthInsurance.find()
          .populate("insuranceId")
          .skip(skip)
          .limit(insurancePerPage);
      } else if (planType === "parents plan") {
        totalCount = await ParentsHealthInsurance.countDocuments(); // Total number of parents plans
        insurances = await ParentsHealthInsurance.find()
          .populate("insuranceId")
          .skip(skip)
          .limit(insurancePerPage);
      }

      // Filter out insurances where insuranceId.blocked is true
      insurances = insurances.filter(
        (insurance) =>
          insurance.insuranceId &&
          insurance.insuranceId.paidActivation === true &&
          !insurance.insuranceId.blocked
      );

      // Recalculate total count after filtering
      totalCount = insurances.length;

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalCount / insurancePerPage);

      // Determine previous and next pages
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Respond with paginated data
      res.json({
        insurances,
        totalPages,
        currentPage: page,
        totalCount,
        previousPage,
        nextPage,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },

  async fetchHospitalizationLimit(req, res, next) {
    const insurances = await FamilyHealthInsurance.find(
      {},
      { hospitalizationLimit: 1, _id: 0 }
    );

    const uniqueHospitalizationLimits = {};

    // Filter out duplicate hospitalization limits
    insurances.forEach((insurance) => {
      const { startLimit, endLimit } = insurance.hospitalizationLimit;
      const key = `${startLimit}-${endLimit}`;
      if (!uniqueHospitalizationLimits[key]) {
        uniqueHospitalizationLimits[key] = insurance.hospitalizationLimit;
      }
    });

    const uniqueLimitsArray = Object.values(uniqueHospitalizationLimits);

    res.json({ uniqueLimitsArray, auth: true });
  },

  async getInsurance(req, res, next) {
    try {
      const type = req.query.type;
      const insuranceId = req.query.insuranceId;
      let insurance;
      if (type == "family plan") {
        insurance = await FamilyHealthInsurance.findById(insuranceId).populate(
          "insuranceId"
        );
      } else if (type == "individual plan") {
        insurance = await IndividualHealthInsurance.findById(
          insuranceId
        ).populate("insuranceId");
      } else if (type == "parents plan") {
        insurance = await ParentsHealthInsurance.findById(insuranceId).populate(
          "insuranceId"
        );
      } else if (type == "individual travel") {
        insurance = await IndividualTravelInsurance.findById(
          insuranceId
        ).populate("insuranceId");
      } else if (type == "family travel") {
        insurance = await FamilyTravelInsurance.findById(insuranceId).populate(
          "insuranceId"
        );
      }
      res.json({ insurance, auth: true });
    } catch (error) {
      return next(error);
    }
  },

  async sendInsuranceRequest(req, res, next) {
    try {
      const {
        insuranceKind,
        insuranceCompanyId,
        insuranceId,
        userId,
        location,
        cnic,
        insuranceFor,
        insuranceType,
        totalAmount,
        cnicFile,
        paymentId,
        paidByUserAmount,
        processingFee,
        gatewayName,
      } = req.body;

      // Determine the insurance model type based on the insuranceKind
      let insuranceModelType;
      switch (insuranceKind) {
        case "family plan":
          insuranceModelType = "Family Health Insurance";
          break;
        case "individual plan":
          insuranceModelType = "Individual Health Insurance";
          break;
        case "parents plan":
          insuranceModelType = "Parent Health Insurance";
          break;
        case "individual travel":
          insuranceModelType = "Individual Travel Insurance";
          break;
        case "family travel":
          insuranceModelType = "Family Travel Insurance";
          break;
        default:
          return res.status(400).json({ message: "Invalid insurance kind" });
      }
      // Create a new insurance request object
      let paymentIdArray = [];

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
      const newInsuranceRequest = new InsuranceRequest({
        insuranceCompanyId,
        insuranceId,
        insuranceModelType,
        userId,
        location,
        cnic,
        insuranceFor,
        insuranceType,
        totalAmount,
        cnicFile,
        paymentId: paymentIdArray,
        paidByUserAmount,
        processingFee,
        gatewayName,
        isPaidFull: true,
      });

      // Save the new insurance request to the database
      await newInsuranceRequest.save();
      if (gatewayName !== "blinq") {
        const stripePaymentToRegister = new stripePaymentTransaction({
          id: newInsuranceRequest._id,
          idModelType: "Insurance Request",
          paymentId,
          gatewayName,
          paidByUserAmount,
          isPaidFull: true,
        });
        stripeController = await stripePaymentToRegister.save();
        const user = await User.findById(userId);

        const receiverId = insuranceCompanyId; // Adjust this as needed
        sendchatNotification(
          receiverId,
          {
            title: "MediTour Global",
            message: `A new insurance request has been received.`,
          },
          "insurance"
        );

        // Create and save a notification
        const notification = new Notification({
          senderId: req.user._id,
          senderModelType: "Users",
          receiverId: receiverId,
          receiverModelType: "Insurance",

          title: "MediTour Global",
          message: "A new insurance request has been submitted",
        });
        await notification.save();
        // Fetch all admins
        const admins = await Admin.find(); // Adjust this to match your admin retrieval logic

        // Create notifications for each admin
        const adminNotifications = admins.map((admin) => ({
          senderId: req.user._id,
          senderModelType: "Users",
          receiverId: admin._id,
          receiverModelType: "Admin",
          title: "MediTour Global",
          message: `Payment of ${paidByUserAmount} received from ${user.name} for insurance ${insuranceFor}.`,
        }));

        // Insert notifications into the database
        await Notification.insertMany(adminNotifications);

        // Send chat notifications to all admins asynchronously
        admins.forEach((admin) => {
          sendchatNotification(
            admin._id,
            {
              title: "MediTour Global",
              message: `Payment of ${paidByUserAmount} received from ${user.name} for insurance ${insuranceFor}`,
            },
            "admin"
          );
        });
      }

      // Send response indicating successful insurance request submission
      res.status(201).json({
        message: "Insurance request sent successfully",
        insuranceRequest: newInsuranceRequest,
      });
    } catch (error) {
      next(error);
      // Pass any errors to the error handling middleware
      return next(error);
    }
  },

  async searchTravelInsurance(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1; // Get the page number from the query parameter
      const insurancePerPage = 30; // Number of insurances per page
      const { planType, passengerTraveling, country } = req.body;

      let totalCount;
      let insurances = [];
      const skip = (page - 1) * insurancePerPage;

      let query = {};
      if (
        planType === "single trip" &&
        passengerTraveling === "individual travel"
      ) {
        query = { tripType: "singleTrip", countrySelection: country };
        insurances = await IndividualTravelInsurance.find(query)
          .populate("insuranceId")
          .skip(skip)
          .limit(insurancePerPage);
      } else if (
        planType === "single trip" &&
        passengerTraveling === "family travel"
      ) {
        query = { tripType: "singleTrip", countrySelection: country };
        insurances = await FamilyTravelInsurance.find(query)
          .populate("insuranceId")
          .skip(skip)
          .limit(insurancePerPage);
      } else if (
        planType === "multiple trips" &&
        passengerTraveling === "individual travel"
      ) {
        query = { tripType: "multipleTrips", countrySelection: country };
        insurances = await IndividualTravelInsurance.find(query)
          .populate("insuranceId")
          .skip(skip)
          .limit(insurancePerPage);
      } else if (
        planType === "multiple trips" &&
        passengerTraveling === "family travel"
      ) {
        query = { tripType: "multipleTrips", countrySelection: country };
        insurances = await FamilyTravelInsurance.find(query)
          .populate("insuranceId")
          .skip(skip)
          .limit(insurancePerPage);
      }

      // Filter out insurances where insuranceId.blocked is true
      insurances = insurances.filter(
        (insurance) =>
          insurance.insuranceId &&
          !insurance.insuranceId.blocked &&
          insurance.insuranceId.paidActivation === true
      );

      // Calculate the total count after filtering
      totalCount = insurances.length;

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalCount / insurancePerPage);

      // Determine previous and next pages
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      res.json({
        insurances,
        totalPages,
        currentPage: page,
        totalCount,
        previousPage,
        nextPage,
        auth: true,
      });
    } catch (error) {
      console.error("Error in searchTravelInsurance:", error);
      return next(error);
    }
  },

  async downloadPolicyDoc(req, res, next) {
    try {
      const { insuranceId, insuranceType } = req.query;
      if (!insuranceId) {
        throw new Error("Insurance ID is required.");
      }
      let insurancePolicy;
      if (insuranceType === "individual plan") {
        insurancePolicy = await IndividualHealthInsurance.findById(insuranceId);
      } else if (insuranceType === "family plan") {
        insurancePolicy = await FamilyHealthInsurance.findById(insuranceId);
      } else if (insuranceType === "parents plan") {
        insurancePolicy = await ParentsHealthInsurance.findById(insuranceId);
      } else if (insuranceType === "individual travel") {
        insurancePolicy = await IndividualTravelInsurance.findById(insuranceId);
      } else if (insuranceType === "family travel") {
        insurancePolicy = await FamilyTravelInsurance.findById(insuranceId);
      }
      // Find insurance document based on the provided insuranceId
      if (!insurancePolicy) {
        return res.status(404).json([]); // Send empty response
      }
      const policyDocumentUrl = insurancePolicy.policyDocument;
      if (!policyDocumentUrl) {
        throw new Error("Policy document URL not available.");
      }
      // Extract policy document from the insurance document
      const response = await axios.get(policyDocumentUrl, {
        responseType: "stream",
      });

      // Set response headers to force download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=policy_${insuranceId}.pdf`
      );

      // Pipe the downloaded policy document directly to the response stream
      response.data.pipe(res);
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = insuranceController;
