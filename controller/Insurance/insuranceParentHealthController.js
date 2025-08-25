const ParentHealth = require("../../models/Insurance/parentsHealthInsurance.js");
const Joi = require("joi");
const parentHealthDTO = require("../../dto/Insurance/parentHealth.js");
const Insurance = require("../../models/Insurance/insurance.js");

const insuranceHealthController = {
  async addParentHealth(req, res, next) {
    const insuranceRegisterSchema = Joi.object({
      ageCriteria: Joi.object(),
      hospitalizationLimit: Joi.object(),
      packageName: Joi.string(),
      packageLogo: Joi.string(),
      hospitalizationPerPerson: Joi.string(),
      dailyRoomAndBoardLimit: Joi.string(),
      claimPayoutRatio: Joi.string(),
      packageDescription: Joi.string(),
      hospitals: Joi.array(),
      laboratories: Joi.array(),
      icuCcuLimits: Joi.string(),
      accidentalEmergencyLimits: Joi.string(),
      ambulanceCoverage: Joi.string(),
      specializedInvestigationCoverage: Joi.string(),
      waitingPeriod: Joi.string(),
      maternity: Joi.string(),
      policyDocument: Joi.string(),
      claimProcess: Joi.string(),
      heading: Joi.string(),
      description: Joi.string(),
      actualPrice: Joi.string(),
      perYear: Joi.string(),
    });

    const { error } = insuranceRegisterSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const {
      ageCriteria,
      hospitalizationLimit,
      packageName,
      packageLogo,
      hospitalizationPerPerson,
      dailyRoomAndBoardLimit,
      claimPayoutRatio,
      packageDescription,
      hospitals,
      laboratories,
      icuCcuLimits,
      accidentalEmergencyLimits,
      ambulanceCoverage,
      specializedInvestigationCoverage,
      waitingPeriod,
      maternity,
      policyDocument,
      claimProcess,
      heading,
      description,
      actualPrice,
      perYear,
    } = req.body;

    let insurance;
    const insuranceId = req.user._id;
    const insuranceCompany = await Insurance.findById(insuranceId);
    // if (!insuranceCompany.paidActivation) {
    //   const error = {
    //     status: 403,
    //     message: "Please pay the activation fee to activate your account",
    //   };
    //   return next(error);
    // }
    try {
      const insuranceToRegister = new ParentHealth({
        insuranceId,
        ageCriteria,
        hospitalizationLimit,
        packageName,
        packageLogo,
        hospitalizationPerPerson,
        dailyRoomAndBoardLimit,
        claimPayoutRatio,
        packageDescription,
        hospitals,
        laboratories,
        icuCcuLimits,
        accidentalEmergencyLimits,
        ambulanceCoverage,
        specializedInvestigationCoverage,
        waitingPeriod,
        maternity,
        policyDocument,
        claimProcess,
        heading,
        description,
        actualPrice,
        perYear,
      });

      insurance = await insuranceToRegister.save();
      const parentHealthDto = new parentHealthDTO(insurance);

      return res.status(201).json({ insurance: parentHealthDto, auth: true });
    } catch (error) {
      return next(error);
    }
  },

  async editParentHealth(req, res, next) {
    const insuranceHealthSchema = Joi.object({
      ageCriteria: Joi.object(),
      hospitalizationLimit: Joi.object(),
      packageName: Joi.string(),
      packageLogo: Joi.string(),
      hospitalizationPerPerson: Joi.string(),
      dailyRoomAndBoardLimit: Joi.string(),
      claimPayoutRatio: Joi.string(),
      packageDescription: Joi.string(),
      hospitals: Joi.array(),
      laboratories: Joi.array(),
      icuCcuLimits: Joi.string(),
      accidentalEmergencyLimits: Joi.string(),
      ambulanceCoverage: Joi.string(),
      specializedInvestigationCoverage: Joi.string(),
      waitingPeriod: Joi.string(),
      maternity: Joi.string(),
      policyDocument: Joi.string(),
      claimProcess: Joi.string(),
      heading: Joi.string(),
      description: Joi.string(),
      actualPrice: Joi.string(),
      perYear: Joi.string(),
    });

    const { error } = insuranceHealthSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      ageCriteria,
      hospitalizationLimit,
      packageName,
      packageLogo,
      hospitalizationPerPerson,
      dailyRoomAndBoardLimit,
      claimPayoutRatio,
      packageDescription,
      hospitals,
      laboratories,
      icuCcuLimits,
      accidentalEmergencyLimits,
      ambulanceCoverage,
      specializedInvestigationCoverage,
      waitingPeriod,
      maternity,
      policyDocument,
      claimProcess,
      heading,
      description,
      actualPrice,
      perYear,
    } = req.body;

    const insuranceHealthId = req.query.insuranceHealthId;
    const existingInsurance = await ParentHealth.findById(insuranceHealthId);

    if (!existingInsurance) {
      return res.status(404).json([]);
    }

    // Update only the provided fields
    if (ageCriteria) existingInsurance.ageCriteria = ageCriteria;
    if (hospitalizationLimit)
      existingInsurance.hospitalizationLimit = hospitalizationLimit;
    if (packageName) existingInsurance.packageName = packageName;
    if (packageLogo) existingInsurance.packageLogo = packageLogo;
    if (hospitalizationPerPerson)
      existingInsurance.hospitalizationPerPerson = hospitalizationPerPerson;
    if (dailyRoomAndBoardLimit)
      existingInsurance.dailyRoomAndBoardLimit = dailyRoomAndBoardLimit;
    if (claimPayoutRatio) existingInsurance.claimPayoutRatio = claimPayoutRatio;
    if (packageDescription)
      existingInsurance.packageDescription = packageDescription;
    if (hospitals) existingInsurance.hospitals = hospitals;
    if (laboratories) existingInsurance.laboratories = laboratories;
    if (icuCcuLimits) existingInsurance.icuCcuLimits = icuCcuLimits;
    if (accidentalEmergencyLimits)
      existingInsurance.accidentalEmergencyLimits = accidentalEmergencyLimits;
    if (ambulanceCoverage)
      existingInsurance.ambulanceCoverage = ambulanceCoverage;
    if (specializedInvestigationCoverage)
      existingInsurance.specializedInvestigationCoverage =
        specializedInvestigationCoverage;
    if (waitingPeriod) existingInsurance.waitingPeriod = waitingPeriod;
    if (maternity) existingInsurance.maternity = maternity;
    if (policyDocument) existingInsurance.policyDocument = policyDocument;
    if (claimProcess) existingInsurance.claimProcess = claimProcess;
    if (heading) existingInsurance.heading = heading;
    if (description) existingInsurance.description = description;
    if (actualPrice) existingInsurance.actualPrice = actualPrice;
    if (perYear) existingInsurance.perYear = perYear;

    // Save the updated test
    await existingInsurance.save();

    return res.status(200).json({
      message: "Parent Health updated successfully",
      insurance: existingInsurance,
    });
  },

  async deleteParentHealth(req, res, next) {
    try {
      const insuranceHealthId = req.query.insuranceHealthId;
  
      // Check if insuranceHealthId is missing or empty
      if (!insuranceHealthId) {
        return res.status(400).json([]); // Return empty array for missing or empty insuranceHealthId
      }
  
      // Find the parent health insurance by ID
      const existingInsurance = await ParentHealth.findById(insuranceHealthId);
  
      if (!existingInsurance) {
        return res.status(404).json([]); // Return empty array if no insurance is found
      }
  
      // Delete the parent health insurance
      await ParentHealth.findByIdAndDelete(insuranceHealthId);
  
      return res
        .status(200)
        .json({ message: "Parent Health deleted successfully" });
    } catch (error) {
      return res.status(500).json([]); // Return empty array for any unexpected errors
    }
  },

  async getParentHealth(req, res, next) {
    try {
      const insuranceHealthId = req.query.insuranceHealthId;
      const existingInsurance = await ParentHealth.findById(insuranceHealthId);

      if (!existingInsurance) {
        return res.status(404).json([]);
      }
      return res.status(200).json({ existingInsurance });
    } catch (error) {
      return next(error);
    }
  },

  async getAllParentHealth(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const insurancePerPage = 10;
      const insuranceId = req.user._id;
      const totalinsurance = await ParentHealth.countDocuments({ insuranceId }); // Get the total number of posts for the user
      const totalPages = Math.ceil(totalinsurance / insurancePerPage); // Calculate the total number of pages

      const skip = (page - 1) * insurancePerPage; // Calculate the number of posts to skip based on the current page

      const insurances = await ParentHealth.find({ insuranceId })
        .skip(skip)
        .sort({ createdAt: -1 })
        .limit(insurancePerPage)
        .populate("hospitals", "name logo")
        .populate("laboratories", "name logo");
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;
      return res.status(200).json({
        insurances: insurances,
        auth: true,
        previousPage: previousPage,
        nextPage: nextPage,
        totalPages,
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = insuranceHealthController;
