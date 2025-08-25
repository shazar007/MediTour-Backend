const Joi = require("joi");
const medDTO = require("../../dto/med.js");
const Medicine = require("../../models/Pharmaceutical/medicine.js");
const Pharmaceutical = require("../../models/Pharmaceutical/pharmaceutical.js");
const Prescription = require("../../models/All Doctors Models/ePrescription");
const Generic = require("../../models/Pharmaceutical/generic.js");
const pharmMedController = {
  async addMed(req, res, next) {
    const pharmMedSchema = Joi.object({
      productType: Joi.string().required(),
      genericId: Joi.string().required(),
      brand: Joi.string().required(),
      strength: Joi.string().required(),
      packSize: Joi.number().required(),
      content: Joi.string().required(),
      tpPrice: Joi.number().required(),
      mrpPrice: Joi.number().required(),
      images: Joi.array().items(Joi.string()).min(0).optional(), // <--- Added
    });

    const { error } = pharmMedSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const pharmaceuticalId = req.user._id;
    const pharmaceutical = await Pharmaceutical.findById(pharmaceuticalId);
    // if (!pharmaceutical.paidActivation) {
    //   const error = {
    //     status: 403,
    //     message: "Please pay the activation fee to activate your account",
    //   };
    //   return next(error);
    // }
    let {
      productType,
      genericId,
      brand,
      strength,
      packSize,
      content,
      tpPrice,
      mrpPrice,
      images = [],
    } = req.body;
    const pricePerTab = Math.ceil(tpPrice / packSize);
    let med;
    productName = `${brand}, ${productType}, ${content}, ${strength}`;

    let medCode = Math.floor(Math.random() * 1000000);

    try {
      const medToRegister = new Medicine({
        pharmaceuticalId,
        medCode,
        productType,
        genericId,
        brand,
        productName,
        strength,
        packSize,
        pricePerTab,
        content,
        tpPrice,
        mrpPrice,
        images,
      });

      med = await medToRegister.save();
    } catch (error) {
      return next(error);
    }

    return res.status(201).json({ med: med, auth: true });
  },

  async editMed(req, res, next) {
    const pharmMedSchema = Joi.object({
      productType: Joi.string(),
      genericId: Joi.string(),
      brand: Joi.string(),
      strength: Joi.string(),
      packSize: Joi.number(),
      content: Joi.string(),
      tpPrice: Joi.number(),
      mrpPrice: Joi.number(),
      images: Joi.array().items(Joi.string()).min(0).optional(),
    });

    const { error } = pharmMedSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      productType,
      genericId,
      brand,
      strength,
      packSize,
      content,
      tpPrice,
      mrpPrice,
      images,
    } = req.body;

    const medId = req.query.medId;
    const existingMed = await Medicine.findById(medId);

    if (!existingMed) {
      return res.status(404).json([]);
    }

    // Update only the provided fields
    if (productType) existingMed.productType = productType;
    if (genericId) existingMed.genericId = genericId;
    if (brand) existingMed.brand = brand;
    if (strength) existingMed.strength = strength;
    let updatedPricePerTab = false;

    if (packSize) {
      existingMed.packSize = packSize;
      updatedPricePerTab = true;
    }

    if (tpPrice) {
      existingMed.tpPrice = tpPrice;
      updatedPricePerTab = true;
    }

    if (updatedPricePerTab) {
      existingMed.pricePerTab = Math.ceil(
        existingMed.tpPrice / existingMed.packSize
      );
    }

    // Update images if provided
    if (images && Array.isArray(images)) {
      existingMed.images = images;
    }

    if (content) existingMed.content = content;
    if (tpPrice) existingMed.tpPrice = tpPrice;
    if (mrpPrice) existingMed.mrpPrice = mrpPrice;
    await existingMed.save();
    if (brand && strength && content) {
      productName = `${brand}, ${productType}, ${content}, ${strength}`;
    }

    return res.status(200).json({
      message: "Medicine updated successfully",
      medicine: existingMed,
    });
  },

  async deleteMed(req, res, next) {
    const medId = req.query.medId;
    if (!medId) {
      return res.status(400).json([]); // Return empty array for missing medId
    }
    const existingMed = await Medicine.findById(medId);
    if (!existingMed) {
      return res.status(404).json([]);
    }
    // Remove the medicine from any prescriptions that reference it
    const updateResult = await Prescription.updateMany(
      { "medicines.medicineId": medId }, // Match prescriptions containing the medicine
      { $pull: { medicines: { medicineId: medId } } } // Pull the medicine object from the medicines array
    );

    // Optionally, check if any prescriptions were updated
    if (updateResult.nModified === 0) {
      console.log("No prescriptions found with this medicine");
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
      return res.status(500).json([]); // Return empty array on any unexpected error
    }
  },

  async getAllMeds(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const medPerPage = 10;
      const pharmaceuticalId = req.user._id;

      // Get the total number of medicines for the pharmacy
      const totalMeds = await Medicine.countDocuments({ pharmaceuticalId });

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalMeds / medPerPage);

      // Calculate the number of medicines to skip based on the current page
      const skip = (page - 1) * medPerPage;

      // Find all medicines for the pharmacy, sorted by createdAt field in descending order
      const medicines = await Medicine.find({ pharmaceuticalId })
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

  async searchGeneric(req, res, next) {
    try {
      const query = req.query.name;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const regex = new RegExp(query, "i");

      // Fetch matching generics
      const generics = await Generic.find({
        generic: regex,
      })
        .skip(skip)
        .limit(limit);

      const totalgenerics = await Generic.countDocuments({
        generic: regex,
      });

      const totalPages = Math.ceil(totalgenerics / limit);
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      res.json({
        generics,
        totalgenerics,
        auth: true,
        previousPage,
        nextPage,
        totalPages,
      });
    } catch (error) {
      return next(error);
    }
  },

  async addCustomGeneric(req, res, next) {
    try {
      const { name } = req.body;

      if (!name) {
        const error = new Error("Missing Parameters!");
        error.status = 400;
        return next(error);
      }
      let genericRegex = new RegExp(name, "i");
      const existingGeneric = await Generic.findOne({
        generic: { $regex: genericRegex },
      });
      if (existingGeneric) {
        const error = new Error("Generic already exists!");
        error.status = 409;
        return next(error);
      }
      const generic = new Generic({
        generic: name,
      });

      await generic.save();

      res.status(201).json({
        message: "Generic added successfully",
        generic: generic,
      });
    } catch (error) {
      next(error);
    }
  },
};
module.exports = pharmMedController;
