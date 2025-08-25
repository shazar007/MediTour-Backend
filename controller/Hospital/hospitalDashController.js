const moment = require("moment");
const AppointmentRequest = require("../../models/All Doctors Models/request.js");
const Doctor = require("../../models/Doctor/doctors.js");
const Laboratories = require("../../models/Laboratory/laboratory.js");
const Pharmacies = require("../../models/Pharmacy/pharmacy");
const Appointment = require("../../models/All Doctors Models/appointment.js");
const Patient = require("../../models/User/user");
const PaymentToVendor = require("../../models/Admin/paymentToVendors");
const mongoose = require("mongoose");
const BookTreatment = require("../../models/All Doctors Models/bookTreatment.js");

const hospitalDashController = {
  async getCounts(req, res, next) {
    try {
      const hospitalId = req.user._id; // Assuming the hospital ID is stored in the user object upon authentication

      const todayStart = moment().startOf("day").toDate();
      const todayEnd = moment().endOf("day").toDate();

      // Find all doctors working in the hospital
      const doctors = await Doctor.find({
        "hospitalIds.hospitalId": hospitalId,
      });
      const doctorIds = doctors.map((doctor) => doctor._id);
      0;
      // Find completed appointments for today and get unique patient IDs
      const completedAppointmentsToday = await Appointment.find({
        doctorId: { $in: doctorIds },
        status: "completed",
        appointmentType: "hospital",
      }).distinct("patientId");

      console.log(completedAppointmentsToday);
      // Calculate the total number of unique patients for today's completed appointments
      const totalPatients = completedAppointmentsToday.length;

      // Find total number of doctors for the hospital
      const totalDoctors = await Doctor.countDocuments({
        "hospitalIds.hospitalId": hospitalId,
      });
      const totalLabs = await Laboratories.countDocuments({
        hospitalIds: { $in: [hospitalId] },
      });
      const totalPharmacies = await Pharmacies.countDocuments({
        hospitalIds: { $in: [hospitalId] },
      });

      // Find new patients registered today with accepted status
      const newPatientsToday = await Appointment.aggregate([
        {
          $match: {
            doctorId: { $in: doctorIds },
            appointmentDateAndTime: { $gte: todayStart, $lte: todayEnd },
            appointmentType: "hospital",
          },
        },
        {
          $group: {
            _id: "$patientId",
            firstAppointmentDate: { $min: "$appointmentDateAndTime" },
          },
        },
        {
          $match: {
            firstAppointmentDate: { $gte: todayStart, $lte: todayEnd },
          },
        },
        {
          $count: "newPatientsCount",
        },
      ]);

      const newPatientsCount =
        newPatientsToday.length > 0 ? newPatientsToday[0].newPatientsCount : 0;
      const result = await PaymentToVendor.aggregate([
        {
          $match: { vendorId: mongoose.Types.ObjectId(hospitalId) },
        },
        {
          $group: {
            _id: "$vendorId",
            totalPayableAmount: { $sum: "$payableAmount" },
          },
        },
      ]);

      // Extract the totalPayableAmount from the result
      const totalPayableAmount =
        result.length > 0 ? result[0].totalPayableAmount : 0;

      return res.status(200).json({
        totalPatients,
        totalDoctors,
        totalLabs,
        totalPharmacies,
        newPatientsCount,
        totalPayableAmount,
      });
    } catch (error) {
      return next(error);
    }
  },
  async getAllAppointmentsRequests(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const appointPerPage = 10;
      const hospital = req.user._id;
      const appointmentDate = req.query.appointmentDateAndTime?.trim();
      const searchTerm = req.query.query?.trim(); // We use searchTerm for all fields

      // Base query with specific conditions
      let query = {
        hospital,
        status: "pending",
        $or: [
          // Case 1: status "pending", confirmationStatus "waiting", forwardedRequest true
          { confirmationStatus: "waiting", forwardedRequest: true },
          // Case 2: status "pending", confirmationStatus "awaitingApproval", forwardedRequest false
          { confirmationStatus: "awaitingApproval", forwardedRequest: false },
        ],
      };

      // Exclude status "pending", confirmationStatus "waiting", forwardedRequest false
      query = {
        ...query,
        $nor: [{ confirmationStatus: "waiting", forwardedRequest: false }],
      };

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
        { $unwind: "$doctorInfo" }, // Unwind doctorInfo array
        {
          $lookup: {
            from: "Users", // The users collection name (patients)
            localField: "patientId",
            foreignField: "_id",
            as: "patientId",
          },
        },
        { $unwind: { path: "$patientId", preserveNullAndEmptyArrays: true } }, // Unwind patientInfo
        {
          $lookup: {
            from: "hospitals", // The hospitals collection name
            localField: "hospital",
            foreignField: "_id",
            as: "hospital",
          },
        },
        { $unwind: { path: "$hospital", preserveNullAndEmptyArrays: true } },
      ];

      // Apply the search term conditionally on doctor name, patient name, and appointmentId
      if (searchTerm) {
        const regex = new RegExp(searchTerm, "i"); // Case-insensitive search
        aggregatePipeline.push({
          $match: {
            $or: [
              { "doctorInfo.name": regex }, // Search doctor name
              { "patientId.name": regex }, // Search patient name
              { appointmentId: regex }, // Search appointment ID
            ],
          },
        });
      }

      // Sorting, pagination, and limiting
      aggregatePipeline.push(
        { $sort: { appointmentDateAndTime: 1 } }, // Sort by appointment date
        { $skip: (page - 1) * appointPerPage }, // Skip records for pagination
        { $limit: appointPerPage } // Limit the number of records per page
      );

      const allAppointments = await AppointmentRequest.aggregate(
        aggregatePipeline
      );

      // Counting total appointments for pagination
      const countPipeline = [
        ...aggregatePipeline.slice(0, -3),
        { $count: "totalAppoints" },
      ];
      const countResult = await AppointmentRequest.aggregate(countPipeline);
      const totalAppoints =
        countResult.length > 0 ? countResult[0].totalAppoints : 0;

      const totalPages = Math.ceil(totalAppoints / appointPerPage);
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      const doctorNames = allAppointments.map((app) => app.doctorInfo.name);

      return res.status(200).json({
        appointments: allAppointments,
        auth: true,
        doctorNames,
        totalAppoints,
        previousPage,
        totalPages,
        nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
  async getAllTodaysAppointment(req, res, next) {
    try {
      const hospital = req.user._id;
      const todayStart = moment().startOf("day");
      const todayEnd = moment().endOf("day");

      // Find all pending appointments created today
      const todaysAppointments = await Appointment.find({
        hospital,
        status: { $in: ["pending", "completed"] },
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }).populate("doctorId patientId"); // Assuming you have doctorId and patientId fields to populate

      // Update status to "onGoing" for the appointments
      for (const appointment of todaysAppointments) {
        await Appointment.updateOne(
          { appointmentId: appointment.appointmentId },
          { status: "onGoing" }
        );
      }

      return res.status(200).json({
        appointments: todaysAppointments,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },
  async getAppointmentStats(req, res, next) {
    try {
      const hospitalId = req.user._id; // Assuming the hospital ID is stored in the user object upon authentication

      // Get today's date
      const todayStart = moment().startOf("day");
      const todayEnd = moment().endOf("day");

      // Count total completed appointments for this hospital for today
      const totalSessions = await Appointment.countDocuments({
        hospital: hospitalId,
        status: "completed",
        createdAt: { $gte: todayStart, $lte: todayEnd },
      });

      // Count total appointments of type "video" for this hospital for today
      const totalVideoAppointments = await Appointment.countDocuments({
        hospital: hospitalId,
        appointmentType: "video",
        createdAt: { $gte: todayStart, $lte: todayEnd },
      });

      // Count total appointments for this hospital for today
      const totalAppointments = await Appointment.countDocuments({
        hospital: hospitalId,
        createdAt: { $gte: todayStart, $lte: todayEnd },
      });

      // Calculate percentage of today's completed appointments
      const percentageTotalSessions = totalAppointments
        ? (totalSessions / totalAppointments) * 100
        : 0;

      // Calculate percentage of today's appointments of type "video"
      const percentageVideo = totalAppointments
        ? (totalVideoAppointments / totalAppointments) * 100
        : 0;

      // Set percentage of total appointments to 100%
      const percentageTotalAppointments = 100;

      // Update response object with percentages
      const response = {
        totalSessions,
        totalVideoAppointments,
        totalAppointments,
        percentageTotalSessions,
        percentageVideo,
        percentageTotalAppointments,
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  },
  async getRecentPatients(req, res, next) {
    try {
      const hospitalId = req.user._id; // Assuming the hospital ID is stored in the user object upon authentication

      // Find recent appointment requests for the hospital with status "accepted"
      const recentAppointmentRequests = await AppointmentRequest.find({
        hospital: hospitalId,
        status: "accept",
      })
        .sort({ createdAt: -1 })
        .populate("patientId")
        .limit(10); // Limit to 10 recent appointment requests, you can adjust this as needed

      return res.status(200).json({
        recentAppointmentRequests,
      });
    } catch (error) {
      return next(error);
    }
  },

  // async getTreatmentPackages(req, res, next) {
  //   const { addedBy } = req.query; // Hospital ID and addedBy from query params
  //   const hospitalId = req.user._id;
  //   // Validation for required query params
  //   if (!addedBy || !["hospital", "doctor"].includes(addedBy)) {
  //     return res.status(400).json({
  //       error:
  //         'Query parameter "addedBy" must be either "hospital" or "doctor".',
  //     });
  //   }

  //   // Construct filter object for the query
  //   const filter = { addedBy };

  //   // If hospitalId is provided, include it in the filter
  //   if (hospitalId) {
  //     filter.hospitalId = hospitalId;
  //   }

  //   try {
  //     // Fetch treatments based on the filter
  //     const treatments = await BookTreatment.find(filter)
  //       .populate({
  //         path: "hospitalId", // Populate hospital details if needed
  //         select: "name", // Select only the name of the hospital
  //       })
  //       .populate({
  //         path: "doctorId", // Optionally populate doctor details if needed
  //         select: "name",
  //       });

  //     // If no treatments are found for the query
  //     if (treatments.length === 0) {
  //       return res
  //         .status(404)
  //         .json({ message: "No treatments found for the specified criteria" });
  //     }

  //     // Return the treatments
  //     return res.status(200).json({
  //       treatments,
  //       message: "Treatments successfully fetched",
  //     });
  //   } catch (error) {
  //     console.error("Error fetching treatments:", error);
  //     return next(error); // Forward the error to the error handler
  //   }
  // },

  async getTreatmentPackages(req, res, next) {
    const { addedBy, treatmentId } = req.query; // Hospital ID, addedBy, and treatmentId from query params
    const hospitalId = req.user._id;

    // Validation for required query params
    if (!addedBy || !["hospital", "doctor"].includes(addedBy)) {
      return res.status(400).json({
        error:
          'Query parameter "addedBy" must be either "hospital" or "doctor".',
      });
    }

    // Construct filter object for the query
    const filter = { addedBy };

    // If treatmentId is provided, add it to the filter
    if (treatmentId) {
      filter.treatmentId = treatmentId;
    }

    // If hospitalId is provided, include it in the filter (used for hospital and doctor association)
    if (hospitalId) {
      filter.hospitalId = hospitalId;
    }

    try {
      // Fetch treatments based on the filter
      const treatments = await BookTreatment.find(filter)
        .populate({
          path: "hospitalId", // Populate hospital details if needed
          select: "name", // Select only the name of the hospital
        })
        .populate({
          path: "doctorId", // Optionally populate doctor details if needed
          select: "name",
        })
        .populate({
          path: "treatmentId", // Populate treatment details (e.g., name, category, etc.)
          populate: {
            path: "categoryId", // Populate the category of the treatment if needed
            select: "name", // Select only the name of the category
          },
        });

      // If no treatments are found for the query
      if (treatments.length === 0) {
        return res
          .status(404)
          .json({ message: "No treatments found for the specified criteria" });
      }

      // Return the treatments
      return res.status(200).json({
        treatments,
        message: "Treatments successfully fetched",
      });
    } catch (error) {
      console.error("Error fetching treatments:", error);
      return next(error); // Forward the error to the error handler
    }
  },
};

module.exports = hospitalDashController;
