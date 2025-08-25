const mongoose = require("mongoose");

const freeConsultancySchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    email: String,
    treatment: {
      type: String,
      required: true,
    },
    message: String,
  },
  {
    timestamps: true,
  }
);

const freeConsultancy = mongoose.model(
  "Free Consultancy",
  freeConsultancySchema,
  "free Consultancies"
);

module.exports = freeConsultancy;
