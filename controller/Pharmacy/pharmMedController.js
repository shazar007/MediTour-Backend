const Joi = require("joi");
const medDTO = require("../../dto/med.js");
const Medicine = require("../../models/Pharmacy/medicine.js");

const pharmMedController = {
  async addMed(req, res, next) {
    const pharmMedSchema = Joi.object({
      generic: Joi.string().required(),
      potency: Joi.string().required(),
      medicineBrand: Joi.string().required(),
      medicineType: Joi.string().required(),
      medicineImage: Joi.string().required(),
      packSize: Joi.string().required(),
      priceMeditour: Joi.number().required(),
      actualPrice: Joi.number().required(),
    });

    const { error } = pharmMedSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const pharmId = req.user._id;
    const {
      generic,
      potency,
      medicineBrand,
      medicineType,
      medicineImage,
      packSize,
    } = req.body;
    let { priceMeditour, actualPrice } = req.body;
    actualPrice = parseInt(actualPrice, 10);
    priceMeditour = parseInt(priceMeditour, 10);
    if (priceMeditour >= actualPrice) {
      const error = new Error("priceMeditour must be less than actualPrice");
      error.status = 400;
      return next(error);
    }

    // Calculate userAmount
    const priceDifference = actualPrice - priceMeditour;
    let amount = priceMeditour + 0.7 * priceDifference;
    const userAmount = Math.round(amount);
    const discount = actualPrice - userAmount;
    let med;

    let medCode = Math.floor(Math.random() * 1000000); // Generate a random number between 0 and 99999999

    try {
      const medToRegister = new Medicine({
        pharmId,
        medCode,
        generic,
        potency,
        medicineBrand,
        medicineType,
        medicineImage,
        packSize,
        priceMeditour,
        actualPrice,
        userAmount,
        discount,
      });

      med = await medToRegister.save();
    } catch (error) {
      return next(error);
    }

    // 6. response send

    const medDto = new medDTO(med);

    return res.status(201).json({ med: medDto, auth: true });
  },

  async editMed(req, res, next) {
    const pharmMedSchema = Joi.object({
      generic: Joi.string(),
      potency: Joi.string(),
      medicineBrand: Joi.string(),
      medicineType: Joi.string(),
      medicineImage: Joi.string(),
      packSize: Joi.string(),
      priceMeditour: Joi.number(),
      actualPrice: Joi.number(),
    });

    const { error } = pharmMedSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      generic,
      potency,
      medicineBrand,
      medicineType,
      medicineImage,
      packSize,
    } = req.body;
    let { priceMeditour, actualPrice } = req.body;
    const pharmId = req.user._id;
    actualPrice = parseInt(actualPrice, 10);
    priceMeditour = parseInt(priceMeditour, 10);
    const medId = req.query.medId;
    const existingMed = await Medicine.findById(medId);

    if (!existingMed) {
      return res.status(404).json([]);
    }

    // Update only the provided fields
    if (generic) existingMed.generic = generic;
    if (potency) existingMed.potency = potency;
    if (medicineBrand) existingMed.medicineBrand = medicineBrand;
    if (medicineType) existingMed.medicineType = medicineType;
    if (medicineImage) existingMed.medicineImage = medicineImage;
    if (packSize) existingMed.packSize = packSize;
    if (priceMeditour) existingMed.priceMeditour = priceMeditour;
    if (actualPrice) existingMed.actualPrice = actualPrice;

    if (actualPrice || priceMeditour) {
      const newPrice = actualPrice || existingMed.actualPrice;
      const newPriceForMeditour = priceMeditour || existingMed.priceMeditour;

      if (newPriceForMeditour >= newPrice) {
        const error = new Error("priceForMeditour must be less than price");
        error.status = 400;
        return next(error);
      }

      const priceDifference = newPrice - newPriceForMeditour;
      existingMed.userAmount = newPriceForMeditour + 0.7 * priceDifference;
      existingMed.userAmount = Math.round(existingMed.userAmount);
      existingMed.discount = actualPrice - existingMed.userAmount;
    }
    // Save the updated test
    await existingMed.save();

    return res
      .status(200)
      .json({
        message: "Medicine updated successfully",
        medicine: existingMed,
      });
  },

  async deleteMed(req, res, next) {
    const medId = req.query.medId;
    const existingMed = await Medicine.findById(medId);

    if (!existingMed) {
      return res.status(404).json([]);
    }
    await Medicine.findByIdAndDelete({ _id: medId });
    return res.status(200).json({ message: "Medicine deleted successfully" });
  },

  async getMed(req, res, next) {
    try {
      const medId = req.query.medId;
      const medicine = await Medicine.findById(medId);

      if (!medicine) {
        return res.status(404).json([]);
      }
      return res.status(200).json({ medicine });
    } catch (error) {
      return next(error);
    }
  },

  async getAllMeds(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const medPerPage = 10;
      const pharmId = req.user._id;

      // Get the total number of medicines for the pharmacy
      const totalMeds = await Medicine.countDocuments({ pharmId });

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalMeds / medPerPage);

      // Calculate the number of medicines to skip based on the current page
      const skip = (page - 1) * medPerPage;

      // Find all medicines for the pharmacy, sorted by createdAt field in descending order
      const medicines = await Medicine.find({ pharmId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(medPerPage);

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        medicines: medicines,
        auth: true,
        totalMeds,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
};
module.exports = pharmMedController;
