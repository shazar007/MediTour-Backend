const FamilyTravel = require("../../models/Insurance/familyTravelInsurance.js");
const Joi = require("joi");
const familyTravelDTO = require("../../dto/Insurance/familyTravel.js");
const Insurance = require("../../models/Insurance/insurance.js");

const insuranceTravelController = {
  async addFamilyTravel(req, res, next) {
    const insuranceRegisterSchema = Joi.object({
      packageName: Joi.string(),
      packageLogo: Joi.string(),
      packageDescription: Joi.string(),
      medicalCover: Joi.string(),
      coveringUpto: Joi.string(),
      packageCategory: Joi.string(),
      adndCoverage: Joi.string(),
      repatriationCoverage: Joi.string(),
      medExpensesHospitalizationCoverage: Joi.string(),
      emergencyReturnHomeCoverage: Joi.string(),
      tripCancellation: Joi.string(),
      luggageArrivalDelay: Joi.string(),
      flightDelay: Joi.string(),
      travelStayOverOneFamMember: Joi.string(),
      passportLoss: Joi.string(),
      baggageLoss: Joi.string(),
      policyDocument: Joi.string(),
      actualPrice: Joi.string(),
      perYear: Joi.string(),
      tripType: Joi.string(),
      countrySelection: Joi.string().required(),
    });

    const { error } = insuranceRegisterSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const {
      packageName,
      packageLogo,
      packageDescription,
      medicalCover,
      coveringUpto,
      packageCategory,
      adndCoverage,
      repatriationCoverage,
      medExpensesHospitalizationCoverage,
      emergencyReturnHomeCoverage,
      tripCancellation,
      luggageArrivalDelay,
      flightDelay,
      travelStayOverOneFamMember,
      passportLoss,
      baggageLoss,
      policyDocument,
      actualPrice,
      perYear,
      tripType,
      countrySelection,
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
      const insuranceToRegister = new FamilyTravel({
        insuranceId,
        packageName,
        packageLogo,
        packageDescription,
        medicalCover,
        coveringUpto,
        packageCategory,
        adndCoverage,
        repatriationCoverage,
        medExpensesHospitalizationCoverage,
        emergencyReturnHomeCoverage,
        tripCancellation,
        luggageArrivalDelay,
        flightDelay,
        travelStayOverOneFamMember,
        passportLoss,
        baggageLoss,
        policyDocument,
        actualPrice,
        perYear,
        tripType,
        countrySelection,
      });

      insurance = await insuranceToRegister.save();
      const familyTravelDto = new familyTravelDTO(insurance);

      return res.status(201).json({ insurance: familyTravelDto, auth: true });
    } catch (error) {
      return next(error);
    }
  },

  async editFamilyTravel(req, res, next) {
    const insuranceTravelSchema = Joi.object({
      packageName: Joi.string(),
      packageLogo: Joi.string(),
      packageDescription: Joi.string(),
      medicalCover: Joi.string(),
      coveringUpto: Joi.string(),
      packageCategory: Joi.string(),
      adndCoverage: Joi.string(),
      repatriationCoverage: Joi.string(),
      medExpensesHospitalizationCoverage: Joi.string(),
      emergencyReturnHomeCoverage: Joi.string(),
      tripCancellation: Joi.string(),
      luggageArrivalDelay: Joi.string(),
      flightDelay: Joi.string(),
      travelStayOverOneFamMember: Joi.string(),
      passportLoss: Joi.string(),
      baggageLoss: Joi.string(),
      policyDocument: Joi.string(),
      actualPrice: Joi.string(),
      perYear: Joi.string(),
      tripType: Joi.string(),
      countrySelection: Joi.string(),
    });

    const { error } = insuranceTravelSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      packageName,
      packageLogo,
      packageDescription,
      medicalCover,
      coveringUpto,
      packageCategory,
      adndCoverage,
      repatriationCoverage,
      medExpensesHospitalizationCoverage,
      emergencyReturnHomeCoverage,
      tripCancellation,
      luggageArrivalDelay,
      flightDelay,
      travelStayOverOneFamMember,
      passportLoss,
      baggageLoss,
      policyDocument,
      actualPrice,
      perYear,
      tripType,
      countrySelection,
    } = req.body;

    const insuranceTravelId = req.query.insuranceTravelId;
    const existingInsurance = await FamilyTravel.findById(insuranceTravelId);

    if (!existingInsurance) {
      return res.status(404).json([]);
    }

    // Update only the provided fields
    if (packageName) existingInsurance.packageName = packageName;
    if (packageLogo) existingInsurance.packageLogo = packageLogo;
    if (packageDescription)
      existingInsurance.packageDescription = packageDescription;
    if (medicalCover) existingInsurance.medicalCover = medicalCover;
    if (coveringUpto) existingInsurance.coveringUpto = coveringUpto;
    if (packageCategory) existingInsurance.packageCategory = packageCategory;
    if (adndCoverage) existingInsurance.adndCoverage = adndCoverage;
    if (repatriationCoverage)
      existingInsurance.repatriationCoverage = repatriationCoverage;
    if (medExpensesHospitalizationCoverage)
      existingInsurance.medExpensesHospitalizationCoverage =
        medExpensesHospitalizationCoverage;
    if (emergencyReturnHomeCoverage)
      existingInsurance.emergencyReturnHomeCoverage =
        emergencyReturnHomeCoverage;
    if (tripCancellation) existingInsurance.tripCancellation = tripCancellation;
    if (travelStayOverOneFamMember)
      existingInsurance.travelStayOverOneFamMember = travelStayOverOneFamMember;
    if (flightDelay) existingInsurance.flightDelay = flightDelay;
    if (passportLoss) existingInsurance.passportLoss = passportLoss;
    if (luggageArrivalDelay)
      existingInsurance.luggageArrivalDelay = luggageArrivalDelay;
    if (baggageLoss) existingInsurance.baggageLoss = baggageLoss;
    if (policyDocument) existingInsurance.policyDocument = policyDocument;
    if (actualPrice) existingInsurance.actualPrice = actualPrice;
    if (perYear) existingInsurance.perYear = perYear;
    if (tripType) existingInsurance.tripType = tripType;
    if (countrySelection) existingInsurance.countrySelection = countrySelection;

    // Save the updated test
    await existingInsurance.save();

    return res.status(200).json({
      message: "Family Travel updated successfully",
      insurance: existingInsurance,
    });
  },

  async deleteFamilyTravel(req, res, next) {
    try {
      const insuranceTravelId = req.query.insuranceTravelId;
  
      // Check if insuranceTravelId is missing or empty
      if (!insuranceTravelId) {
        return res.status(400).json([]); // Return empty array for missing or empty insuranceTravelId
      }
  
      // Find the travel insurance by ID
      const existingInsurance = await FamilyTravel.findById(insuranceTravelId);
  
      if (!existingInsurance) {
        return res.status(404).json([]); // Return empty array if no insurance is found
      }
  
      // Delete the travel insurance
      await FamilyTravel.findByIdAndDelete(insuranceTravelId);
  
      return res
        .status(200)
        .json({ message: "Family Travel deleted successfully" });
    } catch (error) {
      return res.status(500).json([]); // Return empty array for any unexpected errors
    }
  },
  async getFamilyTravel(req, res, next) {
    try {
      const insuranceTravelId = req.query.insuranceTravelId;
      const existingInsurance = await FamilyTravel.findById(insuranceTravelId);

      if (!existingInsurance) {
        return res.status(404).json([]);
      }
      return res.status(200).json({ existingInsurance });
    } catch (error) {
      return next(error);
    }
  },

  async getAllFamilyTravel(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const insurancePerPage = 10;
      const insuranceId = req.user._id;
      const tripType = req.query.tripType;
      let query = { insuranceId };

      if (tripType === "singleTrip" || tripType === "multipleTrips") {
        query.tripType = tripType;
      }

      const totalInsurance = await FamilyTravel.countDocuments(query); // Get the total number of insurances for the user

      const totalPages = Math.ceil(totalInsurance / insurancePerPage); // Calculate the total number of pages

      const skip = (page - 1) * insurancePerPage; // Calculate the number of insurances to skip based on the current page

      const insurances = await FamilyTravel.find(query)
        .skip(skip)
        .sort({ createdAt: -1 })
        .limit(insurancePerPage);

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

module.exports = insuranceTravelController;
