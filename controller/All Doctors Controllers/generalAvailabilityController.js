const express = require("express");
const app = express();
const DoctorAvailability = require("../../models/All Doctors Models/availability");
const Hospital = require("../../models/Hospital/hospital");
const Doctor = require("../../models/Doctor/doctors");

const docAvailabilityController = {
  async addAvailability(req, res, next) {
    try {
      const doctorId = req.user._id;
      const { type, availability, hospitalId, price } = req.body;
      console.log("price", price);

      // Validate input
      if (!type || !availability) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      let doctorAvailability = await DoctorAvailability.findOne({ doctorId });

      if (!doctorAvailability) {
        doctorAvailability = new DoctorAvailability({ doctorId });
      }

      switch (type) {
        case "clinic":
          doctorAvailability.clinicAvailability.availability = availability;
          break;
        case "hospital":
          const existingHospitalIndex =
            doctorAvailability.hospitalAvailability.findIndex(
              (item) => String(item.hospitalId) === hospitalId
            );

          if (existingHospitalIndex !== -1) {
            doctorAvailability.hospitalAvailability[
              existingHospitalIndex
            ].availability = availability;
            if (price !== undefined) {
              doctorAvailability.hospitalAvailability[
                existingHospitalIndex
              ].price = {
                actualPrice: price,
              };
            }
          } else {
            doctorAvailability.hospitalAvailability.push({
              hospitalId,
              availability,
              price: { actualPrice: price },
            });
          }
          break;
        case "video":
          doctorAvailability.videoAvailability.availability = availability;
          if (!doctorAvailability.videoAvailability.price) {
          }
          break;
        case "in-house":
          doctorAvailability.inHouseAvailability.availability = availability;
          if (!doctorAvailability.inHouseAvailability.price) {
          }
          break;
        default:
          return res.status(400).json({ error: "Invalid availability type" });
      }

      await doctorAvailability.save();

      return res
        .status(201)
        .json({ message: "Availability added successfully" });
    } catch (error) {
      return next(error);
    }
  },

  async addAvailabilityPrice(req, res, next) {
    try {
      const doctorId = req.user._id;
      const { type, price } = req.body;
      if (price == 0) {
        return res.status(400).json({
          error: "Price value cannot be zero. Please enter a valid price.",
        });
      }

      // Validate input
      if (!type || !price) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check if doctor availability already exists, if not, create a new entry
      let doctorAvailability = await DoctorAvailability.findOne({ doctorId });

      if (!doctorAvailability) {
        doctorAvailability = new DoctorAvailability({ doctorId });
      }

      // Update price based on type
      switch (type) {
        case "clinic":
          if (doctorAvailability.clinicAvailability) {
            doctorAvailability.clinicAvailability.price = {
              actualPrice: price,
            };
          } else {
            doctorAvailability.clinicAvailability = {
              price: { actualPrice: price },
            };
          }
          break;
        case "hospital":
          const hospitalId = req.body.hospitalId;

          // Validate hospitalId
          if (!hospitalId) {
            return res
              .status(400)
              .json({ error: "Missing hospitalId for hospital availability" });
          }

          // Check for existing hospital availability
          const existingHospitalIndex =
            doctorAvailability.hospitalAvailability.findIndex(
              (item) => String(item.hospitalId) === hospitalId
            );

          if (existingHospitalIndex !== -1) {
            // Hospital availability already exists, update the price
            doctorAvailability.hospitalAvailability[
              existingHospitalIndex
            ].price = { actualPrice: price };
          } else {
            // Hospital availability does not exist, add the price for this hospitalId
            doctorAvailability.hospitalAvailability.push({
              hospitalId,
              price: { actualPrice: price },
            });
          }
          break;
        case "video":
          if (doctorAvailability.videoAvailability) {
            doctorAvailability.videoAvailability.price = { actualPrice: price };
          } else {
            doctorAvailability.videoAvailability = {
              price: { actualPrice: price },
            };
          }
          break;
        case "in-house":
          if (doctorAvailability.inHouseAvailability) {
            doctorAvailability.inHouseAvailability.price = {
              actualPrice: price,
            };
          } else {
            doctorAvailability.inHouseAvailability = {
              price: { actualPrice: price },
            };
          }
          break;
        default:
          return res.status(400).json({ error: "Invalid availability type" });
      }

      // Save the doctor availability
      await doctorAvailability.save();

      return res.status(200).json({ message: "Price updated successfully" });
    } catch (error) {
      return next(error);
    }
  },

  async getAvailability(req, res, next) {
    try {
      const doctorId = req.user._id;

      // Fetch doctor availability with populated hospital information
      let doctorAvailability = await DoctorAvailability.find({
        doctorId,
      }).populate({
        path: "hospitalAvailability.hospitalId",
        select: "name paidActivation blocked", // Fetch only the necessary fields
      });

      if (!doctorAvailability || doctorAvailability.length === 0) {
        return res.status(404).json([]);
      }

      // Filter out hospitals with paidActivation as false or blocked as true
      doctorAvailability = doctorAvailability.map((availability) => {
        availability.hospitalAvailability =
          availability.hospitalAvailability.filter(
            (hospital) =>
              hospital.hospitalId && // Ensure hospital exists
              hospital.hospitalId.paidActivation !== false && // Exclude unpaid hospitals
              hospital.hospitalId.blocked !== true // Exclude blocked hospitals
          );
        return availability;
      });

      res.status(200).json({ availability: doctorAvailability });
    } catch (error) {
      next(error);
    }
  },

  async deleteAvailability(req, res, next) {
    try {
      const doctorId = req.user._id;
      const { type, periodId } = req.body;

      // Validate input
      if (!type || !periodId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Fetch the doctor's availability
      let doctorAvailability = await DoctorAvailability.findOne({ doctorId });
      if (!doctorAvailability) {
        return res.status(404).json([]);
      }

      // Function to remove availability period by ID
      const removePeriodById = (availabilityArray) => {
        let periodRemoved = false;
        availabilityArray.forEach((availability) => {
          const initialLength = availability.periods.length;
          availability.periods = availability.periods.filter(
            (period) => period._id.toString() !== periodId
          );
          if (initialLength !== availability.periods.length) {
            periodRemoved = true; // Period was found and removed
          }
        });
        return periodRemoved;
      };

      // Remove availability based on type
      let availabilityRemoved = false;
      switch (type) {
        case "clinic":
          availabilityRemoved = removePeriodById(
            doctorAvailability.clinicAvailability.availability
          );
          break;
        case "hospital":
          doctorAvailability.hospitalAvailability.forEach(
            (hospitalAvailability) => {
              if (removePeriodById(hospitalAvailability.availability)) {
                availabilityRemoved = true;
              }
            }
          );
          break;
        case "video":
          availabilityRemoved = removePeriodById(
            doctorAvailability.videoAvailability.availability
          );
          break;
        case "in-house":
          availabilityRemoved = removePeriodById(
            doctorAvailability.inHouseAvailability.availability
          );
          break;
        default:
          return res.status(400).json({ error: "Invalid availability type" });
      }

      if (!availabilityRemoved) {
        return res.status(404).json([]);
      }

      // Save the updated doctor availability
      await doctorAvailability.save();

      return res
        .status(200)
        .json({ message: "Availability deleted successfully" });
    } catch (error) {
      return next(error);
    }
  },
  async getAvailabilityHospitals(req, res, next) {
    try {
      const doctorId = req.user._id;
      // Check if doctor availability exists
      const doctorAvailability = await DoctorAvailability.find({ doctorId });
      //    // If doctorAvailability is empty or null
      // if (!doctorAvailability || doctorAvailability.length === 0) {
      //   return res.status(404).json({ message: "No doctor availability found." });
      // }
      if (!doctorAvailability || doctorAvailability.length === 0) {
        return res.status(404).json([]);
      }
      const hospitalAvailability = doctorAvailability[0].hospitalAvailability;
      if (!hospitalAvailability || hospitalAvailability.length === 0) {
        return res.status(404).json([]);
      }
      const hospitalIds = hospitalAvailability.map((availability) => {
        return availability.hospitalId;
      });

      const hospitals = await Hospital.find(
        { _id: { $in: hospitalIds } },
        { name: 1 }
      );

      res.status(200).json({ hospitals });
    } catch (error) {
      next(error);
    }
  },
  async getDocHospitals(req, res, next) {
    try {
      const doctorId = req.user._id;
      const doctor = await Doctor.findById(doctorId).populate({
        path: "hospitalIds.hospitalId", // Correct way to populate nested reference
        select: "name logo",
      });
      const hospitals = doctor.hospitalIds.map((h) => h.hospitalId);
      console.log(hospitals);

      res.status(200).json({ hospitals });
    } catch (error) {
      next(error);
    }
  },

  async getSingleHospAvailability(req, res, next) {
    try {
      const doctorId = req.user._id;
      const hospitalId = req.query.hospitalId;
      // Check if doctor availability exists
      const doctorAvailability = await DoctorAvailability.find({ doctorId });

      if (!doctorAvailability) {
        return res.status(404).json([]);
      }
      const hospitalAvailability = doctorAvailability[0].hospitalAvailability
        .map((availability) => {
          if (availability.hospitalId == hospitalId) {
            return availability;
          }
          return undefined;
        })
        .filter((availability) => availability !== undefined);

      res.status(200).json({ availability: hospitalAvailability });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = docAvailabilityController;
