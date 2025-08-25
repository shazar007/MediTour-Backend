const mongoose = require("mongoose");

const ambulanceRequestSchema = new mongoose.Schema(
  {
    pickUp: {
        lng: {
          type: Number,
          required: true,
        },
        lat: {
          type: Number,
          required: true,
        },
        address: {
          type: String,
          required: true,
        },
        city: {
          type: String,
          required: true,
        },
      },
    dropOff: {
        lng: {
          type: Number,
          required: true,
        },
        lat: {
          type: Number,
          required: true,
        },
        address: {
          type: String,
          required: true,
        },
        city: {
          type: String,
          required: true,
        },
      },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accept"],
      default: "pending"
    },
  },
  {
    timestamps: true,
  }
);
  module.exports = mongoose.model(
  "Ambulance Request",
  ambulanceRequestSchema,
  "ambulance requests"
);
