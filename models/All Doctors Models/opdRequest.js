const mongoose = require("mongoose");

const opdRequestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
    },
    message: {
      type: String,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);
const OPDRequest = mongoose.model("OPDRequest", opdRequestSchema, "opdRequests");

module.exports = OPDRequest;
