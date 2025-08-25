const mongoose = require("mongoose");

const categoriesSchema = new mongoose.Schema(
  {
    categoryName: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    hospitalIds: [
      {
        hospitalId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Hospital",
        },
        doctorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Doctor",
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model(
  "Treatment Category",
  categoriesSchema,
  "treatment categories"
);
