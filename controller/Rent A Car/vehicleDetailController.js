const express = require("express");
const Joi = require("joi");
const vehicleDetailDTO = require("../../dto/vehicle");
const Vehicle = require("../../models/Rent A Car/vehicle");
const VehicleRequest = require("../../models/Rent A Car/vehicleRequest");
const AcceptedRequests = require("../../models/Rent A Car/acceptedRequests");
const { getAllRequests } = require("./vehicleRequestController");
const User = require("../../models/User/user");
const acceptedRequests = require("../../models/Rent A Car/acceptedRequests");
const vehicleRequest = require("../../models/Rent A Car/vehicleRequest");
const RentACar = require("../../models/Rent A Car/rentCar");
const app = express();

const vehicleDetailController = {
  async addVehicle(req, res, next) {
    const vehicleDetailSchema = Joi.object({
      vehicleType: Joi.string().empty("").default(null),
      vehicleImages: Joi.array().items(Joi.string()).default([]),
      vehicleName: Joi.string().empty("").default(null),
      ownerName: Joi.string().empty("").default(null),
      mobile: Joi.string().empty("").default(null),
      email: Joi.string().empty("").default(null),
      cnic: Joi.string().empty("").default(null),
      vehicleModel: Joi.string().empty("").default(null),
      vehicleColour: Joi.string().empty("").default(null),
      vehicleRegisterationNo: Joi.string().empty("").default(null),
      actualPricePerDay: Joi.number().allow(null),
      passengerSeats: Joi.string().empty("").default(null),
      chassisNo: Joi.string().empty("").default(null),
    });
    const { error } = vehicleDetailSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const {
      vehicleType,
      vehicleImages,
      vehicleName,
      ownerName,
      mobile,
      email,
      cnic,
      vehicleModel,
      vehicleColour,
      vehicleRegisterationNo,
      actualPricePerDay,
      passengerSeats,
      chassisNo,
    } = req.body;

    let vehicle;
    const rentACarId = req.user._id;
    const rentCar = await RentACar.findById(rentACarId);
    // if (!rentCar.paidActivation) {
    //   const error = {
    //     status: 403,
    //     message: "Please pay the activation fee to activate your account",
    //   };
    //   return next(error);
    // }

    try {
      const vehicleToRegister = new Vehicle({
        rentACarId,
        vehicleType,
        vehicleImages,
        vehicleName,
        ownerName,
        mobile,
        email,
        cnic,
        vehicleModel,
        vehicleColour,
        vehicleRegisterationNo,
        actualPricePerDay,
        passengerSeats,
        chassisNo,
      });

      vehicle = await vehicleToRegister.save();
    } catch (error) {
      return next(error);
    }
    const vehicleDetailDto = new vehicleDetailDTO(vehicle);

    return res.status(201).json({ vehicle: vehicleDetailDto, auth: true });
  },

  async editVehicle(req, res, next) {
    const vehicleDetailSchema = Joi.object({
      vehicleType: Joi.string(),
      vehicleImages: Joi.array(),
      vehicleName: Joi.string(),
      ownerName: Joi.string(),
      mobile: Joi.string(),
      email: Joi.string(),
      cnic: Joi.string(),
      vehicleModel: Joi.string(),
      vehicleColour: Joi.string(),
      vehicleRegisterationNo: Joi.string(),
      actualPricePerDay: Joi.number(),
      passengerSeats: Joi.string(),
      chassisNo: Joi.string(),
    });

    const { error } = vehicleDetailSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      vehicleType,
      vehicleImages,
      vehicleName,
      ownerName,
      mobile,
      email,
      cnic,
      vehicleModel,
      vehicleColour,
      vehicleRegisterationNo,
      actualPricePerDay,
      passengerSeats,
      chassisNo,
    } = req.body;
    // const vehicleId = req.user._id;

    const vehicleId = req.query.vehicleId;
    const existingVehicle = await Vehicle.findById(vehicleId);

    if (!existingVehicle) {
      return res.status(404).json([]); // Send empty response
    }

    if (vehicleType) existingVehicle.vehicleType = vehicleType;
    if (vehicleImages) existingVehicle.vehicleImages = vehicleImages;
    if (vehicleName) existingVehicle.vehicleName = vehicleName;
    if (ownerName) existingVehicle.ownerName = ownerName;
    if (mobile) existingVehicle.mobile = mobile;
    if (email) existingVehicle.email = email;
    if (cnic) existingVehicle.cnic = cnic;
    if (vehicleModel) existingVehicle.vehicleModel = vehicleModel;
    if (vehicleColour) existingVehicle.vehicleColour = vehicleColour;
    if (vehicleRegisterationNo)
      existingVehicle.vehicleRegisterationNo = vehicleRegisterationNo;
    if (actualPricePerDay)
      existingVehicle.actualPricePerDay = actualPricePerDay;
    if (passengerSeats) existingVehicle.passengerSeats = passengerSeats;
    if (chassisNo) existingVehicle.chassisNo = chassisNo;

    await existingVehicle.save();

    return res.status(200).json({
      message: "Vehicle updated successfully",
      vehicle: existingVehicle,
    });
  },

  async deleteVehicle(req, res, next) {
    const vehicleId = req.query.vehicleId;
    const existingVehicle = await Vehicle.findById(vehicleId);

    if (!existingVehicle) {
      return res.status(404).json([]); // Send empty response
    }
    await Vehicle.deleteOne({ _id: vehicleId });
    return res.status(200).json({ message: "Vehicle deleted successfully" });
  },

  async getVehicle(req, res, next) {
    try {
      const vehicleId = req.query.vehicleId;
      const vehicle = await Vehicle.findById(vehicleId);

      if (!vehicle) {
        return res.status(404).json([]); // Send empty response
      }
      return res.status(200).json({ vehicle });
    } catch (error) {
      return next(error);
    }
  },

  async getAllVehicles(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const vehiclePerPage = 10;
      const rentACarId = req.user._id;

      // Get the total number of vehicles
      const totalVehicle = await Vehicle.countDocuments({ rentACarId });

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalVehicle / vehiclePerPage);

      // Calculate the number of vehicles to skip based on the current page
      const skip = (page - 1) * vehiclePerPage;

      // Find all vehicles for the rentACarId, sorted by createdAt field in descending order
      const vehicles = await Vehicle.find({ rentACarId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(vehiclePerPage);

      // Determine previous and next page numbers
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        vehicles: vehicles,
        totalLength: totalVehicle,
        auth: true,
        totalPages,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },

  async getOrderDetail(req, res, next) {
    try {
      const AcceptedRequestId = req.query.acceptedRequestId; // Get the order ID from the request parameters

      // Find the order by ID and populate the user details
      const order = await acceptedRequests
        .findById(AcceptedRequestId)
        .populate("userId")
        .populate("vehicleId");

      if (!order) {
        return res.status(404).json([]); // Send empty response
      }

      res.status(200).json({ order });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
};

module.exports = vehicleDetailController;
