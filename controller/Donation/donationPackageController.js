const express = require("express");
const app = express();
const Donation = require("../../models/Donation/donationCompany.js");
const Package = require("../../models/Donation/package.js");
const DonorList = require("../../models/Donation/donations.js");
const Criteria = require("../../models/Donation/criteria.js");
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const donationDTO = require("../../dto/donation.js");
const packageDTO = require("../../dto/package.js");
const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

async function generateMRNo() {
  try {
    // Find the latest donor in the database and get their mrNo
    const latestDonor = await DonorList.findOne({}, "mrNo").sort({ mrNo: -1 });

    // If there are no donors yet, start with "000001"
    const nextMrNo = latestDonor
      ? String(Number(latestDonor.mrNo) + 1).padStart(6, "0")
      : "000001";

    return nextMrNo;
  } catch (error) {
    throw error;
  }
}

const donationPackageController = {
  async addPackage(req, res, next) {
    const donationPackageSchema = Joi.object({
      criteriaId: Joi.string().required(),
      donationTitle: Joi.string().required(),
      targetAudience: Joi.string().required(),
      requiredAmount: Joi.number().required(),
      totalDays: Joi.string().required(),
      description: Joi.string().required(),
      images: Joi.array().required(),
    });

    const { error } = donationPackageSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const donationId = req.user._id;
    const donation = await Donation.findById(donationId);
    // if (!donation.paidActivation) {
    //   const error = {
    //     status: 403,
    //     message: "Please pay the activation fee to activate your account",
    //   };
    //   return next(error);
    // }
    const {
      criteriaId,
      donationTitle,
      targetAudience,
      requiredAmount,
      totalDays,
      description,
      images,
    } = req.body;

    let package;

    try {
      const packageToRegister = new Package({
        criteriaId,
        donationId,
        donationTitle,
        targetAudience,
        requiredAmount,
        totalDays,
        description,
        images,
      });

      package = await packageToRegister.save();
    } catch (error) {
      return next(error);
    }

    // 6. response send

    const packageDto = new packageDTO(package);

    return res.status(201).json({ package: packageDto, auth: true });
  },

  async editPackage(req, res, next) {
    const donationPackageSchema = Joi.object({
      criteriaId: Joi.string(),
      donationTitle: Joi.string(),
      targetAudience: Joi.string(),
      requiredAmount: Joi.number(),
      totalDays: Joi.string(),
      description: Joi.string(),
      images: Joi.array(),
    });

    const { error } = donationPackageSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      criteriaId,
      donationTitle,
      targetAudience,
      requiredAmount,
      totalDays,
      description,
      images,
    } = req.body;

    const packageId = req.query.packageId;
    const existingPackage = await Package.findById(packageId);

    if (!existingPackage) {
      return res.status(404).json([]);
    }

    // Update only the provided fields
    if (criteriaId) existingPackage.criteriaId = criteriaId;
    if (donationTitle) existingPackage.donationTitle = donationTitle;
    if (targetAudience) existingPackage.targetAudience = targetAudience;
    if (requiredAmount) existingPackage.requiredAmount = requiredAmount;
    if (totalDays) existingPackage.totalDays = totalDays;
    if (description) existingPackage.description = description;
    if (images) existingPackage.images = images;

    // Save the updated test
    await existingPackage.save();

    return res.status(200).json({
      message: "Package updated successfully",
      package: existingPackage,
    });
  },

  async deletePackage(req, res, next) {
    const packageId = req.query.packageId;
    const existingPackage = await Package.findById(packageId);

    if (!existingPackage) {
      return res.status(404).json([]);
    }
    await Package.findByIdAndDelete({ _id: packageId });
    return res.status(200).json({ message: "Package deleted successfully" });
  },

  async getPackage(req, res, next) {
    try {
      const packageId = req.query.packageId;
      const package = await Package.findById(packageId);

      if (!package) {
        return res.status(404).json([]);
      }
      return res.status(200).json({ package });
    } catch (error) {
      return next(error);
    }
  },

  async getAllPackages(req, res, next) {
    try {
      const donationId = req.user._id;
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter or default to 1
      const packagePerPage = 10; // Number of packages to display per page
      const criteriaName = req.query.criteriaName; // Get the criteriaName from the query parameter

      // Get the criteria details for the provided criteriaName
      const criteriaDetails = await Criteria.findOne({
        donationId,
        criteriaName,
      });
      // concole.log(criteriaDetails)

      if (!criteriaDetails) {
        return res.status(404).json([]);
      }
      const criteriaId = criteriaDetails._id;
      // Get the total number of packages matching the criteria
      const totalPackages = await Package.countDocuments({
        criteriaId,
        donationId,
      });
      const totalPages = Math.ceil(totalPackages / packagePerPage); // Calculate the total number of pages

      const skip = (page - 1) * packagePerPage; // Calculate the number of packages to skip based on the current page

      // Retrieve packages matching the criteria, with pagination and sorting
      const packages = await Package.find({
        criteriaId,
        donationId,
      })
        .populate("criteriaId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(packagePerPage);

      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        packages: packages,
        auth: true,
        totalPackages,
        totalPages,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },

  async getAllPackagesWithoutCriteria(req, res, next) {
    try {
      const donationId = req.user._id;
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const packagePerPage = 10;
      // Get the total number of packages matching the criteria
      const totalPackages = await Package.countDocuments({
        donationId,
      });
      const totalPages = Math.ceil(totalPackages / packagePerPage); // Calculate the total number of pages

      const skip = (page - 1) * packagePerPage; // Calculate the number of packages to skip based on the current page

      // Retrieve packages matching the criteria, with pagination and sorting
      const packages = await Package.find({
        donationId,
      })
        .populate("criteriaId donationId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(packagePerPage);

      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        packages: packages,
        totalPages,
        previousPage: previousPage,
        nextPage: nextPage,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },

  async searchCriterion(req, res, next) {
    try {
      const donationId = req.user._id;
      const query = req.query.criteriaName;
      const regex = new RegExp(query, "i");

      const criterion = await Criteria.find({ criteriaName: regex });
      res.json({ criterion, auth: true });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = donationPackageController;
