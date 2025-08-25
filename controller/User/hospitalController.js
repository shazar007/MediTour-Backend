const Hospital = require("../../models/Hospital/hospital");
const mongoose = require("mongoose");
const Pharmacies = require("../../models/Pharmacy/pharmacy");
const Labs = require("../../models/Laboratory/laboratory");
const Doctor = require("../../models/Doctor/doctors");
const Department = require("../../models/Hospital/department");
const BookTreatment = require("../../models/All Doctors Models/bookTreatment");
const Treatment = require("../../models/All Doctors Models/treatments");
const Appointment = require("../../models/All Doctors Models/appointment");
const DoctorAvailability = require("../../models/All Doctors Models/availability");

const userLabController = {
  async getNearbyHospitals(req, res, next) {
    try {
      // Extract and parse query parameters
      const latitude = parseFloat(req.query.lat);
      const longitude = parseFloat(req.query.long);
      const radius = parseInt(req.query.radius) || 10000; // Default to 10,000 meters
      const name = req.query.search; // Search by name
      const city = req.query.city; // Filter by city
      const country = req.query.country;
      const filterTypes = req.query.filter
        ? req.query.filter.split(",")
        : ["all"]; // Allow multiple filters
      const page = req.query.page ? parseInt(req.query.page) : null; // Null if not provided
      const limit = 12; // Default to 12 hospitals per page

      // Initialize the base query object
      let hospitalFindQuery = {
        blocked: false,
        paidActivation: true,
      };

      // Apply search query if provided
      if (name) {
        const regex = new RegExp(name, "i"); // Case-insensitive regex
        hospitalFindQuery.name = regex;
      }

      // Handle multiple filters
      if (filterTypes.includes("recommended")) {
        hospitalFindQuery.isRecommended = true; // Filter by recommended status
      }
      if (filterTypes.includes("country")) {
        hospitalFindQuery.country = country;
      }
      if (filterTypes.includes("city") && city) {
        hospitalFindQuery["location.city"] = city.trim(); // Filter by city
      }

      if (filterTypes.includes("nearby")) {
        if (!isNaN(latitude) && !isNaN(longitude)) {
          hospitalFindQuery.location = {
            $geoWithin: {
              $centerSphere: [[longitude, latitude], radius / 6378137], // Radius in radians
            },
          };
        } else {
          return res
            .status(400)
            .json({ error: "Invalid latitude or longitude for nearby filter" });
        }
      }

      let hospitalsQuery = Hospital.find(hospitalFindQuery);

      // Apply pagination only if page is provided
      if (page) {
        const totalHospitals = await Hospital.countDocuments(hospitalFindQuery);
        const totalPages = Math.ceil(totalHospitals / limit);
        const skip = (page - 1) * limit;
        hospitalsQuery = hospitalsQuery.skip(skip).limit(limit);
      }

      // Sorting logic based on the filter type
      if (filterTypes.includes("all") || filterTypes.includes("city")) {
        hospitalsQuery = hospitalsQuery.sort({
          isRecommended: -1, // Recommended first
          averageRating: -1, // Sort by rating within each group
        });
      } else if (filterTypes.includes("recommended")) {
        hospitalsQuery = hospitalsQuery.sort({ averageRating: -1 }); // Sort only by rating
      }

      let hospitals = await hospitalsQuery.exec();

      // Convert averageRating to a plain number
      hospitals = await Promise.all(
        hospitals.map(async (hospital) => {
          if (hospital.averageRating && hospital.averageRating.$numberDecimal) {
            hospital.averageRating = parseFloat(
              hospital.averageRating.$numberDecimal
            );
          }

          // Count total doctors associated with the hospital
          const doctorCount = await Doctor.countDocuments({
            "hospitalIds.hospitalId": hospital._id,
          });

          const formattedTreatments = await Department.find({
            hospitalId: hospital._id,
            isActive: true,
          })
            .populate({
              path: "categoryId",
              select: "categoryName", // Only fetch the 'name' field
            })
            .select("categoryId");

          const treatments = formattedTreatments
            .flat()
            .filter((t) => t.categoryId && t.categoryId.categoryName)
            .map((t) => t.categoryId.categoryName);

          // Aggregate doctors based on department (treatment specialization)
          const treatmentDoctorCount = await BookTreatment.countDocuments({
            hospitalId: hospital._id,
          });

          return {
            ...hospital.toObject(),
            doctorCount,
            treatmentDoctorCount,
            treatments,
          };
        })
      );

      const previousPage = page && page > 1 ? page - 1 : null;
      const nextPage = page && page < Math.ceil(hospitals.length / limit) ? page + 1 : null;

      return res.status(200).json({
        hospitals,
        previousPage,
        nextPage,
        totalPages: page ? Math.ceil(hospitals.length / limit) : 1,
        totalHospitals: hospitals.length,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },

  async filterHospitals(req, res, next) {
    try {
      const minRating = parseFloat(req.query.minRating) || 0;
      const longitude = parseFloat(req.query.long);
      const latitude = parseFloat(req.query.lat);
      const radius = parseInt(req.query.radius) || 10000; // Default radius in meters
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 10; // Default to 10 hospitals per page

      // Validate coordinates
      if (isNaN(longitude) || isNaN(latitude)) {
        return res
          .status(400)
          .json({ message: "Invalid latitude or longitude" });
      }

      // Geospatial query to find hospitals within the specified radius
      const hospitalsWithinRadius = await Hospital.find({
        location: {
          $geoWithin: {
            $centerSphere: [[longitude, latitude], radius / 6378.1], // Convert radius from meters to radians
          },
        },
      });

      // Get IDs of hospitals within the radius
      const hospitalIdsWithinRadius = hospitalsWithinRadius.map(
        (hospital) => hospital._id
      );

      // Calculate total number of hospitals matching the criteria
      const totalHospitals = await Hospital.countDocuments({
        _id: { $in: hospitalIdsWithinRadius },
        averageRating: { $gte: minRating },
      });

      // Calculate total pages
      const totalPages = Math.ceil(totalHospitals / limit);

      // Calculate the number of hospitals to skip based on the current page
      const skip = (page - 1) * limit;

      // Fetch the paginated list of hospitals matching the criteria
      const hospitals = await Hospital.find({
        _id: { $in: hospitalIdsWithinRadius },
        averageRating: { $gte: minRating },
      })
        .skip(skip)
        .limit(limit);

      // Determine previous and next page numbers
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Return the paginated hospitals with pagination details
      res.status(200).json({
        hospitals,
        currentPage: page,
        totalPages,
        previousPage,
        nextPage,
        totalHospitals,
      });
    } catch (error) {
      next(error);
    }
  },

  async getHospital(req, res, next) {
    try {
      const hospitalId = req.query.hospitalId;

      const hospital = await Hospital.findById(hospitalId);
      if (!hospital) {
        return res.status(404).json([]); // Send empty response
      }
      // Check if doctors are associated with the hospital
      const doctors = await Doctor.find({
        "hospitalIds.hospitalId": hospitalId,
      });

      const doctorCount = await Doctor.countDocuments({
        "hospitalIds.hospitalId": hospitalId,
      });
      const formattedTreatments = await Department.find({
        hospitalId,
        isActive: true,
      })
        .populate({
          path: "categoryId",
          select: "categoryName", // Only fetch the 'name' field
        })
        .select("categoryId"); // Select required fields

      console.log("formattedTreatments", formattedTreatments);
      // let formattedResults = [];
      const treatments = formattedTreatments
        .flat() // Flatten the array in case of nested arrays
        .filter((t) => t.categoryId && t.categoryId.categoryName) // Remove empty objects (empty arrays)
        .map((t) => t.categoryId.categoryName); // Extract only the subCategory values
      const treatmentDoctorCount = await BookTreatment.countDocuments({
        hospitalId,
      });
      return res
        .status(200)
        .json({ hospital, doctorCount, treatmentDoctorCount, treatments });
    } catch (error) {
      return next(error);
    }
  },

  async getHospitalDocs(req, res, next) {
    try {
      const hospitalId = req.query.hospitalId;

      // Fetch doctors associated with the hospital
      const doctors = await Doctor.find({
        "hospitalIds.hospitalId": hospitalId,
        paidActivation: true,
        blocked: false,
      });

      // If no doctors found, return early
      if (!doctors.length) {
        return res.status(200).json({ doctors: [] });
      }

      // Extract doctorIds to query availability
      const doctorIds = doctors.map((doc) => doc._id);
      console.log("doctorIds", doctorIds);

      // Fetch availability for the doctors in this hospital
      const doctorAvailabilities = await DoctorAvailability.find({
        doctorId: { $in: doctorIds },
        "hospitalAvailability.hospitalId": hospitalId,
      }).select("doctorId hospitalAvailability");
      console.log("doctorAvailabilities", doctorAvailabilities);

      // Create a map of doctorId -> hospital availability
      const availabilityMap = new Map();
      doctorAvailabilities.forEach((availability) => {
        if (
          availability.hospitalAvailability &&
          Array.isArray(availability.hospitalAvailability)
        ) {
          const hospitalAvailability = availability.hospitalAvailability.find(
            (hosp) => hosp.hospitalId?._id.toString() === hospitalId
          );

          if (hospitalAvailability) {
            availabilityMap.set(
              availability.doctorId.toString(),
              hospitalAvailability
            );
          }
        }
      });

      // Attach full availability object to each doctor
      const formattedDoctors = doctors.map((doctor) => ({
        ...doctor.toObject(),
        availability: availabilityMap.get(doctor._id.toString()) || null, // Attach full availability object
      }));

      return res.status(200).json({ doctors: formattedDoctors });
    } catch (error) {
      console.error("Error in getHospitalDocs:", error);
      return next(error);
    }
  },
  async getHospLabsAndPharm(req, res, next) {
    try {
      const hospitalId = req.query.hospitalId;

      // Pagination variables
      const page = parseInt(req.query.page) || 1;
      const labsPerPage = 6;
      const skip = (page - 1) * labsPerPage;

      let totalResults = 0;
      let labs = [];
      let pharms = [];
      let count = 0;

      // Determine the type and execute the appropriate query
      if (req.query.type === "pharmacy") {
        totalResults = await Pharmacies.countDocuments({
          hospitalIds: { $in: [hospitalId] },
          paidActivation: true,
          isActive: true,
          blocked: false,
        });

        pharms = await Pharmacies.find({
          hospitalIds: { $in: [hospitalId] },
          paidActivation: true,
          isActive: true,
          blocked: false,
        })
          .skip(skip)
          .limit(labsPerPage);

        count = totalResults;

        // Send response for pharmacies
        return res.status(200).json({
          pharms,
          count,
          previousPage: page > 1 ? page - 1 : null,
          nextPage:
            page < Math.ceil(totalResults / labsPerPage) ? page + 1 : null,
          totalPages: Math.ceil(totalResults / labsPerPage),
          auth: true,
        });
      } else if (req.query.type === "labs") {
        totalResults = await Labs.countDocuments({
          hospitalIds: { $in: [hospitalId] },
          paidActivation: true,
          isActive: true,
          blocked: false,
        });

        labs = await Labs.find({
          hospitalIds: { $in: [hospitalId] },
          paidActivation: true,
          isActive: true,
          blocked: false,
        })
          .skip(skip)
          .limit(labsPerPage);

        count = totalResults;

        // Send response for labs
        return res.status(200).json({
          labs,
          count,
          previousPage: page > 1 ? page - 1 : null,
          nextPage:
            page < Math.ceil(totalResults / labsPerPage) ? page + 1 : null,
          totalPages: Math.ceil(totalResults / labsPerPage),
          auth: true,
        });
      } else {
        return res.status(400).json({
          message: 'Invalid type. Please specify either "pharmacy" or "labs".',
          auth: true,
        });
      }
    } catch (error) {
      next(error);
    }
  },
  async getAllDepartments(req, res, next) {
    try {
      const hospitalId = req.query.hospitalId; // This is expected to be an array of IDs
      const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
      const limit = parseInt(req.query.limit) || 30; // Default to 30 departments per page

      // Count the total number of departments for the specified hospitalIds and isActive=true
      const totalDepartments = await Department.countDocuments({
        hospitalId: { $in: [hospitalId] },
        isActive: true,
      });

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalDepartments / limit);

      // Calculate the number of departments to skip based on the current page
      const skip = (page - 1) * limit;

      // Fetch the paginated departments for the specified hospitalIds and isActive=true
      const departments = await Department.find({
        hospitalId: { $in: [hospitalId] },
        isActive: true,
      })
        .skip(skip)
        .limit(limit)
        .populate("hospitalId", "name email phoneNumber")
        .populate(
          "headDocId",
          "email phoneNumber name cnicOrPassportNo specialization"
        ) // Adjust fields based on your Doctor model
        .populate("doctorIds")
        .populate("categoryId", "categoryName"); // Adjust fields based on your Category model

      // Determine previous and next page numbers
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Return the paginated departments with pagination details
      return res.status(200).json({
        departments,
        currentPage: page,
        totalPages,
        previousPage,
        nextPage,
        totalDepartments,
      });
    } catch (error) {
      return next(error);
    }
  },
  async filterSimilarHospitals(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
      const limit = parseInt(req.query.limit) || 10; // Default to 10 hospitals per page

      // Count the total number of hospitals
      const totalHospitals = await Hospital.countDocuments({});

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalHospitals / limit);

      // Calculate the number of hospitals to skip based on the current page
      const skip = (page - 1) * limit;

      // Fetch hospitals sorted by averageRating in descending order with pagination
      let hospitals = await Hospital.find({})
        .sort({ averageRating: -1 })
        .skip(skip)
        .limit(limit);

      // Fetch doctor count for each hospital asynchronously
      hospitals = await Promise.all(
        hospitals.map(async (hospital) => {
          const doctorCount = await Doctor.countDocuments({
            "hospitalIds.hospitalId": hospital._id,
          });
          return { ...hospital.toObject(), doctorCount };
        })
      );

      // Determine previous and next page numbers
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Return the paginated list of hospitals with pagination metadata
      res.status(200).json({
        hospitals,
        currentPage: page,
        totalPages,
        previousPage,
        nextPage,
        totalHospitals,
      });
    } catch (error) {
      // Handle errors
      res.status(500).json({ message: "Internal server error" });
    }
  },
  async getDepartDocs(req, res, next) {
    try {
      const departmentId = req.query.departmentId;
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 30; // Default to 30 doctors per page
      const skip = (page - 1) * limit;

      // Find the department and populate only the doctorIds field
      // Find the department and populate categoryId and doctorIds with filters
      const department = await Department.findById(departmentId)
        .populate({
          path: "categoryId", // Populate categoryId for category name
          select: "categoryName", // Only select category name
        })
        .populate({
          path: "doctorIds", // Populate doctorIds field
          match: {
            paidActivation: true, // Include only active doctors
            blocked: false, // Exclude blocked doctors
          },
          options: { skip, limit }, // Apply pagination here
        })
        .select("doctorIds") // Select only doctorIds field, exclude other fields
        .exec();

      if (!department) {
        return res.status(404).json({ message: "Department not found." });
      }

      // Extract doctors from the populated field
      const doctors = department.doctorIds || [];

      // Calculate total number of doctors for pagination
      const totalDoctors = await Department.aggregate([
        { $match: { _id: mongoose.Types.ObjectId(departmentId) } },
        { $project: { count: { $size: "$doctorIds" } } },
      ]);

      const totalDoctorsCount = totalDoctors[0]?.count || 0;
      const totalPages = Math.ceil(totalDoctorsCount / limit);

      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Return paginated doctors
      res.status(200).json({
        doctors,
        currentPage: page,
        totalPages,
        previousPage,
        nextPage,
        totalDoctors: totalDoctorsCount,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = userLabController;
