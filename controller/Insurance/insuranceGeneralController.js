const express = require("express");
const app = express();
const Hospital = require("../../models/Hospital/hospital.js");
const Laboratory = require("../../models/Laboratory/laboratory.js");

const FamilyTravel = require("../../models/Insurance/familyTravelInsurance.js");
const IndividualTravel = require("../../models/Insurance/individualTravelInsurance.js");

const IndividualHealth = require("../../models/Insurance/individualHealthInsurance.js");
const FamilyHealth = require("../../models/Insurance/familyHealthInsurance.js");
const ParentHealth = require("../../models/Insurance/parentsHealthInsurance.js");

const insuranceGeneralController = {
  async getHospitals(req, res, next) {
    try {
      let page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      let hospitalPerPage = 10;
      let insuranceId = req.user._id;
      let search = req.query.search;
      let hospitals;
      let totalHospitals;
      let totalPages;
      let skip;
      if (search) {
        const regex = new RegExp(search, "i"); // Create a case-insensitive regular expression
        console.log(search);
        totalHospitals = await Hospital.countDocuments({
          name: regex,
          paidActivation: true,
          blocked: false,
        });
        totalPages = Math.ceil(totalHospitals / hospitalPerPage); // Calculate the total number of pages
        skip = (page - 1) * hospitalPerPage; // Calculate the number of posts to skip based on the current page
        hospitals = await Hospital.find({
          name: regex,
          paidActivation: true,
          blocked: false,
        })
          .skip(skip)
          .limit(hospitalPerPage);

        // Filter out the hospitals where criteriaId is null (no matching criteriaName)
      } else {
        totalHospitals = await Hospital.countDocuments({
          paidActivation: true,
          blocked: false,
        });
        totalPages = Math.ceil(totalHospitals / hospitalPerPage); // Calculate the total number of pages
        skip = (page - 1) * hospitalPerPage;
        hospitals = await Hospital.find({
          paidActivation: true,
          blocked: false,
        })
          .skip(skip)
          .limit(hospitalPerPage)
          .skip(skip)
          .limit(hospitalPerPage);
      }
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;
      return res.status(200).json({
        hospitals: hospitals,
        auth: true,
        previousPage: previousPage,
        nextPage: nextPage,
        totalPages,
      });
    } catch (error) {
      return next(error);
    }
  },

  async getLabs(req, res, next) {
    try {
      let page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      let labPerPage = 10;
      let insuranceId = req.user._id;
      let search = req.query.search;
      let labs;
      let totalLabs;
      let totalPages;
      let skip;
      if (search) {
        const regex = new RegExp(search, "i"); // Create a case-insensitive regular expression
        totalLabs = await Laboratory.countDocuments({
          name: regex,
          paidActivation: true,
          blocked: false,
        });
        totalPages = Math.ceil(totalLabs / labPerPage); // Calculate the total number of pages
        skip = (page - 1) * labPerPage; // Calculate the number of posts to skip based on the current page
        labs = await Laboratory.find({
          name: regex,
          paidActivation: true,
          blocked: false,
        })
          .skip(skip)
          .limit(labPerPage);

        // Filter out the labs where criteriaId is null (no matching criteriaName)
      } else {
        totalLabs = await Laboratory.countDocuments({
          paidActivation: true,
          blocked: false,
        });
        totalPages = Math.ceil(totalLabs / labPerPage); // Calculate the total number of pages
        skip = (page - 1) * labPerPage;
        labs = await Laboratory.find({ paidActivation: true, blocked: false })
          .skip(skip)
          .limit(labPerPage)
          .skip(skip)
          .limit(labPerPage);
      }
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;
      return res.status(200).json({
        labs: labs,
        auth: true,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },

  async getAllInsurancePackages(req, res, next) {
    try {
      const type = req.query.type;
      let insuranceData = [];

      if (!type || (type !== "travel" && type !== "health")) {
        return res.status(400).json({
          success: false,
          message: "Invalid or missing 'type'. Use 'travel' or 'health'.",
        });
      }

      if (type === "travel") {
        const [familyTravel, individualTravel] = await Promise.all([
          FamilyTravel.find({}),
          IndividualTravel.find({}),
        ]);
        insuranceData = [...familyTravel, ...individualTravel];
      }

      if (type === "health") {
        const [individualHealth, familyHealth, parentHealth] =
          await Promise.all([
            IndividualHealth.find({}),
            FamilyHealth.find({}),
            ParentHealth.find({}),
          ]);
        insuranceData = [...individualHealth, ...familyHealth, ...parentHealth];
      }

      return res.status(200).json({
        success: true,
        data: insuranceData,
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = insuranceGeneralController;
