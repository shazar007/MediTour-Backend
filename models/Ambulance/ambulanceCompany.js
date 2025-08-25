const mongoose = require("mongoose");

const ambulanceSchema = new mongoose.Schema(
  {
    vendorId: {
      type: String,
    },
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
    },
    registrationNumber: {
      type: String,
      // required: true,
    },
    accountTitle: {
      type: String,
    },
    country:String,
    ntn:{
      type: String,
    },
    registrationExpiry: {
      type: String,
      // required: true,
    },
    ownerFirstName: {
      type: String,
    },
    ownerLastName: {
      type: String,
    },
    emergencyNo: {
      type: String,
      required: true,
    },
    cnicOrPassportNo: {
      type: String,
    },
    cnicOrPassportExpiry: {
      type: String,
    },
    location: {
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
      city: String
    },
    // website: {
    //   type: String,
    // },
    // twitter: {
    //   type: String,
    // },
    youtube:{
      type: String,
    },
    linkedIn:{
      type: String,
    },
    facebook: {
      type: String,
    },
    instagram: {
      type: String,
    },
    // incomeTaxNo: {
    //   type: String,
    // },
    // salesTaxNo: {
    //   type: String,
    // },
    bankName: {
      type: String,
    },
    accountHolderName: {
      type: String,
    },
    accountNumber: {
      type: String,
    },
    logo: {
      type: String,
      required: true,
    },
    registrationImage: {
      type: String
    },
    isVerified: {
      type: Boolean,
      default: false,
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
      default: "pending"
    },
    cnicOrPassportImage: {
      type: String
    },
    taxFileImage: {
      type: String,
    },
    fcmToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model(
  "Ambulance Company",
  ambulanceSchema,
  "ambulance companies"
);
