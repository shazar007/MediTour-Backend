const express = require("express");
const mongoose = require("mongoose");
const app = express();
const Appointment = require("../../models/All Doctors Models/appointment");
const Doctor = require("../../models/Doctor/doctors");
const Hospital = require("../../models/Hospital/hospital");
const Admin = require("../../models/Admin/Admin");
const EmailValidator = require("email-validator");
const nodemailer = require("nodemailer");
const Medicine = require("../../models/Pharmaceutical/medicine");
const User = require("../../models/User/user");
const AppointmentRequest = require("../../models/All Doctors Models/request");
const Treatment = require("../../models/All Doctors Models/treatments");
const BookTreatment = require("../../models/All Doctors Models/bookTreatment");
const Category = require("../../models/All Doctors Models/categories");
const Country = require("../../models/countries");
const CountryWiseRates = require("../../models/countryWiseCharges");
const Hotel = require("../../models/Hotel/hotel.js");
const Insurance = require("../../models/Insurance/insurance.js");
const Donations = require("../../models/Donation/donationCompany.js");
const Pharmaceutical = require("../../models/Pharmaceutical/pharmaceutical.js");
const AmbulanceCompany = require("../../models/Ambulance/ambulanceCompany.js");
const RentACar = require("../../models/Rent A Car/rentCar.js");
const TravelAgency = require("../../models/Travel Agency/travelAgency.js");
const Pharmacy = require("../../models/Pharmacy/pharmacy.js");
const TravelCompany = require("../../models/Travel Company/travelCompany.js");
const DoctorCompany = require("../../models/DoctorCompany/docCompany.js");
const Laboratory = require("../../models/Laboratory/laboratory.js");
const { sendchatNotification } = require("../../firebase/service");
const Notification = require("../../models/notification");
const transporter = require("../../utils/gmail");
const Joi = require("joi");

