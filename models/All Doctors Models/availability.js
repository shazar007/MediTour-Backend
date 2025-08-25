const { boolean } = require("joi");
const mongoose = require("mongoose");

const availabilityPeriodSchema = new mongoose.Schema({
  startTime: {
    type: String, // Format: 'HH:mm'
    required: true,
  },
  endTime: {
    type: String, // Format: 'HH:mm'
    required: true,
  },
});

const priceSchema = new mongoose.Schema({
  actualPrice: {
    type: Number
  },
});

const availabilitySchema = new mongoose.Schema({
  dayOfWeek: {
    type: Number, // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  },
  // periods: [availabilityPeriodSchema],
  morning: availabilityPeriodSchema,
  evening: availabilityPeriodSchema
});

const hospitalAvailabilitySchema = new mongoose.Schema({
  isAvailable: {
    type: Boolean,
    default: true
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    required: true,
  },
  availability: [availabilitySchema],
  price: priceSchema,
});

const doctorAvailabilitySchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    clinicAvailability: {
      availability: [availabilitySchema],
      price: priceSchema,
    },
    hospitalAvailability: [hospitalAvailabilitySchema],
    videoAvailability: {
      availability: [availabilitySchema],
      price: priceSchema,
    },
    inHouseAvailability: {
      availability: [availabilitySchema],
      price: priceSchema,
    },
  },
  {
    timestamps: true,
  }
);

const DoctorAvailability = mongoose.model(
  "DoctorAvailability",
  doctorAvailabilitySchema,
  "availability"
);

module.exports = DoctorAvailability;
