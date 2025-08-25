const mongoose = require("mongoose");

const historySchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor"
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users"
    },
    appointmentId:{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment"
    },
    bloodPressure: {
      diastolicPressure: Number,
      systolicPressure: Number
    },
    weight: {
      type: Number,
      required: true
    },
    symptoms: [String],
    description: {
      type: String,
    },
    diseases: {
      type: [String],
      default: undefined
    },
    temperature: {
      type: Number,
    },
    heartRate: {
      type: Number,
    },
    sugar: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

const history = mongoose.model(
  "History",
  historySchema,
  "history"
);

module.exports = history;
