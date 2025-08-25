const Appointment = require("../../models/All Doctors Models/appointment");
const {
  DoctorAvailability,
} = require("../../models/All Doctors Models/availability");
const Doctors = require("../../models/Doctor/doctors");
const Rating = require("../../models/rating");
const Speciality = require("../../models/All Doctors Models/specialities");
const Doctor = require("../../models/Doctor/doctors");

const specialityController = {
  async getNearbySpecialityDoctors(req, res, next) {
    try {
      const specialityTitle = req.query.speciality;
      const lat = parseFloat(req.query.lat);
      const lng = parseFloat(req.query.long);
      const query = req.query.search;
      const radius = parseFloat(req.query.radius) || 10000;
      const page = parseInt(req.query.page, 10) || 1; // Default to page 1, ensure it's an integer
      const limit = 30; // Default to 10 doctors per page

      // Create a geospatial query for location
      let doctorQuery = {
        location: {
          $geoWithin: {
            $centerSphere: [[lng, lat], radius / 6378137], // Convert radius to radians
          },
        },
      };
      doctorQuery.blocked = false

      // Find the speciality based on the title
      const specialityDoc = await Speciality.findOne({ specialityTitle });

      // Check if the speciality exists
      if (!specialityDoc) {
        return res.status(404).json([]); // Send empty response
      }

      // If a search query is provided, use it to filter doctors by name
      if (query) {
        const regex = new RegExp(query, "i");
        doctorQuery.name = regex;
      }

      // Calculate the skip value based on the page and limit
      const totalDoctors = await Doctors.countDocuments(doctorQuery); // Get the total number of doctors
      const totalPages = Math.ceil(totalDoctors / limit);
      const skip = (page - 1) * limit;

      // Update location query for $near and $maxDistance
      doctorQuery.location = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          $maxDistance: radius,
        },
      };

      // Fetch the doctors based on the query, skip, and limit
      const doctors = await Doctors.find(doctorQuery).skip(skip).limit(limit);

      // Determine previous and next pages
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Return the list of doctors and pagination details
      res.status(200).json({
        doctors,
        nextPage,
        previousPage,
        totalDoctors,
        totalPages,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },
  async filterSpecialityDocs(req, res, next) {
    try {
      const specialityTitle = req.query.speciality;
      const minRating = parseFloat(req.query.minRating) || 0; // Default to minimum rating 0
      const latitude = parseFloat(req.query.lat);
      const longitude = parseFloat(req.query.long);
      const radius = parseInt(req.query.radius) || 100000; // Default to 100,000 meters
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 10; // Default to 10 docs per page

      // Check if latitude and longitude are provided and valid
      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({
          error:
            "Latitude and longitude are required and must be valid numbers",
        });
      }

      // Create a geospatial query for location
      const locationQuery = {
        location: {
          $geoWithin: {
            $centerSphere: [[longitude, latitude], radius / 6378.1], // Convert radius from meters to radians
          },
          },
        }
  

      // Find the speciality based on the title
      const specialityDoc = await Speciality.findOne({ specialityTitle });
      if (!specialityDoc) {
        return res.status(404).json([]); // Send empty response
      }

      // Fetch doctors from the database based on the speciality and location
      const doctorsQuery = {
        ...locationQuery,
        speciality: specialityTitle,
        averageRating: { $gte: minRating },
      };

      const skip = (page - 1) * limit;
      const totalResults = await Doctor.countDocuments(doctorsQuery);
      const totalPages = Math.ceil(totalResults / limit);
      const doctors = await Doctor.find(doctorsQuery).skip(skip).limit(limit);

      // Determine next and previous pages
      const nextPage = page < totalPages ? page + 1 : null;
      const prevPage = page > 1 ? page - 1 : null;

      // Return the list of doctors
      res.status(200).json({ doctors, totalPages, nextPage, prevPage,totalCounts:totalResults });
    } catch (error) {
      return next(error);
    }
  },
  async getAllSpecialityDoctors(req, res, next) {
    try {
      const specialityTitle = req.query.speciality;
      const latitude = parseFloat(req.query.lat);
      const searchValue = req.query.search;
      const longitude = parseFloat(req.query.long); // New parameter for speciality
      const radius = parseInt(req.query.radius) || 10000; // Default to 10,000 meters
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 5; // Default to 5 docs per page

      // Create a geospatial query for location
      let doctorQuery = {
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            $maxDistance: radius,
          },
        },
      };

      // Find the speciality based on the title
      const specialityDoc = await Speciality.findOne({
        specialityTitle: specialityTitle,
      });

      // Check if the speciality exists
      if (!specialityDoc) {
        return res.status(404).json([]); // Send empty response
      }

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalDoctors / limit);

      // Calculate the skip value based on the page and limit
      const skip = (page - 1) * limit;

      // Fetch doctors from the database based on the speciality
      const doctors = await Doctors.find({ speciality: specialityTitle })
        .skip(skip)
        .limit(limit);
      if (searchValue) {
        const regex = new RegExp(searchValue, "i");
        doctorQuery.$or = [{ name: regex }, { speciality: regex }];
      }
      // Determine next and previous pages
      const nextPage = page < totalPages ? page + 1 : null;
      const prevPage = page > 1 ? page - 1 : null;

      // Return the list of doctors
      res.status(200).json({ doctors: doctors });
    } catch (error) {
      return next(error);
    }
  },
  async searchSpecialityDoctors(req, res, next) {
    try {
      const { name, speciality } = req.query;

      // Check if speciality is provided
      if (!speciality) {
        return res.status(400).json({ error: "Speciality is required" });
      }

      let query = { speciality, isVerified: true }; // Ensure isVerified is true

      // Add name to query if provided
      if (name) {
        query.name = { $regex: new RegExp(name, "i") };
      }

      // Use distinct to get unique doctors based on the _id field
      const doctors = await Doctors.distinct("_id", query);

      // If no doctors are found, return a 404 response

      // Fetch the full doctor details for the unique doctor IDs
      const uniqueDoctors = await Doctors.find({ _id: { $in: doctors }, paidActivation: true });

      res.status(200).json({ doctors: uniqueDoctors });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },
  async getSpecialities(req, res, next) {
    try {
      const page = parseInt(req.query.page); // Get the page number from the query parameter, if provided
      const specialityTitlePerPage = 10;
      
      const totalSpecialities = await Speciality.countDocuments({}); // Get the total number of specialities
  
      let specialitiesQuery = Speciality.find({}).sort({ createdAt: 1 });
  
      if (page) {
        // Apply pagination only if `page` is specified in the query
        const skip = (page - 1) * specialityTitlePerPage; // Calculate the number of specialities to skip
        specialitiesQuery = specialitiesQuery.skip(skip).limit(specialityTitlePerPage);
      }
  
      const specialities = await specialitiesQuery; // Execute the query
  
      const specialitiesWithDoctorsCount = await Promise.all(
        specialities.map(async (speciality) => {
          const doctorCount = await Doctors.countDocuments({
            speciality: speciality.specialityTitle,
            paidActivation: true,
            blocked: false,
          });
  
          return {
            specialityTitle: speciality.specialityTitle,
            doctorsCount: doctorCount,
          };
        })
      );
  
      const totalDoctors = await Doctor.countDocuments({ paidActivation: true });
  
      let previousPage = page && page > 1 ? page - 1 : null;
      let nextPage = page && page < Math.ceil(totalSpecialities / specialityTitlePerPage) ? page + 1 : null;
      const totalPages= Math.ceil(totalSpecialities / specialityTitlePerPage);
  
      return res.status(200).json({
        specialities: specialitiesWithDoctorsCount,
        totalDoctors,
        totalSpecialities,
        auth: true,
        totalPages,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = specialityController;
