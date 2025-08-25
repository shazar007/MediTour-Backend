const mongoose = require("mongoose");

const specialitySchema = new mongoose.Schema({
  specialityTitle: {
    type: String,
    required: true
  }
},
  {
    timestamps: true,
  }
);
const Speciality = mongoose.model(
  "Speciality",
  specialitySchema,
  "specialities"
);

module.exports = Speciality;
