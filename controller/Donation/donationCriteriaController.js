const express = require("express");
const app = express();
const Donation = require("../../models/Donation/donationCompany.js");
const Package = require("../../models/Donation/package.js");
const Criteria = require("../../models/Donation/criteria.js");
const criteriaDTO = require("../../dto/criteria.js");
const Joi = require("joi");

const donationCriteriaController = {
  async addCriteria(req, res, next) {
    const donationCriteriaSchema = Joi.object({
      criteriaName: Joi.string().required(),
      description: Joi.string().required(),
      image: Joi.string().required(),
    });

    const { error } = donationCriteriaSchema.validate(req.body);

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
    const { criteriaName, description, image } = req.body;

    let criteria;

    try {
      const criteriaToRegister = new Criteria({
        donationId,
        criteriaName,
        description,
        image,
      });

      criteria = await criteriaToRegister.save();
    } catch (error) {
      return next(error);
    }

    // 6. response send

    const criteriaDto = new criteriaDTO(criteria);

    return res.status(201).json({ criteria: criteriaDto, auth: true });
  },

  async editCriteria(req, res, next) {
    const donationCriteriaSchema = Joi.object({
      criteriaName: Joi.string(),
      description: Joi.string(),
      image: Joi.string(),
    });

    const { error } = donationCriteriaSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const { criteriaName, description, image } = req.body;

    const criteriaId = req.query.criteriaId;
    const existingCriteria = await Criteria.findById(criteriaId);

    if (!existingCriteria) {
      return res.status(404).json([]);
    }

    // Update only the provided fields
    if (criteriaName) existingCriteria.criteriaName = criteriaName;
    if (description) existingCriteria.description = description;
    if (image) existingCriteria.image = image;

    // Save the updated test
    await existingCriteria.save();

    return res.status(200).json({
      message: "Criteria updated successfully",
      criteria: existingCriteria,
    });
  },

  async deleteCriteria(req, res, next) {
    try {
      const criteriaId = req.query.criteriaId;

      const existingCriteria = await Criteria.findById(criteriaId);
      if (!existingCriteria) {
        return res.status(404).json([]);
      }

      const associatedPackage = await Package.findOne({ criteriaId });
      if (associatedPackage) {
        const error = new Error(
          "Cannot delete criteria as it is associated with a package."
        );
        error.status = 400;
        return next(error);
      }

      await Criteria.findByIdAndDelete(criteriaId);
      return res.status(200).json({ message: "Criteria deleted successfully" });
    } catch (error) {
      // Handle errors
      return next(error);
    }
  },

  async getCriteria(req, res, next) {
    try {
      const criteriaId = req.query.criteriaId;
      const criteria = await Criteria.findById(criteriaId);

      if (!criteria) {
        return res.status(404).json([]);
      }
      return res.status(200).json({ criteria });
    } catch (error) {
      return next(error);
    }
  },

  async getAllCriterion(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const criterionPerPage = 30;
      const donationId = req.user._id;

      // Get the total number of criterion
      const totalCriterion = await Criteria.countDocuments({ donationId });

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalCriterion / criterionPerPage);

      // Calculate the number of criterion to skip based on the current page
      const skip = (page - 1) * criterionPerPage;

      // Fetch criterion, sorted by creation date in descending order
      const criterion = await Criteria.find({ donationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(criterionPerPage);

      // Determine previous and next page numbers
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;
      const totalCount = criterion.length;
      // Return the response
      return res.status(200).json({
        criterion: criterion,
        totalCount: totalCount,
        auth: true,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = donationCriteriaController;
