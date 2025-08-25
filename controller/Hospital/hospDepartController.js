const express = require("express");
const app = express();
const Hospital = require("../../models/Hospital/hospital.js");
const Department = require("../../models/Hospital/department.js");
const Doctor = require("../../models/Doctor/doctors");
const Pharmacy = require("../../models/Pharmacy/pharmacy");
const Laboratory = require("../../models/Laboratory/laboratory");
const mongoose = require("mongoose");
const Category = require("../../models/All Doctors Models/categories.js");
const Treatment = require("../../models/All Doctors Models/treatments.js");
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const departDTO = require("../../dto/department.js");
const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");

const hospDepartController = {
  // async addDepart(req, res, next) {
  //   const hospitalId = req.user._id;
  //   const hospDepartSchema = Joi.object({
  //     departmentName: Joi.string().required(),
  //     dapartmentLogo: Joi.string().required(),
  //   });

  //   const { error } = hospDepartSchema.validate(req.body);

  //   if (error) {
  //     return next(error);
  //   }
  //   const { departmentName, dapartmentLogo } = req.body;
  //   let depart;
  //   try {
  //     const hospToRegister = new Department({
  //       hospitalId,
  //       departmentName,
  //       dapartmentLogo,
  //     });

  //     depart = await hospToRegister.save();
  //   } catch (error) {
  //     return next(error);
  //   }

  //   const departDto = new departDTO(depart);

  //   return res.status(201).json({ department: departDto, auth: true });
  // },

  async editDepartment(req, res, next) {
    const hospitalId = req.user._id; // Assuming hospitalId is derived from user token
    try {
        const { departmentId, headDocId } = req.body;

        // Validate input parameters
        if (!departmentId || !headDocId) {
            return res.status(400).json({
                message: "Department and director are required.",
            });
        }

        // Find the department and populate fields
        let department = await Department.findById(departmentId)
            .populate("headDocId", "name specialization email phoneNumber headDoc") // Include headDoc flag
            .populate("hospitalId", "name")
            .populate({
                path: "categoryId",
                select: "categoryName",
            });

        if (!department) {
            return res.status(404).json({ message: "Department not found" });
        }

        // Check if the new doctor exists
        const newHeadDoctor = await Doctor.findById(headDocId);

        if (!newHeadDoctor) {
            return res.status(404).json({ message: "New Head Doctor not found" });
        }

        // Get the current head doctor
        const previousHeadDoctor = await Doctor.findById(department.headDocId);

        // Update the current head doctor to false
        if (previousHeadDoctor) {
            previousHeadDoctor.isHeadDoc = false;
            await previousHeadDoctor.save();
        }

        // Assign the new head doctor
        department.headDocId = headDocId;

        // Ensure new head doctor is part of the department
        if (!department.doctorIds.includes(headDocId)) {
            department.doctorIds.push(headDocId);
        }

        // Set new head doctor's status to true
        newHeadDoctor.isHeadDoc = true;
        await newHeadDoctor.save();

        // Save the updated department
        await department.save();

        // Re-fetch and populate the updated department
        department = await Department.findById(departmentId)
            .populate("headDocId", "name specialization email phoneNumber headDoc")
            .populate("hospitalId", "name")
            .populate({
                path: "categoryId",
                select: "categoryName",
            });

        return res.status(200).json({
            message: "Department updated successfully.",
            department,
        });

    } catch (error) {
        console.error("Error updating department:", error);
        return res.status(500).json({
            message: "Failed to update department",
            error: error.message,
        });
    }
},
  async deleteDepartment(req, res, next) {
    const departmentId = req.query.id;
    const existingDepart = await Department.findById(departmentId);

    if (!existingDepart) {
      return res.status(404).json([]);
    }
    await Department.deleteOne({ _id: departmentId });
    return res.status(200).json({ message: "Department deleted successfully" });
  },
  async changeActiveStatus(req, res, next) {
    try {
      const hospitalId = req.user._id; // Assuming hospitalId is extracted from the token
      const { id, isActive, type } = req.query; // Use req.body for better data handling

      // Validate inputs
      if (!id || typeof isActive === "undefined" || !type) {
        return res.status(400).json({
          success: false,
          message: "Missing Parameters.",
        });
      }

      let Model;
      let query = { _id: id }; // Base query

      if (type === "department") {
        Model = Department;
        query.hospitalId = hospitalId; // Ensure department belongs to the hospital
      } else if (type === "pharmacy") {
        Model = Pharmacy;
        query.hospitalIds = hospitalId; // Check pharmacy's hospitalIds array
      } else if (type === "lab") {
        Model = Laboratory;
        query.hospitalIds = hospitalId; // Check lab's hospitalIds array
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid type",
        });
      }

      // Update the isActive status of the selected entity
      const updatedEntity = await Model.findOneAndUpdate(
        query, // Query ensures hospitalId is matched where applicable
        { isActive: isActive },
        { new: true } // Return the updated document
      );

      if (!updatedEntity) {
        return res.status(404).json({
          success: false
        });
      }

      // Respond with the updated entity
      return res.status(200).json({
        success: true,
        message: `Active status updated successfully.`,
        updatedEntity, // Include the updated entity in the response
      });
    } catch (error) {
      console.error("Error updating active status:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update active status."
      });
    }
  },
  async getDepart(req, res, next) {
    try {
      const departmentId = req.query.id;

      // Fetch the department by ID
      const department = await Department.findById(departmentId);

      if (!department) {
        return res.status(404).json([]);
      }

      // Count the number of doctors associated with this department
      const doctorCount = department.doctorIds.length;

      // Return department data along with doctor count
      return res.status(200).json({
        department: {
          ...department.toObject(),
          doctorCount: doctorCount,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
  async getHospDepartDocs(req, res, next) {
    try {
      const departmentId = req.query.id;
      const hospitalId = req.user._id;
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const doctorsPerPage = 10; // Number of doctors to display per page
      const searchQuery = String(req.query.query || "").trim(); // Get the search query and trim it

      // Fetch the department with the doctors
      const department = await Department.findById(departmentId).populate({
        path: "doctorIds",
        model: "Doctor", // Populate the doctor details
      });

      if (!department) {
        return res.status(404).json({});
      }

      // Filter doctors based on the search query (case-insensitive)
      let filteredDoctors = department.doctorIds;
      if (searchQuery) {
        const lowerCaseQuery = searchQuery.toLowerCase(); // Convert query to lowercase for case-insensitive search
        filteredDoctors = department.doctorIds.filter((doctor) => {
          const doctorName = doctor.name?.toLowerCase() || ""; // Convert doctor name to lowercase
          const doctorEmail = doctor.email?.toLowerCase() || ""; // Convert doctor email to lowercase
          return (
            doctorName.includes(lowerCaseQuery) || // Check if name matches
            doctorEmail.includes(lowerCaseQuery) // Check if email matches
          );
        });
      }

      // Pagination logic
      const totalDoctors = filteredDoctors.length; // Total filtered doctors
      const totalPages = Math.ceil(totalDoctors / doctorsPerPage); // Calculate total pages
      const skip = (page - 1) * doctorsPerPage; // Calculate the number of doctors to skip
      const paginatedDoctors = filteredDoctors.slice(
        skip,
        skip + doctorsPerPage
      ); // Paginate the filtered doctors

      // Determine the previous and next pages
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Prepare the response
      res.status(200).json({
        department: {
          ...department.toObject(), // Include department details
          doctorIds: paginatedDoctors, // Replace with paginated and filtered doctors
        },
        totalDoctors,
        totalPages,
        previousPage,
        nextPage,
      });
    } catch (error) {
      console.error("Error fetching doctors:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
  async getAllDepartments(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Page number
      const departPerPage = 10; // Departments per page
      const hospitalId = req.user._id; // Get hospital ID from authenticated user

      // Ensure search query is a string and trim it
      const searchQuery = String(req.query.query || "").trim();

      // Initialize filter for hospital ID
      const filter = { hospitalId: hospitalId };

      // Fetch departments with basic filtering (no $regex on references)
      const departments = await Department.find(filter)
        .sort({ createdAt: -1 }) // Sort by latest
        .skip((page - 1) * departPerPage) // Pagination skip
        .limit(departPerPage) // Pagination limit
        .populate("hospitalId", "name email phoneNumber") // Populate hospital details
        .populate("headDocId", "name email phoneNumber specialization cnicOrPassportNo") // Populate head doctor details
        .populate("categoryId", "categoryName") // Populate category details
        .populate("doctorIds"); // Populate associated doctors

      // If there is a search query, filter results in JavaScript
      let filteredDepartments = departments;
      if (searchQuery) {
        filteredDepartments = departments.filter((department) => {
          // Search in populated fields:
          // 1. categoryId.categoryName
          const categoryName =
            department.categoryId?.categoryName?.toLowerCase() || "";
          // 2. headDocId.name and headDocId.email
          const headDocName = department.headDocId?.name?.toLowerCase() || "";
          const headDocEmail = department.headDocId?.email?.toLowerCase() || "";

          // Check if any of the fields match the search query
          return (
            categoryName.includes(searchQuery.toLowerCase()) ||
            headDocName.includes(searchQuery.toLowerCase()) ||
            headDocEmail.includes(searchQuery.toLowerCase())
          );
        });
      }

      // Calculate pagination details
      const totalDeparts = filteredDepartments.length;
      const totalPages = Math.ceil(totalDeparts / departPerPage);

      // Slice filtered departments for pagination
      const paginatedDepartments = filteredDepartments.slice(
        (page - 1) * departPerPage,
        page * departPerPage
      );

      // Prepare the response
      const response = {
        departments: paginatedDepartments.map((department) => ({
          _id: department._id,
          hospitalId: department.hospitalId,
          headDocId: department.headDocId,
          categoryId: department.categoryId,
          isActive: department.isActive,
          doctorIds: department.doctorIds,
          createdAt: department.createdAt,
          updatedAt: department.updatedAt,
        })),
        auth: true,
        totalDeparts: totalDeparts,
        previousPage: page > 1 ? page - 1 : null,
        totalPages: totalPages,
        nextPage: page < totalPages ? page + 1 : null,
      };

      // Send response
      return res.status(200).json(response);
    } catch (error) {
      console.error("Fetching Departments failed");
      return res
        .status(500)
        .json({ message: "Something went wrong!" });
    }
  },
  async addDepartment(req, res, next) {
    try {
      const hospitalId = req.user._id; // Assume this comes from authenticated user data
      const { categoryId, headDocId } = req.body;

      // Ensure `categoryId` is provided
      if (!categoryId) {
        return res.status(400).json({
          message: "category is required",
          auth: true,
        });
      }
      // Check if department with same hospitalId and categoryId already exists
      const existingDepartment = await Department.findOne({
        hospitalId,
        categoryId,
      });
      if (existingDepartment) {
        return res.status(400).json({
          message: "A department already exists in this hospital.",
          auth: true,
        });
      }
      // Fetch the related category
      const category = await Category.findById(categoryId);

      // Ensure the category belongs to the hospital
      if (
        category &&
        category.hospitalIds &&
        !category.hospitalIds.includes(hospitalId)
      ) {
        category.hospitalIds.push(hospitalId);
        await category.save();
      }

      // Create the department object
      const department = new Department({
        hospitalId: hospitalId,
        headDocId: headDocId,
        categoryId: categoryId,
      });

      // If `headDocId` exists, push it to `doctorIds`
      if (headDocId) {
        department.doctorIds.push(headDocId);
      }

      // Save the department
      await department.save();

      // Update doctor details if `headDocId` exists
      if (headDocId) {
        const doctor = await Doctor.findById(headDocId);
        if (doctor) {
          doctor.isHeadDoc = true;
          // // Ensure `hospitalIds` is always an array
          // if (!Array.isArray(doctor.hospitalIds)) {
          //   doctor.hospitalIds = [];
          // }
          // Ensure the hospitalId is not duplicated
          const hospitalExists = doctor.hospitalIds.some(
            (entry) => entry?.hospitalId?.toString() === hospitalId.toString()
          );

          if (!hospitalExists) {
            doctor.hospitalIds.push({
              hospitalId: hospitalId,
              departmentId: department._id,
            });
          } else {
            // Update existing hospitalId entry with new departmentId
            doctor.hospitalIds = doctor.hospitalIds.map((entry) =>
              entry?.hospitalId?.toString() === hospitalId.toString()
                ? { hospitalId: entry.hospitalId, departmentId: department._id }
                : entry
            );
          }
          await doctor.save();
        }
      }

      // Populate and return the department in the response
      const populatedDepartment = await Department.findById(department._id)
        .populate("hospitalId", "name")
        .populate("headDocId", "name specialization")
        .populate("categoryId", "categoryName");

      return res.status(200).json({
        message: "Department added successfully!",
        auth: true,
        department: populatedDepartment,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = hospDepartController;
