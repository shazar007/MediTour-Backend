const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    vendorId: {
      type: String,
    },
    doctorKind: {
      type: String,
      enum: [
        "doctor",
        "psychologist",
        "physiotherapist",
        "paramedic",
        "nutritionist",
      ],
      required: true,
    },
    hospitalIds: [
      {
        hospitalId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Hospital",
        },
        departmentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Department",
        },
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
    gender: { type: String },
    name: {
      type: String,
      required: true,
    },
    cnicOrPassportNo: {
      type: String,
    },
    cnicOrPassportExpiry: {
      type: String,
    },
    speciality: [
      {
        type: String,
      },
    ],
    qualifications: {
      type: String,
      required: true,
    },
    awardsAndAchievements: [
      {
        description: {
          type: String,
        },
      },
    ],
    clinicName: {
      type: String,
    },
    clinicExperience: {
      type: Number,
    },
    experience: [
      {
          type: String,
      },
    ],
    pmdcNumber: {
      type: String,
    },
    pmdcExpiry: {
      type: String,
    },
    country: String,
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
    youtube: {
      type: String,
    },
    linkedIn: {
      type: String,
    },
    facebook: {
      type: String,
    },
    instagram: {
      type: String,
    },
    incomeTaxNo: {
      type: String,
    },
    salesTaxNo: {
      type: String,
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
    doctorImage: {
      type: String,
    },
    cnicImage: {
      type: String,
    },
    pmdcImage: {
      type: String,
    },
    taxFileImage: {
      type: String,
    },
    averageRating: {
      type: Number,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    doctorType: {
      type: String,
      enum: ["consultant", "generalPhysician"],
    },
    entityType: {
      type: String,
      enum: ["individual", "company"],
    },
    docCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor Company"
    },
    isMeditour: {
      type: Boolean,
      default: false,
    },
    isRecommended: {
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
    isHeadDoc: {
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
    profilePercentage: {
      type: Number,
    },
    about: {
      type: String,
    },
    isNational: {
      type: Boolean,
    },
  },
  {
    timestamps: true,
  }
);
doctorSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Doctor", doctorSchema, "doctors");
