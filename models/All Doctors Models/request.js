const mongoose = require("mongoose");

const appointmentRequestSchema = new mongoose.Schema(
  {
    paymentId: [{
      id: String,
      status: {
        type: String,
        enum: ["pending", "completed", "rejected"]
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }],
    appointmentId: {
      type: String,
    },
    appointmentRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment", // Reference to Appointment
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
    },
    appointmentDateAndTime: {
      type: Date
     
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
    },
    appointmentType: {
      type: String,
      enum: ["clinic", "in-house", "hospital", "video"],
    },
    status: {
      type: String,
      enum: ["pending", "accept", "reject"],
      default: "pending",
    },
    confirmationStatus: {
      type: String,
      enum: ["waiting", "confirm", "cancel","awaitingApproval"],
      default: "waiting",
    },
    isPaidFull: {
      type: Boolean
    },
    paidByUserAmount: {
      type: Number
    },
    totalAmount: {
      type: Number,
      required: true
    },
    processingFee: {
      type: Number
    },
    gatewayName: {
      type: String
    },
    isTreatment: {
      type: Boolean
    },
    forwardedRequest: {
      type: Boolean,
      default: false,
    },
    forwardedrescheduledRequest: {
      type: Boolean,
      default: false,
    },
    treatmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BookTreatment",
    },
    remainingAmount: {
      type: Number,
      required: true
    },
    docCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor Company",
    },
    isCompany: {
      type: Boolean,
      default: false
    },
  },
  {
    timestamps: true,
  }
);

const AppointmentRequest = mongoose.model(
  "AppointmentRequest",
  appointmentRequestSchema,
  "appointmentRequests"
);

module.exports = AppointmentRequest;