const docAppointController = {
  async getAllAppointments(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const appointPerPage = 10;
      const doctorId = req.user._id; // Assuming doctorId is stored in req.user._id
      let currentDate = new Date(); // Get the current date and time
      currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
      console.log("currentDate", currentDate);

      // Define the query to find pending appointments for the doctor
      let query = { doctorId, status: "pending" };

      // Adjust query to include appointments based on current date if needed
      query.appointmentDateAndTime = { $gte: currentDate };

      // Get the total number of appointments matching the query
      const totalAppoints = await Appointment.countDocuments(query);

      const totalPages = Math.ceil(totalAppoints / appointPerPage); // Calculate the total number of pages
      const skip = (page - 1) * appointPerPage; // Calculate the number of appointments to skip based on the current page

      // Find appointments matching the query, sort based on current date
      const allAppointments = await Appointment.find(query)
        .sort({ appointmentDateAndTime: 1 }) // Sort by appointmentDateAndTime field in ascending order
        .populate("patientId doctorId history")
        .skip(skip)
        .limit(appointPerPage);

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        Appointments: allAppointments,
        auth: true,
        totalAppoints,
        totalPages,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
  async getAllPatients(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const patientPerPage = 10;
      const doctorId = req.user._id;

      // Find all appointments completed by the doctor
      const allAppointments = await Appointment.find({
        doctorId,
        status: "completed",
      }).sort({ createdAt: -1 }); // Sort appointments by appointmentDate in descending order

      // Extract unique patient IDs from the appointments
      const patientsSet = new Set(
        allAppointments.map((appoint) => appoint.patientId)
      );
      const uniquePatients = Array.from(patientsSet);

      // Find total number of unique patients
      const totalPatients = uniquePatients.length;
      const totalPages = Math.ceil(totalPatients / patientPerPage); // Calculate the total number of pages

      const skip = (page - 1) * patientPerPage; // Calculate the number of patients to skip based on the current page

      // Find patients based on their unique IDs
      const patients = await User.find({ _id: { $in: uniquePatients } })
        .sort({ createdAt: -1 }) // Sort patients by creation date in descending order
        .skip(skip)
        .limit(patientPerPage);

      const patientsLength = patients.length;
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        Patients: patients,
        patientsLength,
        totalPages,
        auth: true,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
  //for patient detail in doc...//
  async patientHistory(req, res, next) {
    try {
      const patientId = req.query.id;
      const doctorId = req.user._id;
      const user = await User.findById(patientId);
      if (!user) {
        const error = new Error("Patient not found!");
        error.status = 400;
        return next(error);
      }

      const appointmentPipeline = [
        {
          $match: {
            patientId: mongoose.Types.ObjectId(patientId),
            doctorId: mongoose.Types.ObjectId(doctorId), // Ensure hospital-wise filtering
          },
        },
        {
          $lookup: {
            from: "Users", // Name of the patients collection
            localField: "patientId", // Field in the current collection
            foreignField: "_id", // Field in the patients collection
            as: "patientId",
          },
        },
        {
          $unwind: {
            path: "$patientId",
            preserveNullAndEmptyArrays: true, // In case a patient record doesn't exist
          },
        },
        {
          $lookup: {
            from: "book treatments",
            localField: "treatmentId",
            foreignField: "_id",
            as: "treatmentId",
          },
        },
        {
          $unwind: {
            path: "$treatmentId",
            preserveNullAndEmptyArrays: true, // Prevent errors if treatment is null
          },
        },
        {
          $lookup: {
            from: "treatments", // Collection name for treatments
            localField: "treatmentId.treatmentId", // The field in book treatments
            foreignField: "_id", // The field in the treatments collection
            as: "treatmentId",
          },
        },
        {
          $unwind: {
            path: "$treatmentId",
            preserveNullAndEmptyArrays: true, // Prevent errors if no matching treatment is found
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
            from: "patientInvoice",
            localField: "invoiceId",
            foreignField: "_id",
            as: "invoiceId",
          },
        },
        {
          $unwind: {
            path: "$invoiceId",
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
            let: { appointmentId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$appointmentId", "$$appointmentId"] },
                },
              },
            ],
            as: "labResults",
          },
        },
        // Lookup Vendor Details (Laboratories)
        {
          $lookup: {
            from: "laboratories",
            localField: "labResults.vendorId", // Match vendorId in labResults with _id in laboratories
            foreignField: "_id",
            as: "vendorId", // Alias for populated vendor details
          },
        },
        {
          $unwind: {
            path: "$vendorId",
            preserveNullAndEmptyArrays: true, // Keep unmatched results
          },
        },
        // Lookup Test Details
        {
          $lookup: {
            from: "tests", // Join with the tests collection
            localField: "labResults.items.itemId", // Match itemId in labResults.items
            foreignField: "_id",
            as: "tests", // Alias for populated test details
          },
        },
        {
          $unwind: {
            path: "$tests",
            preserveNullAndEmptyArrays: true, // Keep unmatched results
          },
        },
        {
          $group: {
            _id: "$_id",
            tests: { $push: "$tests" },
            root: { $first: "$$ROOT" },
          },
        },
        {
          $replaceRoot: { newRoot: "$root" },
        },
        // Lookup Test Name Details
        {
          $lookup: {
            from: "testnames", // Join with the testNames collection
            localField: "tests.testNameId", // Match testNameId in tests
            foreignField: "_id",
            as: "testNameId", // Alias for populated test name details
          },
        },
        {
          $unwind: {
            path: "$testNameId",
            preserveNullAndEmptyArrays: true, // Keep unmatched results
          },
        },
        // Add Fields to Lab Results
        {
          $addFields: {
            labResults: {
              $map: {
                input: "$labResults",
                as: "result",
                in: {
                  _id: "$$result._id",
                  vendorId: "$$result.vendorId",
                  name: "$vendorId.name", // Properly mapped vendor name
                  items: {
                    $map: {
                      input: "$$result.items",
                      as: "item",
                      in: {
                        itemId: "$$item.itemId",
                        _id: "$$item._id",

                        name: "$testNameId.name", // Properly mapped test name
                      },
                    },
                  },
                  results: "$$result.results",
                  createdAt: "$$result.createdAt",
                },
              },
            },
          },
        },
        {
          $group: {
            _id: "$patientId",
            name: { $first: "$patient.name" },
            email: { $first: "$patient.email" },
            gender: { $first: "$patient.gender" },
            qualification: { $first: "$patient.qualification" },
            bloodGroup: { $first: "$patient.bloodGroup" },
            mrNo: { $first: "$patient.mrNo" },
            cnicOrPassNo: { $first: "$patient.cnicOrPassNo" },
            phone: { $first: "$patient.phone" },
            dateOfBirth: { $first: "$patient.dateOfBirth" },
            userImage: { $first: "$patient.userImage" },
            createdAt: { $first: "$patient.createdAt" },
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
                  qualifications: "$doctorId.qualifications",
                  pmdcNumber: "$doctorId.pmdcNumber",
                },
                status: "$status",
                history: "$history",
                ePrescription: "$ePrescription",
                appointmentDateAndTime: "$appointmentDateAndTime",
                isPaidFull: "$isPaidFull",
                appointmentType: "$appointmentType",
                patientId: "$patientId",
                totalAmount: "$totalAmount",
                treatmentId: "$treatmentId",
                patientId: "$patientId",
                invoiceId: "$invoiceId",
                labResults: "$labResults",
              },
            },
          },
        },
      ];

      const allAppointments = await Appointment.aggregate(appointmentPipeline);

      if (allAppointments.length === 0) {
        return res
          .status(404)
          .json({ message: "No appointments found for this patient" });
      }

      const patient = allAppointments[0]; // Get the first result (one patient)

      return res.status(200).json({
        patient,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },

  async getAppointment(req, res, next) {
    try {
      const appointmentId = req.query.appointmentId;
      const appointment = await Appointment.findById(appointmentId).populate(
        "doctorId patientId ePrescription history"
      );
      res.status(200).json({
        appointment,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },
  async appointmentLink(req, res, next) {
    try {
      const doctorId = req.user._id; // Doctor's ID from authenticated user
      const appointmentId = req.query.appointmentId; // Appointment ID from query
      const appointmentLink = req.body.appointmentLink; // Link sent in request body

      // Check if the appointment exists and belongs to the doctor
      const appointment = await Appointment.findOne({
        _id: appointmentId,
        doctorId: doctorId,
      });

      if (!appointment) {
        return res.status(404).json([]);
      }

      // Update the appointment with the new link
      appointment.appointmentLink = appointmentLink;
      await appointment.save();
      // Fetch patient details
      const patientId = appointment.patientId;
      const patient = await User.findById(patientId);
      if (!patient) {
        return res.status(404).json([]);
      }
      const patientEmail = patient.email;
      sendchatNotification(
        patientId,
        {
          title: "MediTour Global",
          message: `Your online appointment is about to start! Here is your link ${appointmentLink}`,
        },
        "user"
      );
      if (req.originalUrl.includes("doc/appointmentLink")) {
        senderModelType = "Doctor";
      } else if (req.originalUrl.includes("nutritionist/appointmentLink")) {
        senderModelType = "Nutrition";
      } else if (req.originalUrl.includes("physio/appointmentLink")) {
        senderModelType = "Physiotherapist";
      } else if (req.originalUrl.includes("paramedic/appointmentLink")) {
        senderModelType = "Paramedic";
      } else if (req.originalUrl.includes("psychologist/appointmentLink")) {
        senderModelType = "Psychologist";
      }
      const notification = new Notification({
        senderId: doctorId,
        senderModelType,
        receiverId: patientId,
        title: "MediTour Global",
        message: `Your online appointment is about to start! Here is your link ${appointmentLink}`,
      });
      await notification.save();

      // Validate patient email
      if (!EmailValidator.validate(patientEmail)) {
        return res
          .status(400)
          .json({ message: "Invalid patient email address" });
      }

      var mailOptions = {
        from: "no-reply@example.com",
        to: patientEmail,
        subject: "Appointment Link",
        html: `  <div style="
            font-family: Arial, sans-serif;
            text-align: center;
            background-color: #f3f4f6;
            color: #555;
            padding: 20px;
            border-radius: 8px;
            max-width: 600px;
            margin: auto;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
            <h1 style="font-size: 24px; color: #333;">Appointment Link</h1>
            <p style="font-size: 16px; margin: 10px 0 20px;">
           Your online appointment is about to start. Click the button below to proceed:
            </p>
            
            <a href="${appointmentLink}" style="
              display: inline-block;
              background-color: #ff6600;
              color: white;
              padding: 12px 30px;
              font-size: 16px;
              border-radius: 5px;
              text-decoration: none;
              margin-bottom: 20px;
            ">Appointment Link</a>
            
            <p style="font-size: 14px; color: #777; margin: 20px 0;">
              If the button above doesn't work, copy and paste the following link into your browser:
            </p>
            
            <p style="font-size: 13px; color: #888; word-break: break-all;">
              <a href="${appointmentLink}" style="color: #ff6600; text-decoration: none;">${appointmentLink}</a>
            </p>
            
            <hr style="border: 0; height: 1px; background: #ddd; margin: 20px 0;">
            
            <p style="font-size: 12px; color: #aaa;">
              If you don't want to join, you can safely ignore this email.
            </p>
          </div>`,
      };
      transporter.sendMail(mailOptions, function (err) {
        if (err) {
          return next(err);
        }
      });

      res.status(200).json({
        appointment,
        message: "Appointment link added successfully",
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },

  async searchProduct(req, res, next) {
    try {
      const keyword = req.query.keyword || "";
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 30;
      const skip = (page - 1) * limit;

      // Search for products with pagination
      const products = await Medicine.find({
        $or: [
          { productName: { $regex: keyword, $options: "i" } },
          { brand: { $regex: keyword, $options: "i" } },
          { generic: { $regex: keyword, $options: "i" } },
          { content: { $regex: keyword, $options: "i" } },
        ],
      })
        .skip(skip)
        .limit(limit);

      // Get the total count of products for the keyword
      const totalProducts = await Medicine.countDocuments({
        $or: [
          { productName: { $regex: keyword, $options: "i" } },
          { brand: { $regex: keyword, $options: "i" } },
          { generic: { $regex: keyword, $options: "i" } },
          { content: { $regex: keyword, $options: "i" } },
        ],
      });

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalProducts / limit);

      // Return paginated results
      res.json({
        products,
        totalProducts,
        totalPages,
        currentPage: page,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },

  // async addTreatment(req, res, next) {
  //   const treatmentsSchema = Joi.object({
  //     categoryFound: Joi.boolean(),
  //     treatmentId: Joi.string(),
  //     treatment: Joi.object({
  //       appointmentCharges: Joi.boolean().required(),
  //       medicines: Joi.boolean().required(),
  //       labService: Joi.boolean().required(),
  //       hospitalization: Joi.object({
  //         ac: Joi.boolean(),
  //         nonAc: Joi.boolean(),
  //       }).optional(),
  //       other: Joi.string().optional(),
  //     }).required(),
  //     totalAmount: Joi.number(),
  //     categoryId: Joi.string(),
  //     subCategory: Joi.string(),
  //     isPersonal: Joi.boolean().required(),
  //     hospitalId: Joi.string().optional(), // Optional hospitalId for doctors
  //     addedBy: Joi.string().valid("doctor", "hospital").required(), // Define the source of treatment
  //   });

  //   const { error } = treatmentsSchema.validate(req.body);
  //   console.log("Validation Error:", error);
  //   if (error) {
  //     return next(error);
  //   }

  //   let {
  //     categoryFound,
  //     treatmentId,
  //     treatment,
  //     totalAmount,
  //     categoryId,
  //     subCategory,
  //     isPersonal,
  //     hospitalId,
  //     addedBy,
  //   } = req.body;

  //   let doctorId, hospitalIdFromAuth;

  //   // Get doctorId or hospitalId from auth based on who is adding
  //   if (addedBy === "doctor") {
  //     doctorId = req.user._id;
  //     console.log("Doctor ID:", doctorId);
  //   } else if (addedBy === "hospital") {
  //     hospitalIdFromAuth = req.user._id;
  //     hospitalId = hospitalId || hospitalIdFromAuth; // If hospitalId is not provided in the body, use the one from auth
  //   }

  //   // Check if hospitalId is associated with the doctor (only for doctors adding)
  //   if (addedBy === "doctor" && hospitalId) {
  //     const doc = await Doctor.findById(doctorId).select("hospitalIds");

  //     const isHospitalAssociated = doc.hospitalIds.some(
  //       (hospital) => hospital.hospitalId.toString() === hospitalId.toString()
  //     );
  //     if (!isHospitalAssociated) {
  //       return res.status(403).json({
  //         auth: false,
  //         message: "Hospital is NOT associated with the doctor.",
  //       });
  //     }
  //   }

  //   // Handling treatment creation and validation
  //   if (categoryFound === false && !treatmentId) {
  //     const existingTreatment = await Treatment.findOne({
  //       categoryId,
  //       subCategory: { $regex: subCategory, $options: "i" },
  //     });
  //     if (existingTreatment) {
  //       return res.status(400).json({});
  //     }

  //     // If not found, create a new treatment
  //     const newTreatment = new Treatment({
  //       categoryId,
  //       subCategory,
  //     });
  //     await newTreatment.save();
  //     treatmentId = newTreatment._id;
  //   } else if (treatmentId) {
  //     // Validate if the treatmentId provided exists
  //     const existingTreatment = await Treatment.findById(treatmentId);

  //     if (!existingTreatment) {
  //       return res.status(400).json({});
  //     }
  //   }

  //   let bookTreatment;

  //   try {
  //     if (addedBy === "doctor") {
  //       // Doctor-specific treatment creation logic
  //       if (isPersonal) {
  //         let personalTreatment = await BookTreatment.findOne({
  //           doctorId,
  //           treatmentId,
  //           isPersonal: true,
  //         });
  //         if (personalTreatment) {
  //           personalTreatment.treatment = treatment;
  //           personalTreatment.totalAmount = totalAmount;
  //           personalTreatment.addedBy = addedBy;
  //           bookTreatment = await personalTreatment.save();
  //         } else {
  //           console.log("personal new treatment");
  //           const treatmentToRegister = new BookTreatment({
  //             doctorId,
  //             treatmentId,
  //             treatment,
  //             totalAmount,
  //             isPersonal: true,
  //             addedBy: addedBy, // Make sure addedBy is set
  //           });
  //           bookTreatment = await treatmentToRegister.save();
  //         }
  //       } else {
  //         let hospitalTreatment = await BookTreatment.findOne({
  //           doctorId,
  //           hospitalId,
  //           treatmentId,
  //         });
  //         if (hospitalTreatment) {
  //           hospitalTreatment.treatment = treatment;
  //           hospitalTreatment.totalAmount = totalAmount;
  //           bookTreatment = await hospitalTreatment.save();
  //         } else {
  //           const treatmentToRegister = new BookTreatment({
  //             doctorId,
  //             hospitalId,
  //             treatmentId,
  //             treatment,
  //             totalAmount,
  //             addedBy: addedBy,
  //             isPersonal: false,
  //           });
  //           bookTreatment = await treatmentToRegister.save();
  //         }
  //       }
  //     } else if (addedBy === "hospital") {
  //       let hospitalTreatment = await BookTreatment.findOne({
  //         hospitalId,
  //         treatmentId,
  //       });

  //       if (hospitalTreatment) {
  //         hospitalTreatment.treatment = treatment;
  //         hospitalTreatment.totalAmount = totalAmount;
  //         hospitalTreatment.addedBy = addedBy;

  //         try {
  //           bookTreatment = await hospitalTreatment.save();
  //         } catch (error) {
  //           console.error("Error saving updated hospitalTreatment:", error);
  //         }
  //       } else {
  //         const treatmentToRegister = new BookTreatment({
  //           hospitalId,
  //           treatmentId,
  //           treatment,
  //           totalAmount,
  //           isPersonal: false,
  //           addedBy: addedBy, // Ensure addedBy is set
  //         });
  //         bookTreatment = await treatmentToRegister.save();
  //       }
  //     }
  //   } catch (error) {
  //     return next(error);
  //   }

  //   if (hospitalId) {
  //     bookTreatment = await BookTreatment.findById(bookTreatment._id).populate({
  //       path: "hospitalId",
  //       select: "name",
  //     });
  //   }

  //   return res.status(201).json({ treatment: bookTreatment, auth: true });
  // },

  async addTreatment(req, res, next) {
    const treatmentsSchema = Joi.object({
      categoryFound: Joi.boolean(),
      treatmentId: Joi.string(),
      treatment: Joi.object(),
      totalAmount: Joi.number(),
      categoryId: Joi.string(),
      subCategory: Joi.string(),
      isPersonal: Joi.boolean().required(),
      hospitalId: Joi.string().optional(),
      doctorId: Joi.string().when("addedBy", {
        is: "hospital",
        then: Joi.string().optional(),
        otherwise: Joi.forbidden(),
      }),
      addedBy: Joi.string().valid("doctor", "hospital").required(),
    });

    const { error } = treatmentsSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    let {
      categoryFound,
      treatmentId,
      treatment,
      totalAmount,
      categoryId,
      subCategory,
      isPersonal,
      hospitalId,
      addedBy,
      doctorId, // Include doctorId here
    } = req.body;

    let hospitalIdFromAuth;

    if (addedBy === "doctor") {
      doctorId = req.user._id;
      console.log("Doctor ID:", doctorId);
    } else if (addedBy === "hospital") {
      hospitalIdFromAuth = req.user._id;
      hospitalId = hospitalId || hospitalIdFromAuth;
    }

    if (addedBy === "doctor" && hospitalId) {
      const doc = await Doctor.findById(doctorId).select("hospitalIds");

      const isHospitalAssociated = doc.hospitalIds.some(
        (hospital) => hospital.hospitalId.toString() === hospitalId.toString()
      );
      if (!isHospitalAssociated) {
        return res.status(403).json({
          auth: false,
          message: "Hospital is NOT associated with the doctor.",
        });
      }
    }

    if (categoryFound === false && !treatmentId) {
      const existingTreatment = await Treatment.findOne({
        categoryId,
        subCategory: { $regex: subCategory, $options: "i" },
      });
      if (existingTreatment) {
        return res.status(400).json({});
      }

      const newTreatment = new Treatment({
        categoryId,
        subCategory,
      });
      await newTreatment.save();
      treatmentId = newTreatment._id;
    } else if (treatmentId) {
      const existingTreatment = await Treatment.findById(treatmentId);
      if (!existingTreatment) {
        return res.status(400).json({});
      }
    }

    let bookTreatment;

    try {
      if (addedBy === "doctor") {
        if (isPersonal) {
          let personalTreatment = await BookTreatment.findOne({
            doctorId,
            treatmentId,
            isPersonal: true,
          });
          if (personalTreatment) {
            personalTreatment.treatment = treatment;
            personalTreatment.totalAmount = totalAmount;
            personalTreatment.addedBy = addedBy;
            bookTreatment = await personalTreatment.save();
          } else {
            console.log("personal new treatment");
            const treatmentToRegister = new BookTreatment({
              doctorId,
              treatmentId,
              treatment,
              totalAmount,
              isPersonal: true,
              addedBy: addedBy,
            });
            bookTreatment = await treatmentToRegister.save();
          }
        } else {
          let hospitalTreatment = await BookTreatment.findOne({
            doctorId,
            hospitalId,
            treatmentId,
          });
          if (hospitalTreatment) {
            hospitalTreatment.treatment = treatment;
            hospitalTreatment.totalAmount = totalAmount;
            bookTreatment = await hospitalTreatment.save();
          } else {
            const treatmentToRegister = new BookTreatment({
              doctorId,
              hospitalId,
              treatmentId,
              treatment,
              totalAmount,
              addedBy: addedBy,
              isPersonal: false,
            });
            bookTreatment = await treatmentToRegister.save();
          }
        }
      } else if (addedBy === "hospital") {
        let hospitalTreatment = await BookTreatment.findOne({
          hospitalId,
          treatmentId,
          ...(doctorId && { doctorId }),
        });

        if (hospitalTreatment) {
          hospitalTreatment.treatment = treatment;
          hospitalTreatment.totalAmount = totalAmount;
          hospitalTreatment.addedBy = addedBy;
          if (doctorId) hospitalTreatment.doctorId = doctorId;

          try {
            bookTreatment = await hospitalTreatment.save();
          } catch (error) {
            console.error("Error saving updated hospitalTreatment:", error);
          }
        } else {
          const treatmentToRegister = new BookTreatment({
            hospitalId,
            treatmentId,
            treatment,
            totalAmount,
            isPersonal: false,
            addedBy: addedBy,
            ...(doctorId && { doctorId }), // Attach doctorId if provided
          });
          bookTreatment = await treatmentToRegister.save();
        }
      }
    } catch (error) {
      return next(error);
    }

    if (hospitalId) {
      bookTreatment = await BookTreatment.findById(bookTreatment._id).populate({
        path: "hospitalId",
        select: "name",
      });
    }

    return res.status(201).json({ treatment: bookTreatment, auth: true });
  },

  async getTreatmentCategories(req, res, next) {
    try {
      const keyword = req.query.keyword;
      let treatments;
      // Validate the keyword
      if (!keyword || keyword.trim() === "") {
        treatments = await Treatment.find().populate(
          "categoryId",
          "categoryName"
        );
        return res.json(treatments);
      }

      // Fetch all treatments where any subCategory matches the keyword
      treatments = await Treatment.find({
        subCategory: { $regex: keyword, $options: "i" },
      }).populate("categoryId");

      // Send the filtered result back as JSON
      res.json(treatments);
    } catch (error) {
      next(error);
    }
  },

  async getAllTreatment(req, res, next) {
    try {
      const doctorId = req.user._id;
      const page = parseInt(req.query.page, 10) || 1; // Get the page number from the query parameter
      const patientPerPage = 10;
      const totalTreatments = await BookTreatment.countDocuments({ doctorId });
      const totalPages = Math.ceil(totalTreatments / patientPerPage);
      const skip = (page - 1) * patientPerPage;

      // Fetch the treatments with nested population
      const treatments = await BookTreatment.find({ doctorId })
        .populate({
          path: "treatmentId",
          populate: {
            path: "categoryId", // Populate the `categoryId` field in the `treatmentId` document
          },
        })
        .populate("doctorId") // Populate the `doctorId` field in the `BookTreatment` document
        .populate({
          path: "hospitalId",
          select: "name",
        })
        .skip(skip)
        .limit(patientPerPage)
        .sort({ createdAt: -1 });

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      res.json({
        auth: true,
        treatments: treatments,
        totalTreatments: totalTreatments,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteTreatment(req, res, next) {
    try {
      const treatmentId = req.query.treatmentId;
      const existingTreatment = await BookTreatment.findById(treatmentId);

      if (!existingTreatment) {
        return res.status(404).json([]);
      }
      await BookTreatment.findByIdAndDelete({ _id: treatmentId });
      return res
        .status(200)
        .json({ message: "Treatment deleted successfully" });
    } catch (error) {
      next(error);
    }
  },
  async updateTreatment(req, res, next) {
    try {
      const { id } = req.query;
      const {
        appointmentCharges,
        medicines,
        labService,
        hospitalization,
        other,
        totalAmount,
      } = req.body;

      const updatedTreatment = await BookTreatment.findByIdAndUpdate(
        id,
        {
          $set: {
            "treatment.appointmentCharges": appointmentCharges,
            "treatment.medicines": medicines,
            "treatment.labService": labService,
            "treatment.hospitalization": hospitalization,
            "treatment.other": other,
            totalAmount,
          },
        },
        { new: true, runValidators: true } // Return the updated document and validate fields
      );

      if (!updatedTreatment) {
        return res.status(404).json([]);
      }

      res.status(200).json({
        message: "Treatment updated successfully",
        treatment: updatedTreatment,
      });
    } catch (error) {
      next(error);
    }
  },

  async getTreatmentMainCategories(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const categoriesPerPage = 10;
      const totalCategories = await Category.countDocuments({});
      const totalPages = Math.ceil(totalCategories / categoriesPerPage);
      const skip = (page - 1) * categoriesPerPage;
      const categories = await Category.find({})
        .skip(skip)
        .limit(categoriesPerPage);
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;
      res.json({
        auth: true,
        categories: categories,
        totalCategories: totalCategories,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      next(error);
    }
  },

  async treatmentsByCategory(req, res, next) {
    try {
      const treatmentsByCategory = await Category.aggregate([
        {
          $lookup: {
            from: "treatments",
            localField: "_id",
            foreignField: "categoryId",
            as: "treatments",
          },
        },
        {
          $project: {
            _id: 1,
            categoryName: 1,
            image: 1,
            description: 1,
            treatments: {
              _id: 1,
              subCategory: 1,
              image: 1,
              description: 1,
            },
          },
        },
      ]);

      res.status(200).json({
        success: true,
        data: treatmentsByCategory,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve treatments by category",
        error: error.message,
      });
    }
  },

  async addTreatmentCharges(req, res, next) {
    try {
      const appointmentId = req.body.appointmentId;
      const doctorId = req.body.doctorId;
      const hospitalId = req.body.hospitalId;
      const treatmentAmount = req.body.treatmentAmount;
      const appointment = await Appointment.findById(appointmentId);
      appointment.amount = appointment.amount + treatmentAmount;
      const paidUptillNow =
        appointment.paidByUserAmount - appointment.processingFee;
      const remainingAmount = appointment.amount - paidUptillNow;
      appointment.remainingAmount = remainingAmount;
      appointment.isPaidFull = false;
      await appointment.save();
      let doctor;
      let hospital;
      if (doctorId) {
        doctor = await Doctor.findById(doctorId);
      } else {
        hospital = await Hospital.findById(hospitalId);
      }

      const admins = await Admin.find();
      if (appointment.hospital) {
        let sender, senderType, receiver, receiverType;

        // Determine the sender and receiver based on the provided IDs
        if (doctorId) {
          sender = await Doctor.findById(doctorId);
          senderType = "Doctor";
          receiver = await Hospital.findById(hospitalId);
          receiverType = "Hospital";
        } else if (hospitalId) {
          sender = await Hospital.findById(hospitalId);
          senderType = "Hospital";
          receiver = await Doctor.findById(doctorId);
          receiverType = "Doctor";
        }

        // Send notifications only if both sender and receiver are defined
        if (sender && receiver) {
          const notifications = {
            senderId: sender._id,
            senderModelType: senderType,
            receiverId: receiver._id,
            receiverModelType: receiverType,
            title: "MediTour Global",
            message: `Treatment charges have been added by "${senderType}"`,
          };

          await Notification.insertMany(notifications);

          sendchatNotification(
            receiver._id,
            {
              title: "MediTour Global",
              message: `Treatment charges have been added by "${senderType}"`,
            },
            receiverType.toLowerCase()
          );
        }

        const notifications1 = admins.map((admin) => ({
          senderId: sender._id,
          senderModelType: senderType,
          receiverId: admin._id,
          receiverModelType: "Admin",
          title: "MediTour Global",
          message: `Treatment charges have been added by "${senderType}"`,
        }));

        await Notification.insertMany(notifications1);

        admins.forEach((admin) => {
          sendchatNotification(
            admin._id,
            {
              title: "MediTour Global",
              message: `Treatment charges have been added by "${senderType}"`,
            },
            "admin"
          );
        });

        sendchatNotification(
          appointment.patientId,
          {
            title: "MediTour Global",
            message: `Treatment charges have been added by "${senderType}"`,
          },
          "user"
        );

        const notification = new Notification({
          senderId: sender._id,
          senderModelType: senderType,
          receiverId: appointment.patientId,
          receiverModelType: "Users",
          title: "MediTour Global",
          message: `Treatment charges have been added by "${senderType}"`,
        });
        await notification.save();
      } else {
        const notifications = admins.map((admin) => ({
          senderId: doctorId,
          senderModelType: "Doctor",
          receiverId: admin._id,
          receiverModelType: "Admin",
          title: "MediTour Global",
          message: `Treatment charges have been added by Doctor`,
        }));

        await Notification.insertMany(notifications);

        admins.forEach((admin) => {
          sendchatNotification(
            admin._id,
            {
              title: "MediTour Global",
              message: `Treatment charges have been added by Doctor`,
            },
            "admin"
          );
        });

        sendchatNotification(
          appointment.patientId,
          {
            title: "MediTour Global",
            message: `Treatment charges have been added by Doctor`,
          },
          "user"
        );

        const notification = new Notification({
          senderId: sender._id,
          senderModelType: senderType,
          receiverId: appointment.patientId,
          receiverModelType: "Users",
          title: "MediTour Global",
          message: `Treatment charges have been added by Doctor`,
        });
        await notification.save();
      }
      res.json({
        auth: true,
        message: "Treatment Charges have been added!",
      });
    } catch (error) {
      return next(error);
    }
  },
  async getCountries(req, res, next) {
    try {
      let countries = await Country.find();
      countries = countries[0].countries;
      res.status(200).json({
        auth: true,
        countries: countries,
      });
    } catch (error) {
      next(error);
    }
  },

  async getActivationRates(req, res, next) {
    try {
      const countryWiseCharges = await CountryWiseRates.find();
      res.status(200).json({
        auth: true,
        countryWiseCharges: countryWiseCharges,
      });
    } catch (error) {
      next(error);
    }
  },

  async sendActivationStatus(req, res, next) {
    try {
      let { vendorType, vendorId } = req.query;

      let vendor;
      switch (vendorType) {
        case "pharmacy":
          vendor = await Pharmacy.findById(vendorId).select("paidActivation");
          break;
        case "laboratory":
          vendor = await Laboratory.findById(vendorId).select("paidActivation");
          break;
        case "hospital":
          vendor = await Hospital.findById(vendorId).select("paidActivation");
          break;
        case "rentacar":
          vendor = await RentACar.findById(vendorId).select("paidActivation");
          break;
        case "insurance":
          vendor = await Insurance.findById(vendorId).select("paidActivation");
          break;
        case "hotel":
          vendor = await Hotel.findById(vendorId).select("paidActivation");
          break;
        case "donation":
          vendor = await Donations.findById(vendorId).select("paidActivation");
          break;
        case "ambulance":
          vendor = await AmbulanceCompany.findById(vendorId).select(
            "paidActivation"
          );
          break;
        case "travelagency":
          vendor = await TravelAgency.findById(vendorId).select(
            "paidActivation"
          );
          break;
        case "pharmaceutical":
          vendor = await Pharmaceutical.findById(vendorId).select(
            "paidActivation"
          );
          break;
        case "doctor":
          vendor = await Doctor.findById(vendorId).select("paidActivation");
          break;
        case "doctor company":
          vendor = await DoctorCompany.findById(vendorId).select(
            "paidActivation"
          );
          break;
        case "travel company":
          vendor = await TravelCompany.findById(vendorId).select(
            "paidActivation"
          );
          break;
        default:
          return res.status(400).json({ message: "Invalid vendor type" });
      }

      res.status(200).json({
        auth: true,
        paidActivation: vendor.paidActivation,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = docAppointController;
