const Admin = require("../../models/Admin/Admin.js");
const AppointmentRequest = require("../../models/All Doctors Models/request.js");
const Appointment = require("../../models/All Doctors Models/appointment.js");
const { sendchatNotification } = require("../../firebase/service/index.js");
const Notification = require("../../models/notification.js");
const stripePaymentTransaction = require("../../models/stripeTransactions.js");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const client = new twilio(accountSid, authToken);
const transporter = require("../../utils/gmail.js");
const exchangeRateApi = require("../../utils/ExchangeRate.js");
const OPDRequest = require("../../models/All Doctors Models/opdRequest.js");

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

const adminAuthController = {
  async getRequests(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = 10;
      const mrNo = req.query.mrNo;
      const isOpd = req.query.isOpd;
      const { startTime, endTime } = req.query;

      const query = {
        status: "pending",
      };
      if (startTime && endTime) {
        query.createdAt = {
          $gte: new Date(startTime),
          $lte: new Date(endTime),
        };
      }

      let totalRequests = await AppointmentRequest.countDocuments(query);

      const totalPages = Math.ceil(totalRequests / requestsPerPage);

      const skip = (page - 1) * requestsPerPage;

      let allRequests = await AppointmentRequest.find(query)
        .sort({ createdAt: -1 })
        .populate("patientId doctorId")
        .skip(skip)
        .limit(requestsPerPage)
        .exec();

      // Filter appointment requests where mrNo matches
      if (mrNo && isOpd == "false") {
        const filteredRequests = allRequests.filter((appointment) => {
          return (
            appointment.patientId.mrNo === mrNo &&
            appointment.doctorId.isMeditour == false
          );
        });
        allRequests = filteredRequests;
        totalRequests = filteredRequests.length;
      } else if (mrNo && isOpd == "true") {
        const filteredRequests = allRequests.filter((appointment) => {
          return (
            appointment.patientId.mrNo === mrNo &&
            appointment.doctorId.isMeditour === true
          );
        });
        allRequests = filteredRequests;
        totalRequests = filteredRequests.length;
      } else if (!mrNo && isOpd == "true") {
        const filteredRequests = allRequests.filter((appointment) => {
          return (
            appointment.doctorId && appointment.doctorId.isMeditour === true
          );
        });
        allRequests = filteredRequests;
        totalRequests = filteredRequests.length;
      } else if (!mrNo && isOpd == "false") {
        const filteredRequests = allRequests.filter((appointment) => {
          return (
            appointment.doctorId && appointment.doctorId.isMeditour === false
          );
        });
        allRequests = filteredRequests;
        totalRequests = filteredRequests.length;
      }
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        AppointmentRequests: allRequests,
        requestsLength: totalRequests,
        totalPages,
        previousPage,
        nextPage,
        auth: true,
      });
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },

  async getRequest(req, res, next) {
    try {
      const requestId = req.query.id;
      const request = await AppointmentRequest.findById(requestId).populate(
        "patientId doctorId"
      );
      if (!request) {
        return res.status(200).json({
          auth: false,
          message: "Request not found!",
        });
      }
      return res.status(200).json({
        request: request,
        auth: true,
      });
    } catch (error) {
      next(error);
    }
  },

  async acceptRequest(req, res, next) {
    try {
      const bookingId = req.query.bookingId;
      let appointmentDateAndTime = req.body.appointmentDateAndTime;
      const adminId = req.user._id; // Assuming the admin's ID is stored here

      if (!appointmentDateAndTime) {
        const error = new Error("Missing Parameters!");
        error.status = 400;
        return next(error);
      }

      appointmentDateAndTime = new Date(appointmentDateAndTime);

      // Adjust appointment time for UTC offset
      appointmentDateAndTime.setHours(appointmentDateAndTime.getHours() - 5);

      // Find and validate the booking request
      const booking = await AppointmentRequest.findById(bookingId).populate(
        "patientId doctorId hospital treatmentId"
      );

      if (!booking) {
        return res.status(404).json([]);
      }

      // Set booking status based on appointment type
      let { appointmentType, isCompany } = booking; // Extract appointment type

      if (appointmentType === "hospital") {
        booking.status = "pending";
        booking.confirmationStatus = "awaitingApproval";
        // Save the appointment date and time
        booking.appointmentDateAndTime = appointmentDateAndTime;
        // Only update booking status, do not create an appointment
        await booking.save();
        // Respond with success for hospital cases
        return res.status(200).json({
          auth: true,
          AppointmentRequest: booking, // Include the updated booking object
          message: "Booking accepted successfully, no appointment created.",
        });
      } else {
        // For non-hospital appointments, proceed with creating an appointment

        booking.status = "accept";

        // Save the updated booking status
        await booking.save();
        console.log(`Booking status saved: ${booking.status}`);

        // Extract booking details for new appointment creation
        const patient = booking.patientId;
        const doctor = booking.doctorId;
        const hospital = booking.hospital;
        const totalAmount = booking.totalAmount;
        const gatewayName = booking.gatewayName;
        const treatmentId = booking.treatmentId;
        const remainingAmount = booking.remainingAmount;
        const dollarAmount = await exchangeRateApi(totalAmount);

        const appointmentId = await getNextAppointmentNo();
        console.log("sdfghjk", booking.docCompanyId);

        // Create new appointment data (for non-hospital bookings)
        const newAppointmentData = {
          appointmentId,
          doctorId: doctor._id,
          patientId: patient._id,
          ...(hospital && { hospital: hospital._id }),
          appointmentDateAndTime: appointmentDateAndTime,
          appointmentType,
          totalAmount,
          dollarAmount,
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
          ...(booking.docCompanyId && { docCompanyId: booking.docCompanyId }),
          isCompany,
        };

        // Save the new appointment
        const newAppointment = new Appointment(newAppointmentData);
        await newAppointment.save();

        let receiverModelType;
        if (req.originalUrl.includes("admin/acceptRequest")) {
          receiverModelType = "Doctor";
        } else if (req.originalUrl.includes("nutritionist/acceptRequest")) {
          receiverModelType = "Nutrition";
        } else if (req.originalUrl.includes("physio/acceptRequest")) {
          receiverModelType = "Physiotherapist";
        } else if (req.originalUrl.includes("paramedic/acceptRequest")) {
          receiverModelType = "Paramedic";
        } else if (req.originalUrl.includes("psychologist/acceptRequest")) {
          receiverModelType = "Psychologist";
        }

        // Notify doctor about the appointment
        sendchatNotification(
          doctor._id,
          {
            title: "MediTour Global",
            message: `Your appointment has been scheduled with ${patient.name}!`,
          },
          receiverModelType
        );

        const notification = new Notification({
          senderId: adminId,
          senderModelType: "Admin",
          receiverId: doctor._id,
          receiverModelType: receiverModelType,
          title: "MediTour Global",
          message: `Your appointment has been scheduled with ${patient.name}!`,
        });
        await notification.save();

        // Notify patient about the appointment
        sendchatNotification(
          patient._id,
          {
            title: "MediTour Global",
            message: "Your appointment request has been accepted!",
          },
          "user"
        );

        const userNotification = new Notification({
          senderId: adminId,
          senderModelType: "Admin",
          receiverId: patient._id,
          receiverModelType: "Users",
          title: "MediTour Global",
          message: "Your appointment request has been accepted!",
        });
        await userNotification.save();

        // Format date and time for communication
        const formattedDate = appointmentDateAndTime.toLocaleDateString(
          "default",
          {
            day: "numeric",
            month: "short",
            year: "numeric",
          }
        );

        let hours = appointmentDateAndTime.getUTCHours() + 5; // Adjust for UTC
        const minutes = appointmentDateAndTime.getMinutes();
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;

        const formattedTime = `${hours}:${minutes
          .toString()
          .padStart(2, "0")} ${ampm}`;

        // Send email to the patient
        const mailOptions = {
          from: "no-reply@example.com",
          to: patient.email,
          subject: "Appointment Accepted",
          text: `Your appointment has been scheduled with Dr. ${doctor.name}${
            hospital ? ` at ${hospital.name}` : ""
          }. Check schedule!\nDate: ${formattedDate} \nTime: ${formattedTime}`,
        };

        transporter.sendMail(mailOptions, function (err) {
          if (err) {
            console.error("Error sending email:", err);
          }
        });

        // Send SMS notification to the patient
        const smsMessage = `Your appointment has been scheduled with Dr. ${
          doctor.name
        }${
          hospital ? ` at ${hospital.name}` : ""
        }. Check schedule!\nDate: ${formattedDate} \nTime: ${formattedTime}`;

        client.messages
          .create({
            body: smsMessage,
            from: "+12513135752",
            to: patient.phone,
          })
          .then((message) => console.log("SMS sent:", message.sid))
          .catch((error) => console.error("Error sending SMS:", error));

        // Respond with success
        return res.status(200).json({
          auth: true,
          newAppointment,
          formattedDate,
          formattedTime,
          message: "Booking accepted successfully",
        });
      }
    } catch (error) {
      console.error("Error in acceptRequest:", error);
      return next(error);
    }
  },
  // Admin forwards the appointment request to the hospital for confirmation
  async forwardAppointmentToHospital(req, res, next) {
    try {
      const { bookingId } = req.body; // Booking ID that is to be forwarded
      const adminId = req.user._id; // Admin's ID
      let appointmentDateAndTime = req.body.appointmentDateAndTime;

      appointmentDateAndTime = new Date(appointmentDateAndTime);

      // // Adjust appointment time for UTC offset
      appointmentDateAndTime.setHours(appointmentDateAndTime.getHours() - 5);

      // Fetch the appointment request using bookingId
      const booking = await AppointmentRequest.findById(bookingId).populate(
        "patientId doctorId hospital"
      );

      if (!booking) {
        return res.status(404).json({ message: "Booking not found." });
      }

      if (booking.status !== "pending") {
        return res
          .status(400)
          .json({ message: "Booking has already been processed." });
      }

      // Update the status to "forwarded to hospital"
      booking.status = "pending";
      (booking.confirmationStatus = "waiting"),
        (booking.forwardedRequest = true),
        // booking.appointmentDateAndTime = appointmentDateAndTime;
        await booking.save();
      // Extract doctor and patient from populated data
      const doctor = booking.doctorId; // Access the doctor object
      const patient = booking.patientId; // Access the patient object
      const hospital = booking.hospital;

      // Notify doctor about the appointment
      sendchatNotification(
        doctor._id,
        {
          title: "MediTour Global",
          message: `Appointment of ${patient.name} has been forwarded to ${hospital.name} with ${doctor.name}!`,
        },
        "Doctor"
      );

      const notification = new Notification({
        senderId: adminId,
        senderModelType: "Admin",
        receiverId: doctor._id,
        receiverModelType: "Doctor",
        title: "MediTour Global",
        message: `Appointment of ${patient.name} has been forwarded to ${hospital.name} with ${doctor.name}!`,
      });
      await notification.save();

      // Notify patient about the appointment
      sendchatNotification(
        patient._id,
        {
          title: "MediTour Global",
          message: `Your appointment request has been forwarded to ${hospital.name}!`,
        },
        "user"
      );

      const userNotification = new Notification({
        senderId: adminId,
        senderModelType: "Admin",
        receiverId: patient._id,
        receiverModelType: "Users",
        title: "MediTour Global",
        message: "Your appointment request has been accepted!",
      });
      await userNotification.save();

      return res.status(200).json({
        success: true,
        message: "Appointment request forwarded to hospital successfully.",
        booking: booking,
      });
    } catch (error) {
      return next(error); // Pass the error to the error handling middleware
    }
  },
  async getRescheduledAppointments(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get page number
      const appointPerPage = 10; // Appointments per page

      const skip = (page - 1) * appointPerPage;

      // Fetch appointments marked as rescheduled
      const totalAppointments = await Appointment.countDocuments({
        rescheduled: true,
      });

      const totalPages = Math.ceil(totalAppointments / appointPerPage);

      const appointments = await Appointment.find({ rescheduled: true })
        .populate("doctorId", "name specialization") // Populate doctor details
        .populate("patientId", "name email") // Populate patient details
        .sort({ updatedAt: -1 }) // Sort by most recently updated
        .skip(skip)
        .limit(appointPerPage);

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        message: "Rescheduled appointments retrieved successfully.",
        appointments,
        totalAppointments,
        totalPages,
        previousPage,
        nextPage,
      });
    } catch (error) {
      console.error("Error fetching rescheduled appointments:", error);
      return res.status(500).json({
        message: "An error occurred while retrieving rescheduled appointments.",
        error: error.message,
      });
    }
  },

  async getOpdRequests(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = 10;

      let totalRequests = await OPDRequest.countDocuments();

      const totalPages = Math.ceil(totalRequests / requestsPerPage);

      const skip = (page - 1) * requestsPerPage;

      let allRequests = await OPDRequest.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(requestsPerPage);

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        opdRequests: allRequests,
        requestsLength: totalRequests,
        totalPages,
        previousPage,
        nextPage,
        auth: true,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = adminAuthController;
