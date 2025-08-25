const express = require("express");
const app = express();
const DoctorAvailability = require("../../models/All Doctors Models/availability");

const docAvailabilityController = {
  async addAvailability(req, res, next) {
    try {
      const doctorId = req.user._id;
      const { type, availability, price } = req.body;

      // Validate input
      if (!type || !availability || !price) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check if doctor availability already exists, if not, create a new entry
      let doctorAvailability = await DoctorAvailability.findOne({ doctorId });

      if (!doctorAvailability) {
        doctorAvailability = new DoctorAvailability({ doctorId });
      }

      // Add availability based on type
      switch (type) {
        case "clinic":
          doctorAvailability.clinicAvailability.availability = availability;
          doctorAvailability.clinicAvailability.price = price;
          break;
        case "hospital":
          doctorAvailability.hospitalAvailability.availability = availability;
          doctorAvailability.hospitalAvailability.price = price;
          break;
        case "video":
          doctorAvailability.videoAvailability.availability = availability;
          doctorAvailability.videoAvailability.price = price;
          break;
        case "in-house":
          doctorAvailability.inHouseAvailability.availability = availability;
          doctorAvailability.inHouseAvailability.price = price;
          break;
        default:
          return res.status(400).json({ error: "Invalid availability type" });
      }

      // Save the doctor availability
      await doctorAvailability.save();

      return res
        .status(201)
        .json({ message: "Availability added successfully" });
    } catch (error) {
      return next(error);
    }
  },

  async getAvailability(req, res, next) {
    try {
      const doctorId = req.user._id;
      // Check if doctor availability exists
      const doctorAvailability = await DoctorAvailability.find({ doctorId });

      if (!doctorAvailability) {
        return res.status(404).json([]);
      }

      res.status(200).json({ availability: doctorAvailability });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = docAvailabilityController;
