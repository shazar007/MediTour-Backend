const express = require("express");
const mongoose = require("mongoose");
const TravelCompany = require("../../models/Travel Company/travelCompany.js");
const Request = require("../../models/Travel Company/requests.js");
const Hotel = require("../../models/Hotel/hotel.js");
const Agency = require("../../models/Travel Agency/travelAgency.js");
const VerificationCode = require("../../models/verificationCode.js");
const transporter = require("../../utils/gmail.js");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

const travelCompanyController = {
  async sendCodeToAgencyEmail(req, res, next) {
    const companyId = req.user._id;
    const type = req.body.type;
    const email = req.body.email;
    const isCompanyAddingAgency = req.body.isCompanyAddingAgency;
    const travelCompany = await TravelCompany.findById(companyId);
    let travelCompanyName = null;

    if (travelCompany) {
      travelCompanyName = travelCompany.name || null;
    }

    if (travelCompany.activationRequest === "inProgress") {
      return next({
        status: 403,
        message: "Your account will be activated within the next hour",
      });
    } else if (travelCompany.activationRequest === "pending") {
      return next({
        status: 403,
        message: "Please pay the activation fee to activate your account",
      });
    }

    if (!isCompanyAddingAgency) {
      const user = await Agency.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "Agency not found!" });
      }
      if (
        user.travelCompanyId &&
        user.travelCompanyId.toString() === companyId.toString()
      ) {
        return res.status(400).json({
          message: "Agency is already associated with your company!",
        });
      }

      // Check if the doctor is associated with another company
      if (
        user.travelCompanyId &&
        user.travelCompanyId.toString() !== companyId.toString()
      ) {
        return res.status(403).json({
          message: "Agency is already associated with another company!",
        });
      }
    } else if (isCompanyAddingAgency) {
      const user = await Agency.findOne({ email });
      if (user) {
        return res.status(404).json({ message: "Agency already exists!" });
      }
    }

    if (!travelCompany) {
      return res.status(404).json({ message: "Travel Company not found!" });
    }

    try {
      // Invalidate previous codes for this email
      await VerificationCode.deleteMany({ email });

      const customExpiration = !isCompanyAddingAgency
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 2 * 60 * 1000);
      const codeToSave = new VerificationCode({
        email: email,
        code: Math.floor(100000 + Math.random() * 900000),
        ...(customExpiration && { expiresAt: customExpiration }),
      });

      const code = await codeToSave.save();

      const acceptUrl = `https://meditour.global//travelAgency/dashboard?email=${encodeURIComponent(
        email
      )}&type=${encodeURIComponent(
        "travelagency"
      )}&travelCompanyId=${encodeURIComponent(
        companyId
      )}&travelCompanyName=${encodeURIComponent(travelCompanyName)}`;

      // Email options
      const mailOptions = {
        from: "no-reply@example.com",
        to: email,
        subject: "Account Verification",
        html: `
              <p>You are being added by <strong>${travelCompanyName}</strong> as a travel agency<strong></strong> in Meditour Dashboard.</p>
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
                !isCompanyAddingAgency
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
  async sendCodeToHotelEmail(req, res, next) {
    const companyId = req.user._id;
    const type = req.body.type;
    const email = req.body.email;
    const isCompanyAddingHotel = req.body.isCompanyAddingHotel;
    const travelCompany = await TravelCompany.findById(companyId);
    let travelCompanyName = null;

    if (travelCompany) {
      travelCompanyName = travelCompany.name || null;
    }

    if (travelCompany.activationRequest === "inProgress") {
      return next({
        status: 403,
        message: "Your account will be activated within the next hour",
      });
    } else if (travelCompany.activationRequest === "pending") {
      return next({
        status: 403,
        message: "Please pay the activation fee to activate your account",
      });
    }

    if (!isCompanyAddingHotel) {
      const user = await Hotel.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "Agency not found!" });
      }
      if (
        user.travelCompanyId &&
        user.travelCompanyId.toString() === companyId.toString()
      ) {
        return res.status(400).json({
          message: "Hotel is already associated with your company!",
        });
      }

      // Check if the doctor is associated with another company
      if (
        user.travelCompanyId &&
        user.travelCompanyId.toString() !== companyId.toString()
      ) {
        return res.status(403).json({
          message: "Hotel is already associated with another company!",
        });
      }
    } else {
      const user = await Hotel.findOne({ email });
      if (user) {
        return res.status(404).json({ message: "Hotel already exists!" });
      }
    }

    if (!travelCompany) {
      return res.status(404).json({ message: "Travel Company not found!" });
    }

    try {
      // Invalidate previous codes for this email
      await VerificationCode.deleteMany({ email });

      const customExpiration = !isCompanyAddingHotel
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 2 * 60 * 1000);
      const codeToSave = new VerificationCode({
        email: email,
        code: Math.floor(100000 + Math.random() * 900000),
        ...(customExpiration && { expiresAt: customExpiration }),
      });

      const code = await codeToSave.save();

      const acceptUrl = `https://meditour.global//hotel/dashboard?email=${encodeURIComponent(
        email
      )}&type=${encodeURIComponent(
        "hotel"
      )}&travelCompanyId=${encodeURIComponent(
        companyId
      )}&travelCompanyName=${encodeURIComponent(travelCompanyName)}`;

      // Email options
      const mailOptions = {
        from: "no-reply@example.com",
        to: email,
        subject: "Account Verification",
        html: `
              <p>You are being added by <strong>${travelCompanyName}</strong> as a hotel<strong></strong> in Meditour Dashboard.</p>
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
                !isCompanyAddingHotel
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

  // async getCompanyDocs(req, res, next) {
  //   try {
  //     const docCompanyId = req.user._id;
  //     const page = parseInt(req.query.page) || 1;
  //     const docsPerPage = 10;

  //     // Pagination variables
  //     const skip = (page - 1) * docsPerPage;

  //     // Fetch company doctors with additional details
  //     const companyDocs = await Doctor.aggregate([
  //       {
  //         $match: {
  //           docCompanyId: docCompanyId,
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "ratings",
  //           localField: "_id",
  //           foreignField: "vendorId",
  //           as: "ratings",
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "availability",
  //           localField: "_id",
  //           foreignField: "doctorId",
  //           as: "availability",
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: "hospitals",
  //           localField: "availability.hospitalAvailability.hospitalId",
  //           foreignField: "_id",
  //           as: "hospitalDetails",
  //         },
  //       },
  //       {
  //         $addFields: {
  //           ratingsArray: {
  //             $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
  //           },
  //           satisfiedPatientCount: {
  //             $size: {
  //               $filter: {
  //                 input: {
  //                   $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
  //                 },
  //                 as: "rating",
  //                 cond: { $eq: ["$$rating.rating", 5] },
  //               },
  //             },
  //           },
  //           totalRatingsCount: {
  //             $size: {
  //               $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
  //             },
  //           },
  //           satisfiedPatientPercentage: {
  //             $cond: {
  //               if: { $gt: ["$totalRatingsCount", 0] },
  //               then: {
  //                 $multiply: [
  //                   {
  //                     $divide: ["$satisfiedPatientCount", "$totalRatingsCount"],
  //                   },
  //                   100,
  //                 ],
  //               },
  //               else: 0,
  //             },
  //           },
  //           availability: {
  //             $map: {
  //               input: "$availability",
  //               as: "availabilityDoc",
  //               in: {
  //                 ...{
  //                   $mergeObjects: [
  //                     "$$availabilityDoc",
  //                     {
  //                       hospitalAvailability: {
  //                         $map: {
  //                           input: "$$availabilityDoc.hospitalAvailability",
  //                           as: "hospital",
  //                           in: {
  //                             _id: "$$hospital._id",
  //                             hospitalId: "$$hospital.hospitalId",
  //                             hospitalName: {
  //                               $ifNull: [
  //                                 {
  //                                   $arrayElemAt: [
  //                                     "$hospitalDetails.name",
  //                                     {
  //                                       $indexOfArray: [
  //                                         "$hospitalDetails._id",
  //                                         "$$hospital.hospitalId",
  //                                       ],
  //                                     },
  //                                   ],
  //                                 },
  //                                 "Unknown Hospital",
  //                               ],
  //                             },
  //                             price: "$$hospital.price",
  //                             availability: "$$hospital.availability",
  //                             isAvailable: "$$hospital.isAvailable",
  //                           },
  //                         },
  //                       },
  //                     },
  //                   ],
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //       {
  //         $project: {
  //           name: 1,
  //           doctorImage: 1,
  //           qualifications: 1,
  //           clinicExperience: 1,
  //           isRecommended: 1,
  //           hasPMDCNumber: {
  //             $cond: [{ $ifNull: ["$pmdcNumber", false] }, true, false],
  //           },
  //           satisfiedPatientCount: 1,
  //           satisfiedPatientPercentage: 1,
  //           phoneNumber: 1,
  //           email: 1,
  //           "location.address": 1,
  //           availability: 1,
  //         },
  //       },
  //       { $sort: { createdAt: -1 } },
  //       { $skip: skip },
  //       { $limit: docsPerPage },
  //     ]);

  //     // Fetch total doctor count for pagination
  //     const totalDocs = await Doctor.countDocuments({
  //       docCompanyId: docCompanyId,
  //     });
  //     const totalPages = Math.ceil(totalDocs / docsPerPage);

  //     // Pagination details
  //     const previousPage = page > 1 ? page - 1 : null;
  //     const nextPage = page < totalPages ? page + 1 : null;

  //     // Response
  //     return res.status(200).json({
  //       companyDocs,
  //       docCount: companyDocs.length,
  //       previousPage,
  //       nextPage,
  //       totalPages,
  //       auth: true,
  //     });
  //   } catch (error) {
  //     return next(error);
  //   }
  // },

  //   async getCompanyPatients(req, res, next) {
  //     try {
  //       const patientId = req.query.patientId;
  //       const docCompanyId = req.user._id; // Use company ID from the logged-in user
  //       // const page = parseInt(req.query.page) || 1;
  //       // const patientPerPage = 10;
  //       // const status = req.query.status || "all";
  //       // // Helper function to determine match conditions based on status
  //       // const getMatchCondition = (status) => {
  //       //   if (status === "ongoing") return { docCompanyId, status: "completed" };
  //       //   if (status === "upcoming") return { docCompanyId, status: "pending" };
  //       //   return { docCompanyId, status: { $ne: "cancelled" } }; // Exclude cancelled appointments
  //       // };

  //       // const matchCondition = getMatchCondition(status);

  //       // Aggregation pipeline for appointments
  //       const appointmentPipeline = [
  //         {
  //           $match: {
  //             patientId: mongoose.Types.ObjectId(patientId),
  //             docCompanyId: mongoose.Types.ObjectId(docCompanyId), // Ensure hospital-wise filtering
  //           },
  //         },
  //         {
  //           $lookup: {
  //             from: "history",
  //             localField: "history",
  //             foreignField: "_id",
  //             as: "history",
  //           },
  //         },
  //         {
  //           $unwind: {
  //             path: "$history",
  //             preserveNullAndEmptyArrays: true,
  //           },
  //         },
  //         {
  //           $lookup: {
  //             from: "e-prescription",
  //             localField: "ePrescription",
  //             foreignField: "_id",
  //             as: "ePrescription",
  //           },
  //         },
  //         {
  //           $unwind: {
  //             path: "$ePrescription",
  //             preserveNullAndEmptyArrays: true,
  //           },
  //         },
  //         {
  //           $lookup: {
  //             from: "doctors",
  //             localField: "doctorId",
  //             foreignField: "_id",
  //             as: "doctorId",
  //           },
  //         },
  //         {
  //           $unwind: {
  //             path: "$doctorId",
  //             preserveNullAndEmptyArrays: true,
  //           },
  //         },
  //         {
  //           $lookup: {
  //             from: "orders",
  //             localField: "_id",
  //             foreignField: "appointmentId",
  //             as: "labResults",
  //           },
  //         },
  //         {
  //           $unwind: {
  //             path: "$labResults",
  //             preserveNullAndEmptyArrays: true,
  //           },
  //         },
  //         {
  //           $lookup: {
  //             from: "laboratories", // Join with the laboratories collection
  //             localField: "labResults.vendorId", // Match vendorId in labResults with _id in laboratories
  //             foreignField: "_id",
  //             as: "vendorId",
  //           },
  //         },
  //         {
  //           $unwind: {
  //             path: "$vendorId",
  //             preserveNullAndEmptyArrays: true,
  //           },
  //         },
  //         {
  //           $lookup: {
  //             from: "tests", // Join with the tests collection
  //             localField: "labResults.items.itemId", // Match itemId in labResults.items
  //             foreignField: "_id",
  //             as: "tests", // Alias for populated test details
  //           },
  //         },
  //         {
  //           $lookup: {
  //             from: "testnames", // Join with the testNames collection
  //             localField: "tests.testNameId", // Match testNameId in tests
  //             foreignField: "_id",
  //             as: "testNameId", // Alias for populated test name details
  //           },
  //         },
  //         {
  //           $addFields: {
  //             "labResults.vendorId": {
  //               _id: "$vendorId._id", // Add vendor _id
  //               name: "$vendorId.name", // Add vendor name
  //             },
  //             "labResults.items": {
  //               $map: {
  //                 input: "$labResults.items", // Iterate over each item in items
  //                 as: "item",
  //                 in: {
  //                   itemId: "$$item.itemId",
  //                   _id: "$$item._id",
  //                   testNameId: "$$item.testNameId",
  //                   name: {
  //                     $arrayElemAt: [
  //                       "$testNameId.name", // Fetch the name from testNameId
  //                       {
  //                         $indexOfArray: [
  //                           "$testNameId._id",
  //                           "$$item.testNameId", // Match testNameId to find the corresponding name
  //                         ],
  //                       },
  //                     ],
  //                   },
  //                 },
  //               },
  //             },
  //             "labResults._id": "$labResults._id",
  //             "labResults.results": "$labResults.results",
  //             "labResults.createdAt": "$labResults.createdAt",
  //           },
  //         },
  //         {
  //           $group: {
  //             _id: "$patientId",
  //             appointments: {
  //               $push: {
  //                 _id: "$_id",
  //                 appointmentId: "$appointmentId",
  //                 paymentId: "$paymentId",
  //                 doctorId: {
  //                   _id: "$doctorId._id",
  //                   name: "$doctorId.name",
  //                   vendorId: "$doctorId.vendorId",
  //                   doctorKind: "$doctorId.doctorKind",
  //                   doctorType: "$doctorId.doctorType",
  //                   gender: "$doctorId.gender",
  //                   phoneNumber: "$doctorId.phoneNumber",
  //                 },
  //                 status: "$status",
  //                 history: "$history",
  //                 ePrescription: "$ePrescription",
  //                 appointmentDateAndTime: "$appointmentDateAndTime",
  //                 isPaidFull: "$isPaidFull",
  //                 appointmentType: "$appointmentType",
  //                 patientId: "$patientId",
  //                 totalAmount: "$totalAmount",
  //                 labResults: {
  //                   _id: "$labResults._id",
  //                   vendorId: "$labResults.vendorId",
  //                   items: "$labResults.items",
  //                   results: "$labResults.results",
  //                   createdAt: "$labResults.createdAt",
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       ];

  //       // Aggregate appointments based on pipeline
  //       const patientsWithAppointments = await Appointment.aggregate(
  //         appointmentPipeline
  //       );
  //       const patientAppointments = await Appointment.aggregate(
  //         appointmentPipeline
  //       );

  //       if (patientAppointments.length === 0) {
  //         return res
  //           .status(404)
  //           .json({ message: "No appointments found for this patient" });
  //       }

  //       const patients = patientAppointments[0]; // Get the first result (one patient)

  //       // const patientIds = patientsWithAppointments.map((p) => p._id);
  //       // const totalPatients = patientIds.length;
  //       // const totalPages = Math.ceil(totalPatients / patientPerPage);
  //       // const skip = (page - 1) * patientPerPage;

  //       // // Function to get paginated patients with their appointments
  //       // const getPaginatedPatients = async (skip, limit) => {
  //       //   return await User.find({ _id: { $in: patientIds } })
  //       //     .sort({ createdAt: -1 })
  //       //     .skip(skip)
  //       //     .limit(limit)
  //       //     .lean();
  //       // };

  //       // const patients = await getPaginatedPatients(skip, patientPerPage);

  //       // // Mapping appointments to each patient
  //       // const result = patients.map((patient) => {
  //       //   const patientAppointments = patientsWithAppointments.find((p) =>
  //       //     p._id.equals(patient._id)
  //       //   );
  //       //   return {
  //       //     ...patient,
  //       //     appointments: patientAppointments
  //       //       ? patientAppointments.appointments
  //       //       : [],
  //       //   };
  //       // });

  //       // const patientsLength = result.length;
  //       // const previousPage = page > 1 ? page - 1 : null;
  //       // const nextPage = page < totalPages ? page + 1 : null;

  //       // Response
  //       return res.status(200).json({
  //         Patients: patients,
  //         // patientsLength,
  //         auth: true,
  //         // totalPages: totalPages,
  //         // previousPage: previousPage,
  //         // nextPage: nextPage,
  //       });
  //     } catch (error) {
  //       return next(error);
  //     }
  //   },

  async addHotelOrAgencyCheck(req, res, next) {
    try {
      const travelCompanyId = req.user._id;
      const type = req.query.type;

      const travelCompany = await TravelCompany.findById(travelCompanyId);

      if (!travelCompany.paidActivation) {
        return res.status(200).json({
          status: false,
          message: "Please activate your account.",
          allowed: false,
        });
      }
      if (type == "agency") {
        if (travelCompany.agenciesAllowed === travelCompany.agencyIds.length) {
          return res.status(200).json({
            status: false,
            message: "Limit reached, please pay to increase the limit.",
            allowed: false,
          });
        }
      } else if (type == "hotel") {
        if (travelCompany.hotelsAllowed === travelCompany.hotelIds.length) {
          return res.status(200).json({
            status: false,
            message: "Limit reached, please pay to increase the limit.",
            allowed: false,
          });
        }
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
  //   async getCompanyPatientList(req, res, next) {
  //     try {
  //       const page = parseInt(req.query.page) || 1; // Default to page 1
  //       const appointPerPage = 10;
  //       const docCompanyId = req.user._id;
  //       const status = req.query.status || "all";
  //       const appointmentDate = req.query.appointmentDateAndTime?.trim();
  //       const name = req.query.name?.trim();
  //       let query = {
  //         docCompanyId,
  //       };

  //       if (status) {
  //         if (status === "ongoing") {
  //           query.status = "completed"; // Map ongoing to completed
  //         } else if (status === "upcoming") {
  //           query.status = "pending"; // Map upcoming to pending
  //         } else if (status !== "cancelled") {
  //           query.status = { $ne: "cancelled" }; // Exclude cancelled
  //         }
  //       } else {
  //         query.status = "pending"; // Default status is pending if no status provided
  //       }

  //       if (appointmentDate) {
  //         const startOfDate = new Date(appointmentDate).setHours(0, 0, 0, 0);
  //         const endOfDate = new Date(appointmentDate).setHours(23, 59, 59, 999);

  //         query.appointmentDateAndTime = {
  //           $gte: new Date(startOfDate),
  //           $lt: new Date(endOfDate),
  //         };
  //       }

  //       let aggregatePipeline = [
  //         { $match: query }, // Match the initial query
  //         {
  //           $lookup: {
  //             from: "doctors", // The doctors collection name
  //             localField: "doctorId",
  //             foreignField: "_id",
  //             as: "doctorId",
  //           },
  //         },
  //         { $unwind: "$doctorId" },
  //         // Unwind the doctorId array
  //         {
  //           $lookup: {
  //             from: "Users", // The users collection name
  //             localField: "patientId",
  //             foreignField: "_id",
  //             as: "patientId",
  //           },
  //         },
  //         { $unwind: { path: "$patientId", preserveNullAndEmptyArrays: true } }, // Unwind patientInfo but allow empty results
  //         {
  //           $lookup: {
  //             from: "hospitals", // The users collection name
  //             localField: "hospital",
  //             foreignField: "_id",
  //             as: "hospital",
  //           },
  //         },
  //         { $unwind: { path: "$hospital", preserveNullAndEmptyArrays: true } }, // Unwind patientInfo but allow empty results
  //       ];

  //       if (name) {
  //         const regex = new RegExp(name, "i");
  //         aggregatePipeline.push({ $match: { "doctorId.name": regex } });
  //       }

  //       aggregatePipeline.push(
  //         { $sort: { appointmentDateAndTime: 1 } }, // Sort by appointment date
  //         { $skip: (page - 1) * appointPerPage }, // Skip records for pagination
  //         { $limit: appointPerPage } // Limit the number of records
  //       );

  //       const allAppointments = await Appointment.aggregate(aggregatePipeline);

  //       // const totalAppoints = await Appointment.countDocuments(query);

  //       // Use an aggregation pipeline for counting
  //       const countPipeline = [
  //         ...aggregatePipeline.slice(0, -3),
  //         { $count: "totalAppoints" },
  //       ];
  //       const countResult = await Appointment.aggregate(countPipeline);
  //       const totalAppoints =
  //         countResult.length > 0 ? countResult[0].totalAppoints : 0;

  //       const totalPages = Math.ceil(totalAppoints / appointPerPage);
  //       const previousPage = page > 1 ? page - 1 : null;
  //       const nextPage = page < totalPages ? page + 1 : null;

  //       return res.status(200).json({
  //         Appointments: allAppointments,
  //         auth: true,
  //         totalAppoints,
  //         previousPage,
  //         nextPage,
  //       });
  //     } catch (error) {
  //       return next(error);
  //     }
  //   },

  async getRequests(req, res, next) {
    try {
      const travelCompanyId = req.user._id;
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const status = req.query.status;
      const type = req.query.type;
      let vendorModel;

      if (type === "agency") {
        vendorModel = "Travel Agency";
      } else if (type === "hotel") {
        vendorModel = "Hotel";
      }

      let collectionName;
      if (type === "agency") {
        collectionName = "travel agencies";
      } else if (type === "hotel") {
        collectionName = "hotels";
      }

      const skip = (page - 1) * limit;

      // Aggregation pipeline with vendorId population
      const travelCompaniesPipeline = [
        { $match: { vendorModel, travelCompanyId, status } },
        {
          $lookup: {
            from: collectionName,
            localField: "vendorId",
            foreignField: "_id",
            as: "vendorDetails",
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
            from: "hotel and bnb",
            localField: "_id",
            foreignField: "hotelId",
            as: "hotelDetails",
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
            toursCount: {
              $size: {
                $ifNull: ["$tours", []],
              },
            },
            totalRooms: {
              $size: {
                $ifNull: ["$hotelDetails.rooms", []],
              },
            },
          },
        },
        // Replace vendorId with the vendorDetails data
        {
          $project: {
            _id: 1,
            vendorId: { $arrayElemAt: ["$vendorDetails", 0] }, // This will insert the vendorDetails object into vendorId field
            satisfiedPatientCount: 1,
            satisfiedPatientPercentage: 1,
            totalRatingsCount: 1,
            vendorModel: 1,
            status: 1,
            ...(type === "agency" && { toursCount: 1 }),
            ...(type === "hotel" && { totalRooms: 1 }),
          },
        },
        { $skip: skip },
        { $limit: limit },
      ];

      // Execute the pipeline
      const travelCompanies = await Request.aggregate(travelCompaniesPipeline);

      // Total count for pagination
      const travelCompaniesCount = await Request.countDocuments({
        vendorModel,
        travelCompanyId,
        status,
      });

      const totalPages = Math.ceil(travelCompaniesCount / limit);

      // Calculate previous and next page numbers
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Return the response with the required data
      return res.json({
        totalCount: travelCompaniesCount,
        currentPage: page,
        totalPages: totalPages,
        previousPage: previousPage,
        nextPage: nextPage,
        data: travelCompanies,
      });
    } catch (error) {
      next(error);
    }
  },
  async acceptRequest(req, res, next) {
    try {
      const travelCompanyId = req.user._id;
      const { requestId } = req.query;
      const request = await Request.findById(requestId);
      if (!request) {
        return res.status(200).json({
          status: false,
          message: "Request not found!",
          allowed: false,
        });
      }
      if (request.status !== "pending") {
        return res.status(200).json({
          status: false,
          message: "Request status should be pending to be accepted!",
          allowed: false,
        });
      }
      request.status = "accepted";
      let model;
      modelType = request.vendorModel;
      console.log("modelType", modelType);
      switch (modelType) {
        case "Hotel":
          model = Hotel;
          break; // Prevent fall-through
        case "Travel Agency":
          model = Agency;
          break; // Prevent fall-through
        default:
          return res.status(400).json({
            status: false,
            message: "Invalid model type!",
            allowed: false,
          });
      }
      const vendor = await model.findById(request.vendorId);

      const travelCompany = await TravelCompany.findById(travelCompanyId);
      if (modelType == "Hotel") {
        travelCompany.hotelIds.push(vendor._id);
      } else if (modelType == "Travel Agency") {
        travelCompany.agencyIds.push(vendor._id);
      }
      if (vendor.travelCompanyId) {
        return res.status(200).json({
          status: false,
          message: "Vendor is already associated with a company!",
          allowed: false,
        });
      }
      await travelCompany.save();
      vendor.travelCompanyId = travelCompanyId;
      vendor.entityType = "company";
      vendor.paidActivation = true;
      vendor.activationRequest = "accepted";

      await request.save();
      await vendor.save();
      return res.status(200).json({
        status: false,
        message: "Request accepted successfully!",
        allowed: false,
      });
    } catch (error) {
      next(error);
    }
  },

  async rejectRequest(req, res, next) {
    try {
      const { requestId } = req.query;
      const request = await Request.findById(requestId);
      if (!request) {
        return res.status(200).json({
          status: false,
          message: "Request not found!",
          allowed: false,
        });
      }
      if (request.status !== "pending") {
        return res.status(200).json({
          status: false,
          message: "Request status should be pending to be rejected!",
          allowed: false,
        });
      }
      request.status = "rejected";
      await request.save();
      return res.status(200).json({
        status: true,
        message: "Request rejected successfully!",
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = travelCompanyController;
