const express = require("express");
const app = express();
const Doctor = require("../../models/Doctor/doctors.js");
const Laboratory = require("../../models/Laboratory/laboratory.js");
const Pharmacy = require("../../models/Pharmacy/pharmacy.js");
const Hospital = require("../../models/Hospital/hospital.js");
const Department = require("../../models/Hospital/department.js");
const VerificationCode = require("../../models/verificationCode.js");
const nodemailer = require("nodemailer");
const transporter = require("../../utils/gmail.js");
const BookTreatment = require("../../models/All Doctors Models/bookTreatment.js");
const Categories = require("../../models/All Doctors Models/categories");
const Treatments = require("../../models/All Doctors Models/treatments");
const Category = require("../../models/All Doctors Models/categories.js");
const Availability = require("../../models/All Doctors Models/availability.js");
const mongoose = require("mongoose");

const hospDocController = {
  async searchDoc(req, res, next) {
    try {
      const query = req.query.search;
      const regex = new RegExp(query, "i"); // Create a case-insensitive regular expression
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 10; // Default to 10 results per page
      const skip = (page - 1) * limit;

      // Perform a case-insensitive search in the database
      const suggestions = await Doctor.find({
        name: regex,
        isVerified: true,
        paidActivation: true,
        blocked: false,
      });
      const totalDoctors = await Doctor.countDocuments({
        name: regex,
        isVerified: true,
        paidActivation: true,
        blocked: false,
      });
      const totalPages = Math.ceil(totalDoctors / limit);

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      res.json({
        suggestions,
        auth: true,
        previousPage,
        nextPage,
        totalPages,
        totalDoctors,
      });
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
  async sendCodeToDocEmail(req, res, next) {
    const hospId = req.user._id;
    const type = req.body.type;
    const email = req.body.email;
    const departmentId = req.body.departmentId;
    const isHospAddingDoc = req.body.isHospAddingDoc;
    const hospital = await Hospital.findById(hospId);
    const hospitalName = hospital.name ? hospital.name : null;

    const department = await Department.findById(departmentId)
      .populate("categoryId", "categoryName")
      .exec();
    console.log(departmentId);
    // Step 4: Safely get the department name
    const departName =
      department && department.categoryId
        ? department.categoryId.categoryName || null
        : null;
    console.log("departmentName", departName);

    if (hospital.activationRequest === "inProgress") {
      return next({
        status: 403,
        message: "Your account will be activated within the next hour",
      });
    } else if (hospital.activationRequest === "pending") {
      return next({
        status: 403,
        message: "Please pay the activation fee to activate your account",
      });
    }

    if (!isHospAddingDoc) {
      const user = await Doctor.findOne({ email, doctorKind: type });
      if (!user) {
        return res
          .status(404)
          .json({ status: false, message: "Doctor not found" });
      }
      if (user.hospitalIds.some((h) => h.hospitalId.toString() === hospId)) {
        return res.status(404).json({ message: "Doctor already added!" });
      }
    } else {
      const user = await Doctor.findOne({ email, doctorKind: type });
      if (user) {
        return res.status(404).json({ message: "Doctor already exists!" });
      }
    }

    if (!hospital) {
      return res
        .status(404)
        .json({ status: false, message: "Hospital not found" });
    }

    try {
      // Invalidate previous codes for this email
      await VerificationCode.deleteMany({ email });

      const customExpiration = !isHospAddingDoc
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 2 * 60 * 1000);
      const codeToSave = new VerificationCode({
        email: email,
        code: Math.floor(100000 + Math.random() * 900000),
        doctorKind: type,
        ...(customExpiration && { expiresAt: customExpiration }),
      });

      const code = await codeToSave.save();

      // Define dashboard paths
      const dashboardPaths = {
        doctor: "doctor/dashboard",
        physiotherapist: "physiotherapist/dashboard",
        psychologist: "psychologist/dashboard",
        nutritionist: "nutritionist/dashboard",
      };

      const dashboardPath = dashboardPaths[type] || "doctor/dashboard"; // Default to doctor/dashboard if type is invalid

      // let acceptBaseUrl = `https://meditour.global`;
      let acceptBaseUrl = `http://localhost:3000`;

      const acceptUrl = `${acceptBaseUrl}/${dashboardPath}?email=${encodeURIComponent(
        email
      )}&type=${encodeURIComponent(type)}&departmentId=${encodeURIComponent(
        departmentId
      )}&departName=${encodeURIComponent(
        departName
      )}&hospitalId=${encodeURIComponent(
        hospId
      )}&hospitalName=${encodeURIComponent(hospitalName)}`;

      // Email options
      const mailOptions = {
        from: "no-reply@example.com",
        to: email,
        subject: "Account Verification",
        html: `
                <p>You are being added in this department <strong>${
                  department.categoryId.categoryName
                }</strong> by <strong>${
          hospital.name
        }</strong> as a <strong>${type}</strong> in Meditour Dashboard.</p>
                <p>Department: <strong>${
                  department.categoryId.categoryName ? departName : "N/A"
                }</strong></p>
                <p>Your verification code is:</p>
                <p style="display: inline-block; 
                          padding: 10px 20px; 
                          font-size: 18px; 
                          color: #ff6600; 
                          text-decoration: none; 
                          border: 2px dashed #ff6600; 
                          border-radius: 5px; 
                          text-align: center;">
                    <strong>${codeToSave.code}</strong>
                </p>
                ${
                  !isHospAddingDoc
                    ? `<p>If you accept this invitation, please click the button below:</p>
                           <p>
                               <a href="${acceptUrl}" 
                                  style="display: inline-block; 
                                         padding: 10px 20px; 
                                         font-size: 16px; 
                                         color: #ffffff; 
                                         background-color: #007bff; 
                                         text-decoration: none; 
                                         border-radius: 5px;">
                                   Accept Invitation
                               </a>
                           </p>`
                    : ""
                }
                <p>Thank you!</p>
            `,
      };

      // Send the email
      transporter.sendMail(mailOptions, function (err) {
        if (err) {
          return next(err);
        }

        return res.status(200).json({
          status: true,
          email: email,
          message: `A verification email has been sent to ${email}`,
        });
      });
    } catch (error) {
      return next(error);
    }
  },
  async confirmEmail(req, res, next) {
    try {
      const { code, email, type, departmentId } = req.body; // Removed `isHospAddingDoc` since it's always true
      const hospitalId = req.user._id;

      // Find the verification code
      const verificationCode = await VerificationCode.findOne({ code });
      if (!verificationCode) {
        return res.status(400).json({
          message:
            "Incorrect verification code. Please double-check the code and try again.",
        });
      }

      // Validate email and doctor type
      if (
        email !== verificationCode.email ||
        type !== verificationCode.doctorKind
      ) {
        return res.status(400).json({
          message:
            "We were unable to find a user for this verification. Please enter a correct email!",
        });
      }

      // Create a new doctor
      // const newDoctor = new Doctor({
      //   email: email,
      //   doctorKind: type,
      //   docCompanyId: hospitalId,
      //   hospitalIds: [hospitalId],
      //   createdAt: new Date(),
      // });
      // await newDoctor.save();

      // Delete the verification code
      await VerificationCode.deleteMany({ email });

      return res.status(200).json({
        status: true,
        message: "Your email has been successfully verified!",
      });
    } catch (error) {
      return next(error);
    }
  },
  async getHospitalDoctors(req, res, next) {
    try {
      const hospitalId = req.user._id;
      const searchTerm = req.query.query || ""; // Get search term from query

      // Match agencies by hospitalId and keyword search on name and email
      const matchStage = {
        $match: {
          "hospitalIds.hospitalId": hospitalId,
          $or: [
            // Case-insensitive search on name and email
            { name: { $regex: searchTerm, $options: "i" } }, // Case-insensitive search on name
            { email: { $regex: searchTerm, $options: "i" } }, // Case-insensitive search on email
          ],
        },
      };

      // Fetch doctors with aggregation pipeline
      const doctors = await Doctor.aggregate([
        matchStage,
        {
          $lookup: {
            from: "ratings",
            localField: "_id", // Doctor ID in Doctor collection
            foreignField: "vendorId", // Vendor ID in Ratings collection
            as: "ratings",
          },
        },
        {
          $lookup: {
            from: "availability",
            localField: "_id", // Doctor ID
            foreignField: "doctorId", // Doctor ID in Availability collection
            as: "availability",
          },
        },
        {
          $addFields: {
            ratingsArray: {
              $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
            }, // Ensure ratingsArray is always an array
            satisfiedPatientCount: {
              $size: {
                $filter: {
                  input: {
                    $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
                  }, // Handle null or missing ratings
                  as: "rating",
                  cond: { $eq: ["$$rating.rating", 5] }, // Count only 5-star ratings
                },
              },
            },
            totalRatingsCount: {
              $size: {
                $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
              }, // Ensure totalRatingsCount is calculated correctly
            },
          },
        },
        {
          $addFields: {
            satisfiedPatientPercentage: {
              $cond: {
                if: { $gt: ["$totalRatingsCount", 0] }, // Avoid division by zero
                then: {
                  $multiply: [
                    {
                      $divide: ["$satisfiedPatientCount", "$totalRatingsCount"],
                    },
                    100,
                  ],
                },
                else: 0,
              },
            },
          },
        },
        {
          $addFields: {
            hospitalAvailability: {
              $filter: {
                input: {
                  $ifNull: [
                    { $arrayElemAt: ["$availability.hospitalAvailability", 0] },
                    [],
                  ],
                }, // Handle null or missing availability
                as: "availability",
                cond: { $eq: ["$$availability.hospitalId", hospitalId] }, // Match hospitalId
              },
            },
          },
        },
        {
          $project: {
            name: 1,
            doctorImage: 1,
            qualifications: 1,
            clinicExperience: 1,
            isRecommended: 1,
            hasPMDCNumber: {
              $cond: [{ $ifNull: ["$pmdcNumber", false] }, true, false],
            },
            satisfiedPatientCount: 1,
            satisfiedPatientPercentage: 1,
            hospitalAvailability: {
              $map: {
                input: "$hospitalAvailability",
                as: "hospital",
                in: {
                  hospitalId: "$$hospital.hospitalId",
                  isAvailable: "$$hospital.isAvailable",
                  price: "$$hospital.price.actualPrice",
                  availability: {
                    $map: {
                      input: "$$hospital.availability",
                      as: "availabilityItem",
                      in: {
                        dayOfWeek: "$$availabilityItem.dayOfWeek",
                        morning: "$$availabilityItem.morning",
                        evening: "$$availabilityItem.evening",
                      },
                    },
                  },
                },
              },
            },
            phoneNumber: 1,
            email: 1,
            "location.address": 1,
          },
        },
        { $sort: { createdAt: -1 } }, // Sort newly added doctors at the top
      ]);

      // Response
      res.status(200).json({
        doctors,
        doctorCount: doctors.length,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },
  async getTreatmentDocs(req, res, next) {
    try {
      const { treatmentId } = req.query;
      const searchTerm = req.query.query;
      const hospitalId = req.user._id;
      // const page = parseInt(req.query.page, 10) || 1;
      // const limit = parseInt(req.query.limit, 30) || 30;
      // const skip = (page - 1) * limit;
      const treatmentIdObjectId = new mongoose.Types.ObjectId(treatmentId);
      // Match agencies by travelCompanyId and keyword search on name
      const matchStage = {
        $match: { treatmentId: treatmentIdObjectId, hospitalId: hospitalId }, // Match the treatmentId
      };
      // Aggregation pipeline
      const pipeline = [
        matchStage,
        {
          $lookup: {
            from: "doctors", // Replace with the actual doctors collection name
            localField: "doctorId",
            foreignField: "_id",
            as: "doctor",
            pipeline: [
              {
                $match: {
                  "hospitalIds.hospitalId": hospitalId,
                },
              }, // Filter for active and unblocked doctors
              {
                $lookup: {
                  from: "ratings", // Join with the ratings collection
                  localField: "_id",
                  foreignField: "vendorId",
                  as: "ratings", // Name for joined ratings
                },
              },
              {
                $addFields: {
                  satisfiedPatientCount: {
                    $size: {
                      $filter: {
                        input: {
                          $ifNull: [
                            { $arrayElemAt: ["$ratings.ratings", 0] },
                            [],
                          ],
                        }, // Default to an empty array
                        as: "rating",
                        cond: { $eq: ["$$rating.rating", 5] }, // Count only 5-star ratings
                      },
                    },
                  },
                  totalRatingsCount: {
                    $size: {
                      $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
                    }, // Default to an empty array
                  },
                },
              },
              {
                $addFields: {
                  satisfiedPatientPercentage: {
                    $cond: {
                      if: { $gt: ["$totalRatingsCount", 0] }, // Avoid division by zero
                      then: {
                        $multiply: [
                          {
                            $divide: [
                              "$satisfiedPatientCount",
                              "$totalRatingsCount",
                            ],
                          },
                          100,
                        ],
                      },
                      else: 0,
                    },
                  },
                },
              },
              {
                $project: {
                  name: 1,
                  email: 1,
                  qualifications: 1,
                  clinicExperience: 1,
                  isRecommended: 1,
                  doctorImage: {
                    $ifNull: ["$doctorImage", null],
                  },
                  hasPMDCNumber: {
                    $cond: [{ $ifNull: ["$pmdcNumber", false] }, true, false],
                  },
                  satisfiedPatientCount: 1,
                  satisfiedPatientPercentage: 1,
                  _id: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: "$doctor", // Unwind the doctor array (might be empty for no matches)
        },
        {
          $project: {
            treatmentId: 1,
            treatment: 1,
            totalAmount: 1,
            createdAt: 1,
            updatedAt: 1,
            doctor: 1, // Include the doctor details as a nested object
          },
        },
        { $sort: { "doctor.name": 1 } }, // Optional: Sort by doctor's name (alphabetical)
        // { $skip: skip },
        // { $limit: limit },
      ];
      if (searchTerm) {
        const regex = new RegExp(searchTerm, "i"); // Create a case-insensitive regular expression
        pipeline.push({
          $match: {
            $or: [
              { "doctor.name": regex }, // Search by doctor name
              { "doctor.email": regex }, // Search by doctor email
            ],
          },
        });
      }
      const results = await BookTreatment.aggregate(pipeline);
      const doctorCount = results.length; // Execute the aggregation pipeline

      // Calculate the doctor count and total pages
      // const doctorCount = results.length;
      // const totalPages = Math.ceil(doctorCount / limit);

      // // Determine the previous and next pages
      // const previousPage = page > 1 ? page - 1 : null;
      // const nextPage = page < totalPages ? page + 1 : null;

      // Send the response as a single object
      res.json({
        doctors: results,
        doctorCount,
        // previousPage,
        // nextPage,
        // totalPages,
        // currentPage: page,
      });
    } catch (error) {
      next(error);
    }
  },
  async treatmentsByCategory(req, res, next) {
    try {
      const hospitalId = req.user._id;

      // Fetch treatments grouped by category
      const treatments = await BookTreatment.aggregate([
        {
          $match: {
            hospitalId: mongoose.Types.ObjectId(hospitalId), // Filter by hospital ID
          },
        },
        // {
        //   $lookup: {
        //     from: "doctors",
        //     localField: "doctorId",
        //     foreignField: "_id",
        //     as: "doctorId"
        //   }
        // },
        // {
        //   $unwind: {
        //     path: "$doctorId",
        //     preserveNullAndEmptyArrays: true
        //   },
        // },
        // {
        //   $lookup: {
        //     from: "hospitals",
        //     localField: "hospitalId",
        //     foreignField: "_id",
        //     as: "hospitalId"
        //   }
        // },
        // {
        //   $unwind: {
        //     path: "$hospitalId",
        //     preserveNullAndEmptyArrays: true
        //   },
        // },
        {
          $lookup: {
            from: "treatments", // Join with Treatment collection
            localField: "treatmentId",
            foreignField: "_id",
            as: "treatmentId",
          },
        },
        {
          $unwind: {
            path: "$treatmentId",
            preserveNullAndEmptyArrays: true, // Handle null gracefully
          },
        },
        {
          $lookup: {
            from: "treatment categories", // Join with Treatment Category collection
            localField: "treatmentId.categoryId",
            foreignField: "_id",
            as: "categoryDetails",
          },
        },
        {
          $unwind: {
            path: "$categoryDetails",
            preserveNullAndEmptyArrays: true, // Handle null gracefully
          },
        },
        {
          $group: {
            _id: "$treatmentId.categoryId", // Group by categoryId
            categoryName: { $first: "$categoryDetails.categoryName" },
            treatments: {
              $push: {
                bookingId: "$_id",
                treatmentId: "$treatmentId",
                totalAmount: "$totalAmount",
                doctorId: "$doctorId",
                hospitalId: "$hospitalId",
                isPersonal: "$isPersonal",
                createdAt: "$createdAt",
              },
            },
          },
        },
        {
          $project: {
            _id: 1, // Keep category ID
            categoryName: 1,
            treatments: 1,
          },
        },
      ]);

      if (treatments.length === 0) {
        return res.status(404).json({});
      }

      res.status(200).json({ success: true, data: treatments });
    } catch (error) {
      console.error("Error fetching treatments by category:", error);
      next(error);
    }
  },
  async changeAvailabilityStatus(req, res, next) {
    try {
      const hospitalId = req.user._id;
      console.log("hospitalId", hospitalId);
      const doctorId = req.query.doctorId;
      const availabilityStatus = req.query.availabilityStatus;
      const updatedAvailability = await Availability.findOneAndUpdate(
        { doctorId, "hospitalAvailability.hospitalId": hospitalId },
        { $set: { "hospitalAvailability.$.isAvailable": availabilityStatus } }
      );

      if (!updatedAvailability) {
        return res.status(404).json({
          success: false,
          message: "No matching record found to update.",
        });
      }
      res.status(200).json({
        success: true,
        data: updatedAvailability,
      });
    } catch (error) {
      next(error);
    }
  },
  async addAvailability(req, res, next) {
    try {
      const hospitalId = req.user._id;
      const { availability, doctorId } = req.body;

      // Validate input
      if (!availability || !doctorId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Find the existing doctor's availability document
      let doctorAvailability = await Availability.findOne({ doctorId });

      if (!doctorAvailability) {
        doctorAvailability = new Availability({ doctorId });
      }

      // Check if hospital exists in the hospitalAvailability array
      const existingHospitalIndex =
        doctorAvailability.hospitalAvailability.findIndex(
          (item) => String(item.hospitalId) === String(hospitalId)
        );

      if (existingHospitalIndex !== -1) {
        doctorAvailability.hospitalAvailability[
          existingHospitalIndex
        ].availability = availability;
      } else {
        // Add a new entry for the hospital if it doesn't exist
        doctorAvailability.hospitalAvailability.push({
          hospitalId,
          availability,
        });
      }

      // Save the updated document
      await doctorAvailability.save();

      return res.status(200).json({
        message: "Availability updated successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
  async addAvailabilityPrice(req, res, next) {
    try {
      const hospitalId = req.user._id;
      const { price, doctorId } = req.body;
      if (price == 0) {
        return res.status(400).json({
          error: "Price value cannot be zero. Please enter a valid price.",
        });
      }

      // Validate input
      if (!price) {
        return res.status(400).json({ error: "Please enter price!" });
      }

      // Check if doctor availability already exists, if not, create a new entry
      let doctorAvailability = await Availability.findOne({ doctorId });

      if (!doctorAvailability) {
        doctorAvailability = new Availability({ doctorId });
      }

      // Validate hospitalId
      if (!hospitalId) {
        return res
          .status(400)
          .json({ error: "Missing hospitalId for hospital availability" });
      }

      // Check for existing hospital availability
      const existingHospitalIndex =
        doctorAvailability.hospitalAvailability.findIndex(
          (item) => String(item.hospitalId) == hospitalId
        );

      if (existingHospitalIndex !== -1) {
        // Hospital availability already exists, update the price
        doctorAvailability.hospitalAvailability[existingHospitalIndex].price = {
          actualPrice: price,
        };
      } else {
        // Hospital availability does not exist, add the price for this hospitalId
        doctorAvailability.hospitalAvailability.push({
          hospitalId,
          price: { actualPrice: price },
        });
      }

      // Save the doctor availability
      await doctorAvailability.save();

      return res.status(200).json({ message: "Price updated successfully" });
    } catch (error) {
      return next(error);
    }
  },
  async checkWhileAdding(req, res, next) {
    try {
      const hospitalId = req.user._id;
      const type = req.query.type;

      const hospital = await Hospital.findById(hospitalId);

      if (!hospital.paidActivation) {
        return res.status(200).json({
          status: false,
          message: "Please pay the activation fee to activate your account.",
          allowed: true,
        });
      }

      if (type === "doctor") {
        const doctors = await Doctor.find({
          "hospitalIds.hospitalId": hospitalId,
        });
        let doctorLength = doctors ? doctors.length : 0;

        if (hospital.doctorsAllowed === doctorLength) {
          return res.status(200).json({
            status: false,
            message: "Limit reached, please pay to increase the limit.",
            allowed: true,
          });
        }

        return res.status(200).json({
          status: true,
          message: "You can add more doctors.",
          allowed: true,
        });
      }

      if (type === "lab") {
        const labs = await Laboratory.find({
          hospitalIds: { $in: [hospitalId] },
        });
        let labsLength = labs ? labs.length : 0;
        console.log("labsLength", labsLength);

        if (hospital.labsAllowed === labsLength) {
          return res.status(200).json({
            status: false,
            message: "Only one lab allowed",
            allowed: true,
          });
        }
        return res.status(200).json({
          status: true,
          message: "You can add more labs.",
          allowed: true,
        });
      }

      // Placeholder for "pharm" type - logic to be implemented in the future
      if (type === "pharm") {
        const pharms = await Pharmacy.find({
          hospitalIds: { $in: [hospitalId] },
        });
        let pharmsLength = pharms ? pharms.length : 0;

        if (hospital.pharmaciesAllowed === pharmsLength) {
          return res.status(200).json({
            status: false,
            message: "Only one pharmacy allowed",
            allowed: true,
          });
        }
        return res.status(200).json({
          status: true,
          message: "You can add more pharmacies",
          allowed: true,
        });
      }

      return res.status(400).json({
        status: false,
        message: "Type is invalid",
        allowed: false,
      });
    } catch (error) {
      next(error);
    }
  },

  async increaseLimit(req, res, next) {
    try {
      const { numberOfDocs } = req.body;
      const hospitalId = req.user._id;

      if (!numberOfDocs) {
        return res
          .status(400)
          .json({ message: "Number of Doctors are required" });
      }

      const hospital = await Hospital.findById(hospitalId);

      if (!hospital) {
        return res.status(404).json({});
      }

      if (!hospital.paidActivation) {
        return res.status(200).json({
          status: false,
          message: "Please activate your account.",
          allowed: false,
        });
      }

      hospital.doctorsAllowed += numberOfDocs;

      await hospital.save();

      res.status(200).json({
        message: "Doctor limit updated successfully",
        doctorAllowed: hospital.doctorsAllowed,
      });
    } catch (error) {
      next(error);
    }
  },
  async getTreatmentList(req, res, next) {
    try {
      // Initialize matchCondition for filtering treatments by hospitalId
      let matchCondition = {};

      if (req.query.hospitalId) {
        const hospitalId = mongoose.Types.ObjectId(req.query.hospitalId);
        matchCondition = { hospitalIds: { $in: [hospitalId] } }; // Filter treatments by hospitalId if provided
      }

      // Get the keyword from query parameter
      const keyword = req.query.keyword?.trim(); // Optional keyword search

      // If keyword exists, create the regex for case-insensitive search
      let keywordMatchCondition = {};
      if (keyword) {
        const regex = new RegExp(keyword, "i"); // Case-insensitive search
        keywordMatchCondition = {
          $or: [
            { "categoryId.categoryName": regex }, // Search in categoryName
            { subCategory: regex }, // Search in subCategory (treatment name)
          ],
        };
      }

      const treatments = await Treatments.aggregate([
        {
          $lookup: {
            from: "treatment categories", // Join with Treatment Category collection
            localField: "categoryId",
            foreignField: "_id",
            as: "categoryId",
          },
        },
        {
          $unwind: "$categoryId", // Unwind category details
        },
        {
          // Optionally match by hospitalId if provided
          $match: matchCondition,
        },
        // Apply the keyword search condition
        {
          $match: keywordMatchCondition, // Apply keyword match for category name and treatment name
        },
        {
          $lookup: {
            from: "book treatments", // Join with BookTreatment to link doctors to treatments
            localField: "_id",
            foreignField: "treatmentId",
            as: "doctorTreatmentLink", // We'll get doctor-related info here
          },
        },
        {
          $group: {
            _id: "$categoryId", // Group by categoryId
            categoryName: { $first: "$categoryId.categoryName" },
            treatments: {
              $push: {
                treatmentId: "$_id",
                subCategory: "$subCategory",
                description: "$description",
                image: "$image",
                hospitalIds: "$hospitalIds", // Include hospitalIds in the grouped result
                createdAt: "$createdAt",
                doctorIds: {
                  $map: {
                    input: "$doctorTreatmentLink", // Iterate through doctorTreatmentLink array
                    as: "doctor",
                    in: "$$doctor.doctorId", // Get doctorId for each entry
                  },
                },
              },
            },
          },
        },
        {
          $project: {
            _id: 1, // Keep category ID
            treatments: 1,
          },
        },
        {
          $sort: {
            _id: 1,
          },
        },
      ]);

      if (treatments.length === 0) {
        return res.status(404).json({});
      }

      res.status(200).json({ success: true, data: treatments });
    } catch (error) {
      console.error("Error fetching treatments by category:", error);
      next(error);
    }
  },
  async addHospTreatment(req, res, next) {
    try {
      const hospitalId = req.user._id;
      const categoriesAndTreatments = req.body;

      // if (!Array.isArray(categoriesAndTreatments) || categoriesAndTreatments.length === 0) {
      //   return res.status(400).json({
      //     message: "Please provide an array of categories with treatment IDs.",
      //   });
      // }

      let updatedTreatments = {};

      for (let categoryData of categoriesAndTreatments) {
        const { categoryId, treatmentIds } = categoryData;

        // if (!Array.isArray(treatmentIds) || treatmentIds.length === 0) {
        //   return res.status(400).json({
        //     message: `Please provide an array of treatment IDs for category ${categoryId}.`,
        //   });
        // }

        const category = await Categories.findById(categoryId); // Category populate karne ke liye fetch
        if (!category) {
          return res.status(404).json({});
        }

        for (let treatmentId of treatmentIds) {
          const treatment = await Treatments.findById(treatmentId).populate(
            "categoryId"
          );

          if (treatment) {
            if (treatment.categoryId._id.toString() === categoryId) {
              if (
                !treatment.hospitalIds.includes(
                  mongoose.Types.ObjectId(hospitalId)
                )
              ) {
                treatment.hospitalIds.push(mongoose.Types.ObjectId(hospitalId));
              }

              await treatment.save();

              if (!updatedTreatments[categoryId]) {
                updatedTreatments[categoryId] = {
                  _id: category, // Yeh ab pura category object populate karega
                  treatments: [],
                };
              }

              // Here, only include the relevant treatment details (not the full treatment object)
              updatedTreatments[categoryId].treatments.push({
                treatmentId: treatment._id,
                subCategory: treatment.subCategory,
                description: treatment.description,
                image: treatment.image,
                hospitalIds: treatment.hospitalIds,
                createdAt: treatment.createdAt,
                doctorIds: treatment.doctorIds,
              });
            } else {
              return res.status(400).json({
                message: "Mismatched Category please check it again",
              });
            }
          } else {
            return res.status(404).json({});
          }
        }
      }

      return res.status(200).json({
        message: "Treatments added to hospital successfully!",
        updatedTreatments: Object.values(updatedTreatments),
      });
    } catch (error) {
      console.error("Treatments added to hospital failed");
      next(error);
    }
  },

  async getHospitals(req, res, next) {
    try {
      // Step 1: Aggregate treatments to find hospitals with at least one treatment
      const doctorId = req.user._id;
      const hospitals = await Doctor.findById(doctorId)
        .select("hospitalIds")
        .populate({
          path: "hospitalIds.hospitalId",
          select: "name",
        });

      res.status(200).json({ auth: true, data: hospitals });
    } catch (error) {
      next(error);
    }
  },
};
module.exports = hospDocController;
