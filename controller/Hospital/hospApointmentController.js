const express = require("express");
const mongoose = require("mongoose");
const app = express();
const Appointment = require("../../models/All Doctors Models/appointment");
const User = require("../../models/User/user");
const AppointmentRequest = require("../../models/All Doctors Models/request");
const Doctor = require("../../models/Doctor/doctors");
const patientInvoice = require("../../models/Hospital/patientInvoice.js");
const Notification = require("../../models/notification.js");
const { sendchatNotification } = require("../../firebase/service/index.js");
const exchangeRateApi = require("../../utils/ExchangeRate.js");
const PDFDocument = require("pdfkit");
const fs = require("fs");
async function getNextAppointmentNo() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestVendor = await Appointment.findOne({}).sort({ createdAt: -1 });
    let nextVendorId = 1;
    if (latestVendor && latestVendor.appointmentId) {
      // Extract the numeric part of the orderId and increment it
      const currentVendorId = parseInt(latestVendor.appointmentId.substring(3));
      nextVendorId = currentVendorId + 1;
    }
    // Generate the next orderId
    const nextOrderId = `APP${nextVendorId.toString().padStart(4, "0")}`;
    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}
async function getNextInvoiceNo() {
  try {
    // Find the latest invoice in the database and get its invoiceNumber
    const latestInvoice = await patientInvoice
      .findOne({})
      .sort({ createdAt: -1 });
    let nextInvoiceId = 1;

    if (latestInvoice && latestInvoice.invoiceNumber) {
      // Extract the numeric part of the invoiceNumber and increment it
      const currentInvoiceId = latestInvoice.invoiceNumber.substring(3);

      if (currentInvoiceId && !isNaN(currentInvoiceId)) {
        nextInvoiceId = parseInt(currentInvoiceId) + 1;
      }
    }

    // Generate the next invoice number
    const nextOrderId = `INV${nextInvoiceId.toString().padStart(4, "0")}`;
    return nextOrderId;
  } catch (error) {
    console.error("Error generating invoice number:", error.message);
    throw new Error("Failed to generate invoice number");
  }
}

