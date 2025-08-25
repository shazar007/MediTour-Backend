const { required } = require("joi");
const mongoose = require("mongoose");

const { Schema } = mongoose;

const adminSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    fcmToken: { type: String },
   
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Admin", adminSchema, "Admin");

