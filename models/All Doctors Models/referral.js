const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema({
  referringDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
  },
  referType: {
    type: String,
    enum: ["Specialities", "Doctor", "Hospital"],
    required: true,
  },
  specialityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Speciality"
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
},
{
    timestamps: true,
}
);

const Referral = mongoose.model("Referral", referralSchema, "referrals");

module.exports = Referral;
