const { required } = require("joi");
const mongoose = require("mongoose");

const { Schema } = mongoose;

const paymentToVendorSchema = new Schema(
  {
    paymentId: {
      type: String,
      required: true
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "vendorModelType",
      required: true,
    },
    vendorModelType: {
      type: String,
      required: true,
      enum: ["Users", "Laboratory", "Pharmacy", "Doctor", "Hospital", "Ambulance Company", "Psychologist", "Paramedic", "Physiotherapist", "Nutrition", "Donation Company", "Hotel", "Rent A Car", "Travel Agency", "Insurance", "Doctor Company"]
    },
    items: [
      {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "itemModelType",
        required: true,
      },
    ],
    itemModelType: {
        type: String,
        required: true,
        enum: ["Order", "Agency Booking", "Hotel Booking", "Accepted Vehicle Request", "Insurance Booking", "Appointment", "Donations", "Ambulance Booking", "ParamedicRequest", "MedicineRequest"]
    },
    noOfitems: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    totalTax: { type: Number, required: true },
    payableAmount: { type: Number, required: true },
    receiptImage: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Payment To Vendors",
  paymentToVendorSchema,
  "payment to vendors"
);