const hospAppointmentController = {
  async getAllAcceptedAppointmentsRequests(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const appointPerPage = 10;
      const hospital = req.user._id;
      let status;

      // Determine status based on query parameter
      if (req.query.status === "pending") {
        status = "pending";
      } else if (req.query.status === "accept") {
        status = "accept";
      } else {
        status = "accept"; // Default status if not provided or invalid
      }

      // Find all appointment requests for the hospital with the specified status
      const totalAppoints = await AppointmentRequest.countDocuments({
        hospital,
        status,
      });
      const totalPages = Math.ceil(totalAppoints / appointPerPage);
      const skip = (page - 1) * appointPerPage;

      const allAppointments = await AppointmentRequest.find({
        hospital,
        status,
      })
        .sort({ createdAt: -1 })
        .populate("doctorId")
        .populate("patientId")
        .skip(skip)
        .limit(appointPerPage);

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        appointments: allAppointments,
        auth: true,
        totalAppoints,
        previousPage,
        nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
  async getAllHospAppointments(req, res, next) {
    try {
      const hospital = req.user._id;
      const page =
        req.query.page === undefined ? null : parseInt(req.query.page) || 1;
      const appointPerPage = 10;
      const status = req.query.status || "all";
      const appointmentDate = req.query.appointmentDateAndTime?.trim();
      const searchTerm = req.query.query?.trim(); // Search term for appointmentId or patient's name

      // Build the base query
      let query = {
        hospital,
      };

      // Adjust the status filter based on the query
      if (status) {
        if (status === "ongoing") {
          query.status = "completed"; // Map "ongoing" to completed appointments
        } else if (status === "upcoming") {
          query.status = "pending"; // Map "upcoming" to pending appointments
        } else if (status !== "cancelled") {
          query.status = { $ne: "cancelled" }; // Exclude cancelled appointments
        }
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
            as: "doctorInfo",
          },
        },
        { $unwind: "$doctorInfo" }, // Unwind the doctorInfo array
        {
          $lookup: {
            from: "appointmentRequests",
            let: { requestRefId: "$requestRef" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$requestRefId"] } } },
              { $project: { createdAt: 1, _id: 0 } } // Sirf createdAt field rakho
            ],
            as: "requestRefId" // Yahan requestRefId mat likho
          }
        },
        {
          $unwind: { path: "$requestRefId", preserveNullAndEmptyArrays: true } // Isse array hat jayega
        },
        {
          $lookup: {
            from: "Users", // The users collection name
            localField: "patientId",
            foreignField: "_id",
            as: "patientInfo",
          },
        },
        { $unwind: { path: "$patientInfo", preserveNullAndEmptyArrays: true } }, // Unwind patientInfo but allow empty results
        {
          $lookup: {
            from: "hospitals", // The hospitals collection name
            localField: "hospital",
            foreignField: "_id",
            as: "hospital",
          },
        },
        { $unwind: { path: "$hospital", preserveNullAndEmptyArrays: true } }, // Unwind hospitalInfo but allow empty results
        // // Remove duplicate patients
        // {
        //   $group: {
        //     _id: "$patientId",
        //     appointment: { $first: "$$ROOT" }, // Keep only the first appointment for each patient
        //   },
        // },
        // { $replaceRoot: { newRoot: "$appointment" } }, // Replace with grouped document
        { $sort: { appointmentDateAndTime: 1 } }, // Sort by appointment date
      ];

      // Apply keyword search for appointmentId or patient's name
      if (searchTerm) {
        const regex = new RegExp(searchTerm, "i"); // Case-insensitive search

        // Match either appointmentId or patient's name using $or
        aggregatePipeline.push({
          $match: {
            $or: [
              { appointmentId: regex }, // Search by appointmentId
              { "patientInfo.name": regex }, // Search by patient's name
              {"doctorInfo.name":regex},
            ],
          },
        });
      }

      // Count total appointments without pagination
      const countPipeline = [...aggregatePipeline, { $count: "totalAppoints" }];

      const countResult = await Appointment.aggregate(countPipeline);
      const totalAppoints =
        countResult.length > 0 ? countResult[0].totalAppoints : 0;
      console.log(totalAppoints);
      // Apply pagination only if page is provided
      if (page !== null) {
        aggregatePipeline.push(
          { $skip: (page - 1) * appointPerPage },
          { $limit: appointPerPage }
        );
      }

      // Fetch paginated results
      const allAppointments = await Appointment.aggregate(aggregatePipeline);

      // Pagination info
      const totalPages = page ? Math.ceil(totalAppoints / appointPerPage) : 1;
      const previousPage = page && page > 1 ? page - 1 : null;
      const nextPage = page && page < totalPages ? page + 1 : null;

      const doctorNames = [
        ...new Set(allAppointments.map((app) => app.doctorInfo.name)),
      ];

      return res.status(200).json({
        Appointments: allAppointments,
        doctorNames: doctorNames,
        auth: true,
        totalAppoints,
        previousPage,
        nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
  async getAppointment(req, res, next) {
    try {
      const appointmentId = req.query.appointmentId;
      const appointment = await Appointment.findById(appointmentId).populate(
        "doctorId patientId"
      );
      res.status(200).json({
        appointment,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },
  // Forward appointment request to hospital for confirmation
  async confirmAppointment(req, res, next) {
    try {
      const { appointmentRequestId, confirmationStatus } = req.body; // Confirmation status (confirm or cancel)
      const hospitalId = req.query.hospitalId; // Hospital ID from the request
      let appointmentDateAndTime = req.body.appointmentDateAndTime; // Optional appointment time
      let appointmentDateAndTimePak = appointmentDateAndTime; // Optional appointment time

      // If appointmentDateAndTime is provided, process it
      // if (appointmentDateAndTime) {
      //   appointmentDateAndTime = new Date(appointmentDateAndTime);

      //   // Adjust appointment time for UTC offset (add 5 hours)
      //   appointmentDateAndTime.setHours(appointmentDateAndTime.getHours() - 5);
      // }

      // Fetch the appointment request using appointmentRequestId
      const booking = await AppointmentRequest.findById(
        appointmentRequestId
      ).populate("patientId doctorId hospital"); // Populate patient, doctor, and hospital

      if (!booking) {
        return res.status(404).json({});
      }

      if (booking.status !== "pending") {
        return res
          .status(400)
          .json({ message: "Request has already been processed." });
      }
      if (!appointmentDateAndTime) {
        appointmentDateAndTime = booking.appointmentDateAndTime;
      } else {
        appointmentDateAndTime = new Date(appointmentDateAndTime);
        appointmentDateAndTime.setHours(appointmentDateAndTime.getHours() - 5);
      }
      // Handle hospital confirmation/rejection
      if (confirmationStatus === "confirm") {
        if (!booking.hospital || !booking.hospital._id) {
          return res
            .status(400)
            .json({ message: "Hospital information is missing." });
        }

        booking.status = "accept"; // Update status to confirmed
        booking.confirmationStatus = "confirm";
        console.log("Booking status before saving:", booking.status);
        await booking.save();

        // Create new appointment record for confirmed appointments
        const patient = booking.patientId;
        const doctor = booking.doctorId;
        const hospital = booking.hospital; // Now properly fetched
        const appointmentType = booking.appointmentType;
        appointmentDateAndTime;
        const totalAmount = booking.totalAmount;
        const gatewayName = booking.gatewayName;
        const treatmentId = booking.treatmentId;
        const remainingAmount = booking.remainingAmount;
        const dollarAmount = await exchangeRateApi(totalAmount);

        const appointmentId = await getNextAppointmentNo();
        const newAppointmentsData = {
          appointmentId,
          doctorId: doctor._id,
          patientId: patient._id,
          hospital: hospital._id, // Explicit access to hospital ID
          appointmentDateAndTime,
          appointmentType,
          totalAmount,
          dollarAmount,
          requestRef: appointmentRequestId,
          ...(booking.processingFee && {
            processingFee: booking.processingFee,
          }),
          ...(booking.paidByUserAmount && {
            paidByUserAmount: booking.paidByUserAmount,
          }),
          isPaidFull: booking.isPaidFull,
          ...(booking.paymentId && { paymentId: booking.paymentId }),
          gatewayName,
          remainingAmount,
          ...(treatmentId && { treatmentId: treatmentId._id }),
        };

        const newAppointment = new Appointment(newAppointmentsData);
        await newAppointment.save();
        let receiverModelType;
        if (req.originalUrl.includes("hosp/confirmAppointment")) {
          receiverModelType = "Doctor";
        }
        // Notify the patient about hospital's decision
        sendchatNotification(
          patient._id,
          {
            title: "MediTour Global",
            message: `Your appointment request has been ${confirmationStatus} by the hospital.`,
          },
          "user"
        );

        const patientNotification = new Notification({
          senderId: hospital._id,
          senderModelType: "Hospital",
          receiverId: patient._id,
          receiverModelType: "Users",
          title: "MediTour Global",
          message: `Your appointment request has been confirmed by the hospital.`,
        });
        await patientNotification.save();

        sendchatNotification(
          doctor._id,
          {
            title: "MediTour Global",
            message: `The hospital has ${confirmationStatus} your appointment request for patient ${patient.name}.`,
          },
          receiverModelType
        );
        const doctorNotification = new Notification({
          senderId: hospital._id,
          senderModelType: "Hospital",
          receiverId: doctor._id,
          receiverModelType: receiverModelType,
          title: "MediTour Global",
          message: `The hospital has confirmed your appointment request for patient ${patient.name}.`,
        });
        await doctorNotification.save();
        let pakApp = newAppointment;
        pakApp.appointmentDateAndTime = appointmentDateAndTimePak;

        return res.status(200).json({
          success: true,
          message: "Appointment confirmed successfully.",
          newAppointment: pakApp,
        });
      } else if (confirmationStatus === "cancel") {
        booking.status = "pending"; // Update status to pending again
        booking.confirmationStatus = "cancel";
        booking.forwardedRequest = false;
        await booking.save();
        const doctor = booking.doctorId;
        const hospital = booking.hospital;
        const patient = booking.patientId;
        // Notify the patient about hospital's decision
        sendchatNotification(
          patient._id,
          {
            title: "MediTour Global",
            message: `Your appointment request has been ${confirmationStatus} by the hospital.`,
          },
          "user"
        );

        const patientNotification = new Notification({
          senderId: hospital._id,
          senderModelType: "Hospital",
          receiverId: patient._id,
          receiverModelType: "Users",
          title: "MediTour Global",
          message: `Your appointment request has been cancelled by the hospital.`,
        });
        await patientNotification.save();

        sendchatNotification(
          doctor._id,
          {
            title: "MediTour Global",
            message: `The hospital has ${confirmationStatus} your appointment request for patient ${patient.name}.`,
          },
          "Doctor"
        );
        const doctorNotification = new Notification({
          senderId: hospital._id,
          senderModelType: "Hospital",
          receiverId: doctor._id,
          receiverModelType: "Doctor",
          title: "MediTour Global",
          message: `The hospital has can your appointment request for patient ${patient.name}.`,
        });
        await doctorNotification.save();

        return res.status(200).json({
          success: true,
          message: "Appointment cancelled successfully.",
        });
      } else {
        return res
          .status(400)
          .json({ message: "Invalid confirmation status." });
      }
    } catch (error) {
      return next(error); // Pass the error to the error handling middleware
    }
  },
  async rescheduleAppointment(req, res, next) {
    try {
      const { appointmentId, newDoctorId, newDateAndTime } = req.body;

      // Validate input parameters
      if (!appointmentId || !newDoctorId || !newDateAndTime) {
        return res.status(400).json({
          message: "Missing required parameters",
        });
      }

      // Find the appointment to be updated
      const appointment = await Appointment.findById(appointmentId).populate("hospital")

      if (!appointment) {
        return res.status(404).json({});
      }

      // Check if the new doctor exists
      const doctor = await Doctor.findById(newDoctorId);

      if (!doctor) {
        return res.status(404).json({});
      }

      // Check for time conflicts with the new doctor
      const conflictingAppointment = await Appointment.findOne({
        doctorId: newDoctorId,
        appointmentDateAndTime: new Date(newDateAndTime),
        status: { $ne: "cancelled" }, // Avoid conflicts with cancelled appointments
      });

      if (conflictingAppointment) {
        return res.status(400).json({
          message: "The selected doctor is not available at the chosen time.",
        });
      }

      // Adjust the new appointment date and time by 5 hours (time zone or other logic adjustment)
      const newAppointmentDate = new Date(newDateAndTime);
      newAppointmentDate.setHours(newAppointmentDate.getHours() - 5); // Adjust by 5 hours
      // Update the appointment details
      appointment.doctorId = newDoctorId;
      appointment.appointmentDateAndTime = newAppointmentDate;
      appointment.rescheduled = true;

      // Save the updated appointment
      await appointment.save();

      // Notify the patient about the rescheduled appointment
      const patient = appointment.patientId;
      const hospital = appointment.hospital._id;
      const doctors = appointment.doctorId;
      sendchatNotification(
        patient._id,
        {
          title: "MediTour Global",
          message: `Your appointment has been rescheduled to ${new Date(
            newDateAndTime
          ).toLocaleString()} with Dr. ${doctor.name}.`,
        },
        "user"
      );
      console.log(`Your appointment request has been rescheduled by the ${appointment.hospital.name} hospital.`)

      const patientNotification = new Notification({
        senderId: hospital._id,
        senderModelType: "Hospital",
        receiverId: patient._id,
        receiverModelType: "Users",
        title: "MediTour Global",
        message: `Your appointment request has been rescheduled by the ${appointment.hospital.name} hospital.`,
      });
      await patientNotification.save();
      sendchatNotification(
        doctor._id,
        {
          title: "MediTour Global",
          message: ` Your appointment request has been rescheduled by the ${appointment.hospital.name} hospital.`,
        },
        "Doctor"
      );
      const doctorNotification = new Notification({
        senderId: doctors._id,
        senderModelType: "Hospital",
        receiverId: doctor._id,
        receiverModelType: "Doctor",
        title: "MediTour Global",
        message: ` Your appointment request has been rescheduled by the ${appointment.hospital.name} hospital.`,
      });
      await doctorNotification.save();

      return res.status(200).json({
        message: "Appointment rescheduled successfully.",
        appointment,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "An error occurred while rescheduling the appointment.",
        error: error.message,
      });
    }
  },

  async getHospPatientData(req, res, next) {
    try {
      const patientId = req.query.patientId;
      const hospitalId = req.user._id; // Assuming hospitalId is stored in req.user.hospitalId
      const patient = await User.findById(patientId);

      if (!patient) {
        const error = new Error("Patient not found!");
        error.status = 400;
        return next(error);
      }

      // Get all doctors working in the hospital
      const doctors = await Doctor.find({
        "hospitalIds.hospitalId": hospitalId,
      });

      // Extract the IDs of all doctors
      const doctorIds = doctors.map((doctor) => doctor._id);

      // Find all completed appointments for the patient, filtered by hospitalId and doctorIds, and sorted by createdAt field in descending order
      const allAppointments = await Appointment.find({
        hospital: hospitalId, // Filter by hospitalId
        patientId,
        status: "completed",
      })
        .sort({ createdAt: -1 })
        .populate("doctorId ePrescription");

      return res.status(200).json({
        patient,
        Appointments: allAppointments,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },
  //..............Manage Patient....//
  async getPatientList(req, res, next) {
    try {
      const hospital = req.user._id; // Get hospital ID from logged-in user
      const { status } = req.query; // Get status from query parameters

      let matchConditions = { hospital, status: { $ne: "cancelled" } }; // Default match condition

      // Add status-based filtering
      if (status && status !== "all") {
        matchConditions.status =
          status === "completed" ? "completed" : "pending";
      }

      let aggregatePipeline = [
        { $match: matchConditions }, // Filter by hospital and status
        {
          $lookup: {
            from: "Users", // Join with Users collection (patients)
            localField: "patientId",
            foreignField: "_id",
            as: "patientInfo",
          },
        },
        { $unwind: "$patientInfo" }, // Flatten the patientInfo array
        {
          $group: {
            _id: "$patientId", // Group by unique patient ID
            patient: { $first: "$patientInfo" }, // Store unique patient details
            status: { $first: "$status" }, // Add status field
            appointmentType: { $first: "$appointmentType" },
            totalAppointments: { $sum: 1 }, // Count total appointments for the patient
          },
        },
        { $sort: { "patient.name": 1 } }, // Sort patients alphabetically
      ];

      const patients = await Appointment.aggregate(aggregatePipeline);

      return res.status(200).json({
        success: true,
        totalPatients: patients.length,
        patients: patients,
      });
    } catch (error) {
      return next(error);
    }
  },
  async getPatientAppointmentDetail(req, res, next) {
    try {
      const hospitalId = req.user._id; // Hospital ID from logged-in user info
      const searchTerm = req.query.query || ""; // Get search term for case-insensitive search
      const patientId = req.query.patientId;

      // Pagination parameters
      const page = parseInt(req.query.page) || 1; // Current page (default: 1)
      const limit = parseInt(req.query.limit) || 10; // Number of appointments per page (default: 10)
      const skip = (page - 1) * limit; // Calculate the number of appointments to skip

      // Start with the basic match conditions
      const matchStage = {
        hospital: mongoose.Types.ObjectId(hospitalId), // Ensure hospital-wise filtering
        status: { $ne: "cancelled" },
      };

      // If patientId is provided, filter by patientId
      if (patientId) {
        matchStage.patientId = mongoose.Types.ObjectId(patientId);
      }

      // Define the search conditions
      if (searchTerm) {
        matchStage.$or = [
          { appointmentId: { $regex: searchTerm, $options: "i" } }, // Case-insensitive search on appointmentId
          { "doctorId.name": { $regex: searchTerm, $options: "i" } }, // Case-insensitive search on doctor name
        ];
      }

      const appointmentPipeline = [
        {
          $match: matchStage, // Apply dynamic match conditions
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
            as: "treatmentId"
          }
        },
        {
          $unwind: {
            path: "$treatmentId",
            preserveNullAndEmptyArrays: true // Prevent errors if treatment is null
          }
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
                invoiceId: "$invoiceId",
                labResults: "$labResults",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1,
            gender: 1,
            qualification: 1,
            bloodGroup: 1,
            mrNo: 1,
            cnicOrPassNo: 1,
            phone: 1,
            dateOfBirth: 1,
            userImage: 1,
            createdAt: 1,
            appointments: {
              $slice: ["$appointments", skip, limit], // Apply pagination to the appointments array
            },
          },
        },
      ];

      const patientAppointments = await Appointment.aggregate(
        appointmentPipeline
      );

      if (patientAppointments.length === 0) {
        return res.status(200).json({
          patients: {},
          pagination: {
            currentPage: null,
            totalPages: null,
            totalAppointments: null,
            limit: 10,
          },
          auth: true,
        });
      }

      const patients = patientAppointments[0]; // Get the first result (one patient)

      // Count total appointments for the patient (for pagination metadata)
      const totalAppointments = await Appointment.countDocuments({
        patientId: patients._id,
        hospital: hospitalId,
        status: { $ne: "cancelled" },
      });

      const totalPages = Math.ceil(totalAppointments / limit);

      return res.status(200).json({
        patients,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalAppointments: totalAppointments,
          limit: limit,
        },
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },
  async patientHistory(req, res, next) {
    try {
      const patientId = req.query.id;
      const hospitalId = req.user._id; // Assuming hospitalId is stored in req.user.hospitalId
      const patient = await User.findById(patientId);

      if (!patient) {
        const error = new Error("Patient not found!");
        error.status = 400;
        return next(error);
      }

      // Get all doctors working in the hospital
      const doctors = await Doctor.find({
        "hospitalIds.hospitalId": hospitalId,
      });

      // Extract the IDs of all doctors
      const doctorIds = doctors.map((doctor) => doctor._id);

      // Find all completed appointments for the patient, filtered by hospitalId and doctorIds, and sorted by createdAt field in descending order
      const allAppointments = await Appointment.find({
        hospitalId, // Filter by hospitalId
        doctorId: { $in: doctorIds }, // Filter by doctorIds
        patientId,
        status: "completed",
      })
        .sort({ createdAt: -1 })
        .populate("doctorId")
        .populate({
          path: "ePrescription",
          populate: [
            {
              path: "doctorId",
              select: "name",
            },
            {
              path: "medicines",
              populate: {
                path: "medicineId",
                select: "generic productName tpPrice",
              },
            },
            {
              path: "test.testId",
            },
          ],
        });

      return res.status(200).json({
        patient,
        Appointments: allAppointments,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },
  async patientInvoice(req, res, next) {
    try {
      const hospitalId = req.user._id;
      const {
        patientId,
        appointmentId,
        initialCosting = {},
        extraCosting = [],
        advance = 0,
        discount = 0,
      } = req.body;

      // Validation
      if (!Object.keys(initialCosting).length && !extraCosting.length) {
        return res
          .status(400)
          .json({ message: "At least one costing is required" });
      }
      const appointment = await Appointment.findById(appointmentId);
      // Calculate total for initialCosting dynamically
      const initialTotal = Object.values(initialCosting).reduce(
        (sum, value) => sum + (Number(value) || 0),
        0
      );
      console.log(initialTotal);
      // Process extraCosting dynamically
      let extraCostingSum = 0;
      const processedExtraCosting = extraCosting.map((costItem) => {
        const quantity = Number(costItem.quantity) || 1; // Default quantity to 1 if not provided
        const cost =
          Number(
            costItem.rate
          ) || 0; // Default cost to 0 if not provided
        const total = quantity * cost; // Calculate total for this item

        console.log("total", total);

        extraCostingSum += total; // Add to cumulative sum

        // Return the updated object with a new 'total' field
        return { ...costItem, total }; // Deep clone the original item and add total
      });

      console.log(processedExtraCosting, "processedExtraCosting"); // Debug to check processed cost items
      // Calculate the grandTotal
      const totalCosting = initialTotal + extraCostingSum;
      console.log(totalCosting);
      const grandTotal = totalCosting - advance - discount;
      console.log(grandTotal);

      // Generate a unique invoice number
      const invoiceNumber = await getNextInvoiceNo();

      // Save invoice
      const newInvoice = new patientInvoice({
        patientId,
        appointmentId,
        hospitalId,
        initialCosting,
        extraCosting: processedExtraCosting, // Save processed array with total
        totalCosting,
        totalAmount: initialTotal,
        advance,
        discount,
        grandTotal,
        invoiceNumber,
      });

      const savedInvoice = await newInvoice.save();

      if (!savedInvoice) {
        throw new Error("Failed to save invoice");
      }
      // Push invoiceId to the appointment
      appointment.invoiceId = savedInvoice._id;
      await appointment.save();

      res.status(201).json(savedInvoice);
    } catch (error) {
      res.status(500).json({ message: "Error creating invoice" });
    }
  },
  async getPatientInvoice(req, res, next) {
    try {
      // Get the patientId from query parameters
      const appointmentId = req.query.appointmentId;

      if (!appointmentId) {
        return res.status(400).json({ error: "appointmentId is required" });
      }

      const invoice = await patientInvoice
        .find({ appointmentId })
        .populate("patientId");

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found!" });
      }

      // Return the found invoice in the response
      return res.status(200).json({
        success: true,
        invoice: invoice,
      });
    } catch (error) {
      // Handle errors and pass to the next middleware
      next(error);
    }
  },
  //.....search Appointments...//
  async searchAppointment(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const perPage = parseInt(req.query.limit) || 10; // Items per page
      const hospital = req.user._id; // Logged-in hospital's ID
      const keyword = req.query.keyword?.trim() || ""; // Keyword for search
      const type = req.query.type || "appointment"; // appointment or request
      const skip = (page - 1) * perPage;

      // Determine the model to query
      const Model = type === "request" ? AppointmentRequest : Appointment;

      // Base query
      let query = { hospital };

      // Aggregation pipeline
      let aggregatePipeline = [
        { $match: query }, // Match hospital ID
        {
          $lookup: {
            from: "doctors", // Lookup doctor details
            localField: "doctorId",
            foreignField: "_id",
            as: "doctorId",
          },
        },
        { $unwind: "$doctorId" }, // Unwind doctor info
        {
          $lookup: {
            from: "Users", // Lookup patient details
            localField: "patientId",
            foreignField: "_id",
            as: "patientId",
          },
        },
        { $unwind: { path: "$patientId", preserveNullAndEmptyArrays: true } }, // Unwind patient info
      ];

      // Add keyword search condition
      if (keyword) {
        const regex = new RegExp(keyword, "i"); // Case-insensitive search
        aggregatePipeline.push({
          $match: {
            $or: [
              { appointmentId: regex },
              { "doctorId.name": regex },
              { "doctorId.vendorId": regex },
              { "patientId.name": regex },
              { "patientId.mrNo": regex },
            ],
          },
        });
      }

      // Sorting and pagination
      aggregatePipeline.push(
        { $sort: { "doctorId.name": 1, "patientId.name": 1 } }, // Sort alphabetically
        { $skip: skip }, // Skip records
        { $limit: perPage } // Limit results per page
      );

      // Fetch results
      const results = await Model.aggregate(aggregatePipeline);

      // Count total results
      const countPipeline = aggregatePipeline.filter(
        (stage) => !["$skip", "$limit", "$sort"].some((key) => key in stage)
      );
      countPipeline.push({ $count: "totalCount" });
      const countResult = await Model.aggregate(countPipeline);
      const totalCount = countResult.length > 0 ? countResult[0].totalCount : 0;

      // Pagination details
      const totalPages = Math.ceil(totalCount / perPage);
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        results,
        totalCount,
        previousPage,
        nextPage,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },
  async deleteAppointment(req, res, next) {
    try {
      const { id, type } = req.query;

      if (type === "appointment") {
        // Find the appointment and get the associated requestRef
        const appointment = await Appointment.findByIdAndDelete(id);

        if (!appointment) {
          return res.status(404).json({});
        }

        // Update the linked AppointmentRequest status to `pending`
        const updatedRequest = await AppointmentRequest.findByIdAndUpdate(
          appointment.requestRef, // Use the linked reference
          {
            status: "pending",
            confirmationStatus: "waiting",
          },
          { new: true } // Return the updated document
        );

        if (!updatedRequest) {
          return res
            .status(404)
            .json({ message: "Associated request not found" });
        }

        res.status(200).json({
          message: "Appointment deleted successfully",
          appointment: updatedRequest,
        });
      } else if (type === "request") {
        // Update the linked AppointmentRequest status to `pending`
        const updatedRequest = await AppointmentRequest.findByIdAndUpdate(
          id, // Use the provided id directly here since type is request
          {
            status: "pending",
            confirmationStatus: "waiting",
            forwardedRequest: false,
          },
          { new: true } // Return the updated document
        );

        if (!updatedRequest) {
          return res.status(404).json({});
        }

        res.status(200).json({
          message: "Appointment request deleted successfully",
        });
      }
    } catch (error) {
      console.error("Error deleting appointment:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  },
};

module.exports = hospAppointmentController;
