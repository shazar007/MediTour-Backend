const express = require("express");
const mongoose = require("mongoose");
const app = express();
const DoctorCompany = require("../../models/DoctorCompany/docCompany.js");
const Doctor = require("../../models/Doctor/doctors.js");
const VerificationCode = require("../../models/verificationCode.js");
const transporter = require("../../utils/gmail.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");
const Appointment = require("../../models/All Doctors Models/appointment.js");
const User = require("../../models/User/user.js");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

const docCompanyDocController = {
  async sendCodeToDocEmail(req, res, next) {
    const type = req.body.type;
    const companyId = req.user._id;
    const email = req.body.email;
    const isCompanyAddingDoc = req.body.isCompanyAddingDoc;

    const doctorCompany = await DoctorCompany.findById(companyId);
    const companyName = doctorCompany.name ? doctorCompany.name : null;

    if (!doctorCompany) {
      return res.status(404).json({ message: "Doctor Company not found!" });
    }

    if (doctorCompany.activationRequest === "inProgress") {
      return next({
        status: 403,
        message: "Your account will be activated within the next hour",
      });
    } else if (doctorCompany.activationRequest === "pending") {
      return next({
        status: 403,
        message: "Please pay the activation fee to activate your account",
      });
    }

    if (
      doctorCompany.doctorIds &&
      doctorCompany.doctorIds.length == doctorCompany.doctorsAllowed
    ) {
      return res.status(403).json({
        message:
          "Doctor addition limit reached! Please pay to add more doctors!",
      });
    }

    if (!isCompanyAddingDoc) {
      const user = await Doctor.findOne({ email, doctorKind: type });
      if (!user) {
        return res.status(404).json({ message: "Doctor not found!" });
      }

      // Check if the doctor is associated with the logged-in company
      if (
        user.docCompanyId &&
        user.docCompanyId.toString() === companyId.toString()
      ) {
        return res.status(400).json({
          message: "Doctor is already associated with your company!",
        });
      }

      // Check if the doctor is associated with another company
      if (
        user.docCompanyId &&
        user.docCompanyId.toString() !== companyId.toString()
      ) {
        return res.status(403).json({
          message: "Doctor is already associated with another company!",
        });
      }
    } else if (isCompanyAddingDoc) {
      const user = await Doctor.findOne({ email, doctorKind: type });
      if (user) {
        return res.status(404).json({ message: "Doctor already exists!" });
      }
    }

    try {
      // Invalidate previous codes for this email
      await VerificationCode.deleteMany({ email });

      // Generate and save the verification code
      const customExpiration = !isCompanyAddingDoc
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 2 * 60 * 1000);
      const codeToSave = new VerificationCode({
        email: email,
        code: Math.floor(100000 + Math.random() * 900000),
        doctorKind: type,
        ...(customExpiration && { expiresAt: customExpiration }),
      });
      await codeToSave.save();

      const dashboardPaths = {
        doctor: "doctor/dashboard",
        physiotherapist: "physiotherapist/dashboard",
        psychologist: "psychologist/dashboard",
        nutritionist: "nutritionist/dashboard",
      };

      const dashboardPath = dashboardPaths[type] || "doctor/dashboard"; // Default to doctor/dashboard if type is invalid

      const acceptUrl = `https://meditour.global//${dashboardPath}?email=${encodeURIComponent(
        email
      )}&type=${encodeURIComponent(type)}&companyId=${encodeURIComponent(
        companyId
      )}&companyName=${encodeURIComponent(companyName)}
    )}`;

      // Email options
      const mailOptions = {
        from: "no-reply@example.com",
        to: email,
        subject: "Account Verification",
        html: `
              <p>You are being added by <strong>${doctorCompany.name
          }</strong> as a <strong>${type}</strong> in Meditour Dashboard.</p>
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
              ${!isCompanyAddingDoc
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
      const { code, email, type } = req.body;
      const docCompanyId = req.user._id;

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

      // Check if the doctor already exists
      // let doctor = await Doctor.findOne({ email, doctorKind: type });

      // // Check if the doctor is already associated with the company
      // const docCompany = await DoctorCompany.findById(docCompanyId);
      // console.log("doctor", doctor)

      // if (doctor.docCompanyId && doctor.docCompanyId == docCompanyId) {
      //   return res.status(200).json({
      //     status: true,
      //     message: "This company is already associated with the user.",
      //   });
      // }

      // if (docCompany.doctorIds.includes(doctor._id)) {
      //   return res.status(200).json({
      //     status: true,
      //     message: "This company is already associated with the user.",
      //   });
      // }

      // await doctor.save();
      // await docCompany.save();

      // Delete the verification code
      await VerificationCode.deleteMany({ email });

      return res.status(200).json({
        status: true,
        message: "Your email has been successfully verified.",
      });
    } catch (error) {
      return next(error);
    }
  },

  async getCompanyDocs(req, res, next) {
    try {
      const docCompanyId = req.user._id;
      const page = parseInt(req.query.page) || 1;
      const docsPerPage = 10;

      // Pagination variables
      const skip = (page - 1) * docsPerPage;

      // Fetch company doctors with additional details
      const companyDocs = await Doctor.aggregate([
        {
          $match: {
            docCompanyId: docCompanyId,
          },
        },
        {
          $lookup: {
            from: "ratings",
            localField: "_id",
            foreignField: "vendorId",
            as: "ratings",
          },
        },
        {
          $lookup: {
            from: "availability",
            localField: "_id",
            foreignField: "doctorId",
            as: "availability",
          },
        },
        {
          $lookup: {
            from: "hospitals",
            localField: "availability.hospitalAvailability.hospitalId",
            foreignField: "_id",
            as: "hospitalDetails",
          },
        },
        {
          $addFields: {
            ratingsArray: {
              $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
            },
            satisfiedPatientCount: {
              $size: {
                $filter: {
                  input: {
                    $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
                  },
                  as: "rating",
                  cond: { $eq: ["$$rating.rating", 5] },
                },
              },
            },
            totalRatingsCount: {
              $size: {
                $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
              },
            },
            satisfiedPatientPercentage: {
              $cond: {
                if: { $gt: ["$totalRatingsCount", 0] },
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
            availability: {
              $map: {
                input: "$availability",
                as: "availabilityDoc",
                in: {
                  ...{
                    $mergeObjects: [
                      "$$availabilityDoc",
                      {
                        hospitalAvailability: {
                          $map: {
                            input: "$$availabilityDoc.hospitalAvailability",
                            as: "hospital",
                            in: {
                              _id: "$$hospital._id",
                              hospitalId: "$$hospital.hospitalId",
                              hospitalName: {
                                $ifNull: [
                                  {
                                    $arrayElemAt: [
                                      "$hospitalDetails.name",
                                      {
                                        $indexOfArray: [
                                          "$hospitalDetails._id",
                                          "$$hospital.hospitalId",
                                        ],
                                      },
                                    ],
                                  },
                                  "Unknown Hospital",
                                ],
                              },
                              price: "$$hospital.price",
                              availability: "$$hospital.availability",
                              isAvailable: "$$hospital.isAvailable",
                            },
                          },
                        },
                      },
                    ],
                  },
                },
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
            phoneNumber: 1,
            email: 1,
            "location.address": 1,
            availability: 1,
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: docsPerPage },
      ]);

      // Fetch total doctor count for pagination
      const totalDocs = await Doctor.countDocuments({
        docCompanyId: docCompanyId,
      });
      const totalPages = Math.ceil(totalDocs / docsPerPage);

      // Pagination details
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Response
      return res.status(200).json({
        companyDocs,
        docCount: companyDocs.length,
        previousPage,
        nextPage,
        totalPages,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },

  async getCompanyPatients(req, res, next) {
    try {
      const patientId = req.query.patientId;
      const docCompanyId = req.user._id; // Use company ID from the logged-in user
      // const page = parseInt(req.query.page) || 1;
      // const patientPerPage = 10;
      // const status = req.query.status || "all";
      // // Helper function to determine match conditions based on status
      // const getMatchCondition = (status) => {
      //   if (status === "ongoing") return { docCompanyId, status: "completed" };
      //   if (status === "upcoming") return { docCompanyId, status: "pending" };
      //   return { docCompanyId, status: { $ne: "cancelled" } }; // Exclude cancelled appointments
      // };

      // const matchCondition = getMatchCondition(status);

      // Aggregation pipeline for appointments
      const appointmentPipeline = [
        {
          $match: {
            patientId: mongoose.Types.ObjectId(patientId),
            docCompanyId: mongoose.Types.ObjectId(docCompanyId), // Ensure hospital-wise filtering
          },
        },
        {
          $lookup: {
            from: "Users",
            localField: "patientId",
            foreignField: "_id",
            as: "Patients",
          },
        },
        {
          $unwind: {
            path: "$Patients",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "history",
            localField: "history",
            foreignField: "_id",
            as: "history",
          },
        },
        {
          $unwind: {
            path: "$history",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "e-prescription",
            localField: "ePrescription",
            foreignField: "_id",
            as: "ePrescription",
          },
        },
        {
          $unwind: {
            path: "$ePrescription",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "doctors",
            localField: "doctorId",
            foreignField: "_id",
            as: "doctorId",
          },
        },
        {
          $unwind: {
            path: "$doctorId",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "orders",
            localField: "_id",
            foreignField: "appointmentId",
            as: "labResults",
          },
        },
        {
          $unwind: {
            path: "$labResults",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "laboratories", // Join with the laboratories collection
            localField: "labResults.vendorId", // Match vendorId in labResults with _id in laboratories
            foreignField: "_id",
            as: "vendorId",
          },
        },
        {
          $unwind: {
            path: "$vendorId",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "tests", // Join with the tests collection
            localField: "labResults.items.itemId", // Match itemId in labResults.items
            foreignField: "_id",
            as: "tests", // Alias for populated test details
          },
        },
        {
          $lookup: {
            from: "testnames", // Join with the testNames collection
            localField: "tests.testNameId", // Match testNameId in tests
            foreignField: "_id",
            as: "testNameId", // Alias for populated test name details
          },
        },
        {
          $addFields: {
            "labResults.vendorId": {
              _id: "$vendorId._id", // Add vendor _id
              name: "$vendorId.name", // Add vendor name
            },
            "labResults.items": {
              $map: {
                input: "$labResults.items", // Iterate over each item in items
                as: "item",
                in: {
                  itemId: "$$item.itemId",
                  _id: "$$item._id",
                  testNameId: "$$item.testNameId",
                  name: {
                    $arrayElemAt: [
                      "$testNameId.name", // Fetch the name from testNameId
                      {
                        $indexOfArray: [
                          "$testNameId._id",
                          "$$item.testNameId", // Match testNameId to find the corresponding name
                        ],
                      },
                    ],
                  },
                },
              },
            },
            "labResults._id": "$labResults._id",
            "labResults.results": "$labResults.results",
            "labResults.createdAt": "$labResults.createdAt",
          },
        },
        {
          $group: {
            _id: "$patientId",
            name: { $first: "$Patients.name" },
            email: { $first: "$Patients.email" },
            gender: { $first: "$Patients.gender" },
            bloodGroup: { $first: "$Patients.bloodGroup" },
            mrNo: { $first: "$Patients.mrNo" },
            cnicOrPassNo: { $first: "$Patients.cnicOrPassNo" },
            phone: { $first: "$Patients.phone" },
            dateOfBirth: { $first: "$Patients.dateOfBirth" },
            userImage: { $first: "$patient.userImage" },
            createdAt: { $first: "$Patients.createdAt" },
            appointments: {
              $push: {
                _id: "$_id",
                appointmentId: "$appointmentId",
                paymentId: "$paymentId",
                doctorId: {
                  _id: "$doctorId._id",
                  name: "$doctorId.name",
                  vendorId: "$doctorId.vendorId",
                  doctorKind: "$doctorId.doctorKind",
                  doctorType: "$doctorId.doctorType",
                  gender: "$doctorId.gender",
                  phoneNumber: "$doctorId.phoneNumber",
                },
                status: "$status",
                history: "$history",
                ePrescription: "$ePrescription",
                appointmentDateAndTime: "$appointmentDateAndTime",
                isPaidFull: "$isPaidFull",
                appointmentType: "$appointmentType",
                patientId: "$patientId",
                totalAmount: "$totalAmount",
                labResults: {
                  _id: "$labResults._id",
                  vendorId: "$labResults.vendorId",
                  items: "$labResults.items",
                  results: "$labResults.results",
                  createdAt: "$labResults.createdAt",
                },
              },
            },
          },
        },
      ];

      // Aggregate appointments based on pipeline
      const patientsWithAppointments = await Appointment.aggregate(
        appointmentPipeline
      );
      const patientAppointments = await Appointment.aggregate(
        appointmentPipeline
      );

      if (patientAppointments.length === 0) {
        return res
          .status(404)
          .json({ message: "No appointments found for this patient" });
      }

      const patients = patientAppointments[0]; // Get the first result (one patient)

      // const patientIds = patientsWithAppointments.map((p) => p._id);
      // const totalPatients = patientIds.length;
      // const totalPages = Math.ceil(totalPatients / patientPerPage);
      // const skip = (page - 1) * patientPerPage;

      // // Function to get paginated patients with their appointments
      // const getPaginatedPatients = async (skip, limit) => {
      //   return await User.find({ _id: { $in: patientIds } })
      //     .sort({ createdAt: -1 })
      //     .skip(skip)
      //     .limit(limit)
      //     .lean();
      // };

      // const patients = await getPaginatedPatients(skip, patientPerPage);

      // // Mapping appointments to each patient
      // const result = patients.map((patient) => {
      //   const patientAppointments = patientsWithAppointments.find((p) =>
      //     p._id.equals(patient._id)
      //   );
      //   return {
      //     ...patient,
      //     appointments: patientAppointments
      //       ? patientAppointments.appointments
      //       : [],
      //   };
      // });

      // const patientsLength = result.length;
      // const previousPage = page > 1 ? page - 1 : null;
      // const nextPage = page < totalPages ? page + 1 : null;

      // Response
      return res.status(200).json({
        Patients: patients,
        // patientsLength,
        auth: true,
        // totalPages: totalPages,
        // previousPage: previousPage,
        // nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },

  async addDoctorCheck(req, res, next) {
    try {
      const docCompanyId = req.user._id;

      const doctorCompany = await DoctorCompany.findById(docCompanyId);

      if (!doctorCompany.paidActivation) {
        return res.status(200).json({
          status: false,
          message: "Please activate your account.",
          allowed: false,
        });
      }

      if (doctorCompany.doctorsAllowed === doctorCompany.doctorIds.length) {
        return res.status(200).json({
          status: false,
          message: "Limit reached, please pay to increase the limit.",
          allowed: false,
        });
      }

      return res.status(200).json({
        status: true,
        message: "You can add more doctors.",
        allowed: true,
      });
    } catch (error) {
      next(error);
    }
  },

  async increaseLimit(req, res, next) {
    try {
      const { numberOfDocs } = req.body;
      const docCompanyId = req.user._id;

      if (!numberOfDocs) {
        return res.status(400).json({ message: "numberOfDocs are required" });
      }

      const company = await DoctorCompany.findById(docCompanyId);

      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      if (!company.paidActivation) {
        return res.status(200).json({
          status: false,
          message: "Please activate your account.",
          allowed: false,
        });
      }

      company.doctorsAllowed += numberOfDocs;

      await company.save();

      res.status(200).json({
        message: "Doctor limit updated successfully",
        doctorAllowed: company.doctorsAllowed,
      });
    } catch (error) {
      next(error);
    }
  },
  async getCompanyPatientList(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const appointPerPage = 10;
      const docCompanyId = req.user._id;
      const status = req.query.status || "all";
      const appointmentDate = req.query.appointmentDateAndTime?.trim();
      const name = req.query.name?.trim();
      let query = {
        docCompanyId,
      };

      if (status) {
        if (status === "ongoing") {
          query.status = "completed"; // Map ongoing to completed
        } else if (status === "upcoming") {
          query.status = "pending"; // Map upcoming to pending
        } else if (status !== "cancelled") {
          query.status = { $ne: "cancelled" }; // Exclude cancelled
        }
      } else {
        query.status = "pending"; // Default status is pending if no status provided
      }

      if (appointmentDate) {
        const startOfDate = new Date(appointmentDate).setHours(0, 0, 0, 0);
        const endOfDate = new Date(appointmentDate).setHours(23, 59, 59, 999);

        query.appointmentDateAndTime = {
          $gte: new Date(startOfDate),
          $lt: new Date(endOfDate),
        };
      }

      let aggregatePipeline = [
        { $match: query }, // Match the initial query
        {
          $lookup: {
            from: "doctors", // The doctors collection name
            localField: "doctorId",
            foreignField: "_id",
            as: "doctorId",
          },
        },
        { $unwind: "$doctorId" },
        // Unwind the doctorId array
        {
          $lookup: {
            from: "Users", // The users collection name
            localField: "patientId",
            foreignField: "_id",
            as: "patientId",
          },
        },
        { $unwind: { path: "$patientId", preserveNullAndEmptyArrays: true } }, // Unwind patientInfo but allow empty results
        {
          $lookup: {
            from: "hospitals", // The users collection name
            localField: "hospital",
            foreignField: "_id",
            as: "hospital",
          },
        },
        { $unwind: { path: "$hospital", preserveNullAndEmptyArrays: true } }, // Unwind patientInfo but allow empty results
      ];

      if (name) {
        const regex = new RegExp(name, "i");
        aggregatePipeline.push({ $match: { "doctorId.name": regex } });
      }

      aggregatePipeline.push(
        { $sort: { appointmentDateAndTime: 1 } }, // Sort by appointment date
        { $skip: (page - 1) * appointPerPage }, // Skip records for pagination
        { $limit: appointPerPage } // Limit the number of records
      );

      const allAppointments = await Appointment.aggregate(aggregatePipeline);

      // const totalAppoints = await Appointment.countDocuments(query);

      // Use an aggregation pipeline for counting
      const countPipeline = [
        ...aggregatePipeline.slice(0, -3),
        { $count: "totalAppoints" },
      ];
      const countResult = await Appointment.aggregate(countPipeline);
      const totalAppoints =
        countResult.length > 0 ? countResult[0].totalAppoints : 0;

      const totalPages = Math.ceil(totalAppoints / appointPerPage);
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        Appointments: allAppointments,
        auth: true,
        totalAppoints,
        previousPage,
        nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = docCompanyDocController;
