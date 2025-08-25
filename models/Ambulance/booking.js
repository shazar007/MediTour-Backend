const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
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
      paidByUserAmount: {
        type: Number
      },
      ambulanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ambulance Company",
      },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
      },
      name: {
        type: String,
      },
      email: {
        type: String,
      },
      age: {
        type: String,
      },
      address: {
        type: String,
      },
      phone: String,
      requestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ambulance Request",
      },
      bidRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ambulance Bids",
      },
      isPaidFull: {
        type: Boolean
      },
      totalAmount: {
        type: Number
      },
      dollarAmount: {
        type: Number,
        required: true,
      },
      paidToVendor: {
        type: Boolean,
        required: true,
        default: false
      },
      processingFee: {
        type: Number
      },
        gatewayName: {
        type: String,
        required: true
      },
      status: {
        type: String,
        enum: ["in-progress", "completed"],
        default: "in-progress",
      },
    },
    {
      timestamps: true,
  }
);
module.exports = mongoose.model(
  "Ambulance Booking",
  bookingSchema,
  "ambulance bookings"
);
