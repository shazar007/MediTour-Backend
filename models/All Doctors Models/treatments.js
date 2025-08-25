const mongoose = require("mongoose");

const treatmentsSchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Treatment Category",
      required: true,
    },
    subCategory: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    hospitalIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hospital",
        default: [],
      },
    ],
  },
  {
    timestamps: true,
  }
);
const Treatment = mongoose.model("Treatment", treatmentsSchema, "treatments");

module.exports = Treatment;
