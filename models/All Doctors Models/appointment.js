const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    paymentId: [
      {
        id: String,
        status: {
          type: String,
          enum: ["pending", "completed", "rejected"],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    appointmentId: {
      type: String,
      required: true,
    },
    requestRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AppointmentRequest", // Reference to AppointmentRequest
    },    
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    doctorModelType: {
      type: String,
      enum: [
        "Doctor",
        "Psychologist",
        "Physiotherapist",
        "Paramedic",
        "Nutrition",
      ],
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
    },
    appointmentType: {
      type: String,
      enum: ["clinic", "in-house", "hospital", "video"],
    },
    appointmentDateAndTime: {
      type: Date
      // required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "cancelled"],
      default: "pending",
    },
    history: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "History", // Assuming History is the name of the referenced model
    },
    ePrescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ePrescription",
    },
    notes: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notes",
    },
    paidToVendor: {
      type: Boolean,
      required: true,
      default: false,
    },
    totalAmount: {
      type: Number,
      // required: true,
    },
    dollarAmount: {
      type: Number,
      // required: true,
    },
    processingFee: {
      type: Number,
    },
    paidByUserAmount: {
      type: Number,
    },
    isPaidFull: {
      type: Boolean,
    },
    gatewayName: {
      type: String,
    },
    treatmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BookTreatment",
    },
    remainingAmount: {
      type: Number,
      // required: true,
    },
    rescheduled:{
      type:Boolean,
      default:false
    },
    appointmentLink:{
      type: String
    },
    isCompany: {
      type: Boolean,
      default: false
    },
    docCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor Company",
    },
    invoiceId:{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient Invoice",
    }
  },
  {
    timestamps: true,
  }
);

const Appointment = mongoose.model(
  "Appointment",
  appointmentSchema,
  "appointments"
);

module.exports = Appointment;
