const express = require("express");
const app = express();
const Availability = require("../../models/All Doctors Models/availability");
const AppointmentRequest = require("../../models/All Doctors Models/request");
const Appointment = require("../../models/All Doctors Models/appointment");
const History = require("../../models/All Doctors Models/history");
const Prescription = require("../../models/All Doctors Models/ePrescription");
const Referral = require("../../models/All Doctors Models/referral");
const Patient = require("../../models/User/user.js");
const Doctor = require("../../models/Doctor/doctors");
const Hospital = require("../../models/Hospital/hospital.js");
const { sendchatNotification } = require("../../firebase/service/index.js");
const Notification = require("../../models/notification.js");
const ePrescription = require("../../models/All Doctors Models/ePrescription");
const Medicine = require("../../models/Pharmaceutical/medicine.js");

const docRequestController = {
  async getRequests(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = 10;
      const doctorId = req.user._id;

      const totalRequests = await AppointmentRequest.countDocuments({
        doctorId,
        status: "pending",
      }); // Get the total number of requests for the user

      const totalPages = Math.ceil(totalRequests / requestsPerPage); // Calculate the total number of pages

      const skip = (page - 1) * requestsPerPage; // Calculate the number of requests to skip based on the current page
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      const allRequests = await AppointmentRequest.find({
        doctorId,
        status: "pending",
      })
        .sort({ createdAt: -1 }) // Sort by createdAt field in descending order
        .populate("patientId")
        .skip(skip)
        .limit(requestsPerPage);

      return res.status(200).json({
        AppointmentRequests: allRequests,
        requestsLength: totalRequests,
        previousPage: previousPage,
        totalPages: totalPages,
        nextPage: nextPage,
        auth: true,
      });
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },
  async acceptRequest(req, res, next) {
    try {
      const bookingId = req.query.bookingId;
      const doctorId = req.user._id;
      const booking = await AppointmentRequest.findById(bookingId);
      if (!booking) {
        return res.status(404).json([]);
      }
      if (booking.status == "accept") {
        return res.status(200).json({
          auth: false,
          message: "Booking already accepted",
        });
      }
      booking.status = "accept";
      const patientId = booking.patientId;
      const appointmentType = booking.appointmentType;
      const doctorModelType = booking.doctorModelType;
      await booking.save();
      const newAppointment = new Appointment({
        doctorId,
        doctorModelType,
        patientId,
        date: Date.now(),
        startTime: booking.requestedDateTime,
        appointmentType,
      });
      // Save the new appointment to the database
      await newAppointment.save();
      sendchatNotification(
        patientId,
        {
          title: "MediTour Global",
          message: `Your appointment request has been accepted!`,
        },
        "user"
      );
      if (req.originalUrl.includes("doc/acceptRequest")) {
        senderModelType = "Doctor";
      } else if (req.originalUrl.includes("nutritionist/acceptRequest")) {
        senderModelType = "Nutrition";
      } else if (req.originalUrl.includes("physio/acceptRequest")) {
        senderModelType = "Physiotherapist";
      } else if (req.originalUrl.includes("paramedic/acceptRequest")) {
        senderModelType = "Paramedic";
      } else if (req.originalUrl.includes("psychologist/acceptRequest")) {
        senderModelType = "Psychologist";
      }
      const notification = new Notification({
        senderId: doctorId,
        senderModelType,
        receiverId: patientId,
        title: "MediTour Global",
        message: "Your appointment request has been accepted!!",
      });
      await notification.save();
      return res.status(200).json({
        auth: true,
        newAppointment,
        message: "Booking Accepted successfully",
      });
    } catch (error) {
      return next(error);
    }
  },

  async rejectRequest(req, res, next) {
    try {
      const bookingId = req.query.bookingId;
      const doctorId = req.user._id;
      const booking = await AppointmentRequest.findById(bookingId);
      if (!booking) {
        return res.status(404).json([]);
      }
      await AppointmentRequest.findByIdAndDelete(bookingId);
      const patientId = booking.patientId;
      sendchatNotification(
        patientId,
        {
          title: "MediTour Global",
          message: `Your appointment request has been rejected!`,
        },
        "user"
      );
      if (req.originalUrl.includes("doc/rejectRequest")) {
        senderModelType = "Doctor";
      } else if (req.originalUrl.includes("nutritionist/rejectRequest")) {
        senderModelType = "Nutrition";
      } else if (req.originalUrl.includes("physio/rejectRequest")) {
        senderModelType = "Physiotherapist";
      } else if (req.originalUrl.includes("paramedic/rejectRequest")) {
        senderModelType = "Paramedic";
      } else if (req.originalUrl.includes("psychologist/rejectRequest")) {
        senderModelType = "Psychologist";
      }
      const notification = new Notification({
        senderId: doctorId,
        senderModelType,
        receiverId: patientId,
        title: "MediTour Global",
        message: "Your appointment request has been rejected!",
      });
      await notification.save();
      return res.status(200).json({
        auth: true,
        message: "Appointment request rejected successfully",
      });
    } catch (error) {
      return next(error);
    }
  },

  async addHistory(req, res, next) {
    try {
      const appointmentId = req.query.appointmentId;
      const patientId = req.query.patientId;
      const doctorId = req.user._id;
      const {
        symptoms,
        description,
        bloodPressure,
        weight,
        diseases,
        temperature,
        heartRate,
        sugar,
      } = req.body;

      const newHistory = new History({
        doctorId,
        patientId,
        symptoms,
        description,
        bloodPressure,
        weight,
        temperature,
        heartRate,
        sugar,
      });
      if (diseases && diseases.length > 0) {
        newHistory.diseases = diseases;
      }

      const savedHistory = await newHistory.save();

      await Appointment.findByIdAndUpdate(
        appointmentId,
        { $set: { history: savedHistory._id } },
        { new: true }
      );

      res.status(201).json({
        message: "History added to the appointment successfully",
        history: savedHistory,
      });
    } catch (error) {
      return next(error);
    }
  },

  async addPrescription(req, res, next) {
    try {
      const appointmentId = req.query.appointmentId;
      const patientId = req.query.patientId;
      const doctorId = req.user._id;
      const { medicines, test } = req.body;

      // Fetch the doctor's details
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json([]);
      }

      // Fetch the medicine details and calculate price
      if (medicines) {
        for (let i = 0; i < medicines.length; i++) {
          const med = medicines[i];

          // Fetch medicine data from the database
          const medicineData = await Medicine.findById(med.medicineId);

          if (!medicineData) {
            return res.status(404).json([]);
          }

          // Calculate the price for each medicine
          const pricePerTab = medicineData.pricePerTab;
          const quantity = med.quantity;

          // Add a new field 'price' which is pricePerTab * quantity
          med.price = pricePerTab * quantity;
        }
      }

      // Create the prescription object
      const prescriptionData = {
        doctorId,
        patientId,
        medicines,
        appointmentId,
      };

      // Include the test field only if it is available
      if (test) {
        prescriptionData.test = test;
      }
      if (medicines) {
        prescriptionData.medicines = medicines;
      }

      const savedPrescription = new Prescription(prescriptionData);
      await savedPrescription.save();

      console.log("savedPrescription", savedPrescription);

      const populatedPrescription = await ePrescription
        .findById(savedPrescription._id)
        .populate({
          path: "test.testId",
        })
        .exec();

      await Appointment.findByIdAndUpdate(
        appointmentId,
        { $set: { ePrescription: savedPrescription._id } },
        { new: true }
      );

      // Fetch the appointment and populate the hospital field
      const appointment = await Appointment.findById(appointmentId)
        .populate("hospital")
        .populate("patientId");

      const hospital = appointment.hospital;
      const patient = appointment.patientId; // Fetch the patient details

      // Send notification to the patient
      sendchatNotification(
        patientId,
        {
          title: "MediTour Global",
          message: `Dr. ${doctor.name} has added a new prescription to your appointment.`,
        },
        "user"
      );

      if (hospital) {
        sendchatNotification(
          hospital._id,
          {
            title: "MediTour Global",
            message: `A new prescription has been saved By ${doctor.name} for patient ${patient.name}.`,
          },
          "Hospital"
        );
      }

      // Create a notification record
      const notification = new Notification({
        senderId: doctorId,
        senderModelType: "Doctor",
        receiverId: patientId,
        receiverModelType: "Users",
        title: "MediTour Global",
        message: `Dr. ${doctor.name} has added a new prescription to your appointment.`,
      });
      await notification.save();

      if (hospital) {
        const hospNotification = new Notification({
          senderId: doctorId,
          senderModelType: "Doctor",
          receiverId: hospital._id,
          receiverModelType: "Hospital",
          title: "MediTour Global",
          message: `A new prescription has been saved By ${doctor.name} for patient ${patient.name}.`,
        });
        await hospNotification.save();
      }

      res.status(201).json({
        success: true,
        message: "Prescription added to appointment successfully",
        prescription: populatedPrescription,
      });
    } catch (error) {
      // Log the error for debugging purposes
      console.error("Error adding prescription:", error);

      // Pass any errors to the error handling middleware
      return next(error);
    }
  },

  async closeAppointment(req, res, next) {
    try {
      const appointmentId = req.query.appointmentId;

      // Fetch the appointment details and populate doctor and patient information
      let appointment = await Appointment.findById(appointmentId).populate(
        "doctorId patientId"
      );
      if (!appointment) {
        return res.status(404).json([]);
      }

      if (appointment.status === "completed") {
        return res.status(200).json({
          auth: false,
          message: "Appointment already closed",
        });
      }

      if (!appointment.ePrescription) {
        return res.status(400).json({
          auth: false,
          message:
            "e-prescription should be added before completing appointment",
        });
      }

      // Update the appointment status to 'completed'
      appointment = await Appointment.findByIdAndUpdate(
        appointmentId,
        { $set: { status: "completed" } },
        { new: true }
      ).populate("doctorId patientId");

      // Fetch the appointment and populate the hospital field
      const appointmentClose = await Appointment.findById(appointmentId)
        .populate("hospital")
        .populate("patientId")
        .populate("doctorId");

      const hospital = appointmentClose.hospital;
      const doctor = appointmentClose.doctorId;
      const patient = appointmentClose.patientId;

      // Send notification to the patient
      sendchatNotification(
        patient._id,
        {
          title: "MediTour Global",
          message: `Your appointment with Dr. ${doctor.name} has been closed.`,
        },
        "user"
      );
      if (hospital) {
        sendchatNotification(
          hospital._id,
          {
            title: "MediTour Global",
            message: `Dr. ${doctor.name} has closed the appointment with the patient ${patient.name}.`,
          },
          "Hospital"
        );
      }

      // Send notification to the doctor
      sendchatNotification(
        doctor._id,
        {
          title: "MediTour Global",
          message: `Your appointment with ${patient.name} has been closed.`,
        },
        "Doctor"
      );

      // Create notification records for both the patient and the doctor
      const patientNotification = new Notification({
        senderId: doctor._id,
        senderModelType: "Doctor",
        receiverId: patient._id,
        receiverModelType: "Users",
        title: "MediTour Global",
        message: `Your appointment with Dr. ${doctor.name} has been closed.`,
      });
      await patientNotification.save();

      const doctorNotification = new Notification({
        senderId: patient._id,
        senderModelType: "Users",
        receiverId: doctor._id,
        receiverModelType: "Doctor",
        title: "MediTour Global",
        message: `Your appointment with ${patient.name} has been closed.`,
      });
      await doctorNotification.save();
      if (hospital) {
        const hospNotification = new Notification({
          senderId: doctor._id,
          senderModelType: "Doctor",
          receiverId: hospital._id,
          receiverModelType: "Hospital",
          title: "MediTour Global",
          message: `Dr. ${doctor.name} has closed the appointment with the patient ${patient.name}.`,
        });
        await hospNotification.save();
      }

      // Return the updated appointment details
      res.status(201).json({
        message: "Appointment Closed Successfully",
        appointment,
      });
    } catch (error) {
      return next(error);
    }
  },

  async getPrescription(req, res, next) {
    try {
      const prescriptionId = req.query.prescriptionId;

      // Fetch the ePrescription and populate doctorId, patientId, and appointmentId
      const prescription = await ePrescription
        .findById(prescriptionId)
        .populate("doctorId") // Populating the doctorId
        .populate("patientId") // Populating the patientId
        .populate({
          path: "appointmentId", // Populating the appointmentId field
          model: "Appointment", // Reference to the Appointment model
          select: "history appointmentDateAndTime",
          populate: {
            path: "history", // Assuming `history` is the field you want to populate
            model: "History", // Reference to the model for the history
          },
        });
      // Check if prescription exists
      if (!prescription) {
        return res.status(404).json([]);
      }

      // Return the populated prescription with appointment details
      res.json(prescription);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },

  async searchDoctor(req, res, next) {
    try {
      const doctorId = req.user._id;
      const query = req.query.name;
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 10; // Default to 10 results per page
      const skip = (page - 1) * limit;
      const regex = new RegExp(query, "i");

      // Fetch matching doctors
      const doctors = await Doctor.find({
        name: regex,
        _id: { $ne: doctorId },
        paidActivation: true, // Filter doctors with paidActivation = true
        blocked: false, // Filter doctors with blocked = false
      })
        .skip(skip) // Apply pagination
        .limit(limit); // Limit the number of results

      // Get the total count of matching doctors (for pagination info)
      const totalDoctors = await Doctor.countDocuments({
        name: regex,
        _id: { $ne: doctorId },
        paidActivation: true, // Filter doctors with paidActivation = true
        blocked: false, // Filter doctors with blocked = false
      });

      const totalPages = Math.ceil(totalDoctors / limit);
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      res.json({
        doctors,
        totalDoctors,
        auth: true,
        previousPage,
        nextPage,
        totalPages,
      });
    } catch (error) {
      return next(error);
    }
  },

  async referDoctor(req, res, next) {
    try {
      const referringDoctor = req.user._id;
      const {
        appointmentId,
        referType,
        patientId,
        doctorId,
        hospitalId,
        specialityId,
      } = req.body;

      // Check if the appointment exists and its status
      let appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json([]);
      }
      if (appointment.status === "completed") {
        return res.status(200).json({ message: "Appointment already closed" });
      }

      // Create a new referral
      const referral = new Referral({
        referringDoctor,
        appointmentId,
        referType,
        ...(doctorId && { doctorId }),
        ...(hospitalId && { hospitalId }),
        ...(specialityId && { specialityId }),
        patientId,
      });

      // Update the appointment status to completed
      appointment = await Appointment.findByIdAndUpdate(
        appointmentId,
        { $set: { status: "completed" } },
        { new: true }
      );

      // Save the referral to the database
      const savedReferral = await referral.save();

      // Fetch the necessary details for notifications
      const referringDoctorDetails = await Doctor.findById(referringDoctor);
      const doctor = doctorId ? await Doctor.findById(doctorId) : null;
      const patient = await Patient.findById(patientId);
      const hospital = hospitalId ? await Hospital.findById(hospitalId) : null;

      await sendchatNotification(
        patientId,
        {
          title: "MediTour Global",
          message: `Dr. ${referringDoctorDetails.name} has referred you${
            doctor ? ` to Dr. ${doctor.name}` : ""
          }${hospital ? ` at ${hospital.name}` : ""}.`,
        },
        "user"
      );

      if (doctorId) {
        await sendchatNotification(
          doctorId,
          {
            title: "MediTour Global",
            message: `You received a new appointment with ${patient.name}, referred by Dr. ${referringDoctorDetails.name}.`,
          },
          "Doctor"
        );
      }

      if (hospitalId) {
        await sendchatNotification(
          hospitalId,
          {
            title: "MediTour Global",
            message: `A new appointment has been scheduled${
              doctor ? ` with Dr. ${doctor.name}` : ""
            } and patient ${patient.name}, referred by Dr. ${
              referringDoctorDetails.name
            }.`,
          },
          "Hospital"
        );
      }

      const patientNotification = new Notification({
        senderId: referringDoctor,
        senderModelType: "Doctor",
        receiverId: patientId,
        receiverModelType: "Users",
        title: "MediTour Global",
        message: `Dr. ${referringDoctorDetails.name} has referred you${
          doctor ? ` to Dr. ${doctor.name}` : ""
        }${hospital ? ` at ${hospital.name}` : ""}.`,
      });
      await patientNotification.save();

      if (doctor) {
        const doctorNotification = new Notification({
          senderId: referringDoctor,
          senderModelType: "Doctor",
          receiverId: doctorId,
          receiverModelType: "Doctor",
          title: "MediTour Global",
          message: `You received a new appointment with ${patient.name}, referred by Dr. ${referringDoctorDetails.name}.`,
        });
        await doctorNotification.save();
      }

      if (hospital) {
        const hospNotification = new Notification({
          senderId: referringDoctor,
          senderModelType: "Doctor",
          receiverId: hospitalId,
          receiverModelType: "Hospital",
          title: "MediTour Global",
          message: `A new appointment has been scheduled${
            doctor ? ` with Dr. ${doctor.name}` : ""
          } and patient ${patient.name}, referred by Dr. ${
            referringDoctorDetails.name
          }.`,
        });
        await hospNotification.save();
      }

      res.status(201).json(savedReferral);
    } catch (error) {
      next(error);
    }
  },
  async searchHospital(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const hospitalsPerPage = 10; // Number of hospitals per page
      const query = req.query.search;
      const regex = new RegExp(query, "i"); // Case-insensitive search for the query

      // Count total number of matching hospitals for pagination
      const totalHospitals = await Hospital.countDocuments({
        name: regex,
        isVerified: true,
        paidActivation: true, // Only hospitals with paidActivation = true
        blocked: false, // Only hospitals that are not blocked
      });

      const totalPages = Math.ceil(totalHospitals / hospitalsPerPage); // Calculate total pages
      const skip = (page - 1) * hospitalsPerPage; // Calculate how many documents to skip
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      // Fetch matching hospitals with pagination logic applied
      const hospitals = await Hospital.find({
        name: regex,
        isVerified: true,
        paidActivation: true, // Only hospitals with paidActivation = true
        blocked: false, // Only hospitals that are not blocked
      })
        .skip(skip) // Skip the required number of hospitals for pagination
        .limit(hospitalsPerPage); // Limit the number of hospitals returned

      res.json({
        hospitals,
        auth: true,
        totalHospitals,
        previousPage: previousPage,
        totalPages: totalPages,
        nextPage: nextPage,
      });
    } catch (error) {
      console.error(error);
      next(error);
    }
  },
};

module.exports = docRequestController;
