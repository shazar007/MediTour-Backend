const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    vendorId: {
      type: String,
    },
    doctorIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
        default: [],
      },
    ],
    email: {
      type: String,
    },
    password: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    name: {
      type: String,
      required: true,
    },
    bankName: {
      type: String,
    },
    accountHolderName: {
      type: String,
    },
    accountTitle: {
      type: String,
    },
    ntn: {
      type: String,
    },
    accountNumber: {
      type: String,
    },
    blocked: {
      type: Boolean,
      default: false,
    },
    paidActivation: {
      type: Boolean,
      default: false,
    },
    activationRequest: {
      type: String,
      enum: ["pending", "inProgress", "accepted"],
      default: "pending",
    },
    fcmToken: {
      type: String,
    },
    doctorsAllowed: {
      type: Number,
      required: true,
      default: 0
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Doctor Company",
  doctorSchema,
  "doctor companies"
);
