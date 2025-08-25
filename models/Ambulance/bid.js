const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ambulance Request",
    },
    ambulanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ambulance Company",
        required: true,
      },
    ambulanceName: {
      type: String,
      required: true,
    },
    ambulanceNo: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "booked", "rejected"],
      default: "pending",
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Ambulance Bids", bidSchema, "ambulance bids");
