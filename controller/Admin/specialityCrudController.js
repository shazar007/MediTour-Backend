const Joi = require("joi");
const SpecialityDTO = require("../../dto/specialityDto.js");
const JWTService = require("../../services/JWTService.js");
const Speciality = require("../../models/All Doctors Models/specialities.js");
const doctors = require("../../models/Doctor/doctors.js");

const specalityCrudController = {
  async addSpeciality(req, res, next) {
    // Define the validation schema for the speciality
    const specialitySchema = Joi.object({
      specialityTitle: Joi.string().required(),
    });

    // Validate the request body against the schema
    const { error } = specialitySchema.validate(req.body);
    if (error) {
      return res
        .status(400)
        .json({ message: error.details[0].message, auth: false });
    }

    // Extract the fields from the request body
    const {
      specialityTitle,
    } = req.body;

    try {
      // Check if a speciality with the same title already exists
      const existingSpeciality = await Speciality.findOne({
        specialityTitle: { $regex: `^${specialityTitle}$`, $options: "i" }
      });
      if (existingSpeciality) {
        return res
          .status(409)
          .json({ message: "Speciality already exists.", auth: false });
      }

      // If not, create a new speciality
      const specialityToRegister = new Speciality({
        specialityTitle,
        // subSpecialities
      });

      // Save the new speciality to the database
      const speciality = await specialityToRegister.save();

      // Return the created speciality in the response
      return res.status(201).json({ speciality: speciality, auth: true });
    } catch (error) {
      // Handle any other errors
      return next(error);
    }
  },
  async deleteSpeciality(req, res, next) {
    const specialityTitleId = req.query.specialityTitleId;
    const existingspecialityTitle = await Speciality.findById(
      specialityTitleId
    );

    if (!existingspecialityTitle) {
      return res.status(404).json([]);
    }
    await Speciality.deleteOne({ _id: specialityTitleId });
    return res.status(200).json({ message: "Speciality deleted successfully" });
  },

  async getAllSpecialities(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const specialityTitlePerPage = 10;
      const searchTerm = req.query.search || ""; // Extract the search term from the query parameter

      // Create a regex for case-insensitive partial matching if searchTerm is provided
      const searchFilter = searchTerm
        ? { specialityTitle: { $regex: searchTerm, $options: "i" } }
        : {};

      // Get the total number of specialities that match the search term
      const totalSpecialities = await Speciality.countDocuments(searchFilter);

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalSpecialities / specialityTitlePerPage);

      // Calculate the number of specialities to skip based on the current page
      const skip = (page - 1) * specialityTitlePerPage;

      // Find the specialities that match the search term with pagination
      const specialities = await Speciality.find(searchFilter)
        .skip(skip)
        .limit(specialityTitlePerPage)
        .lean(); // Convert documents to plain JavaScript objects

      // Get the number of doctors for each speciality
      const specialitiesWithDoctorsCount = await Promise.all(
        specialities.map(async (speciality) => {
          const doctorCount = await doctors.countDocuments({
            speciality: speciality.specialityTitle,
          });

          return {
            _id: speciality._id, // Include ObjectId in the response
            specialityTitle: speciality.specialityTitle,
            doctorsCount: doctorCount,
            totalSpecialities:totalSpecialities
          };
        })
      );

      // Determine previous and next pages
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Return the response with the list of specialities, pagination, and authentication status
      return res.status(200).json({
        specialities: specialitiesWithDoctorsCount,
        auth: true,
        previousPage: previousPage,
        totalPages,
        totalSpecialities,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
};
module.exports = specalityCrudController;
