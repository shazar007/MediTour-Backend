const express = require("express");
const app = express();
const appartmentDTO = require("../../dto/appartment");
const appartmentInfo = require("../../models/Hotel/appartmentInfo.js");
const Hotel = require("../../models/Hotel/hotel.js");
const Joi = require("joi");
const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");
const bcrypt = require("bcryptjs");

const appartmentInfoController = {
  async addAppartment(req, res, next) {
    const appartmentInfoSchema = Joi.object({
      propertyName: Joi.string().required(),
      customName: Joi.string().required(),
      contactNumber: Joi.string().required(),
      alternativeContactNo: Joi.string().required(),
      postCode: Joi.string().required(),
      location: Joi.object().required(),
      partOfCompany: Joi.string().required(),
      nameOfCompany: Joi.string().allow(""),
      channelManager: Joi.string().required(),
      nameOfManager: Joi.string().allow(""),
      apartments: Joi.array().required(),
      amenities: Joi.array().required(),
      parkingAvailability: Joi.string().required(),
      priceOfParking: Joi.string().allow(""),
      propertySurroundings: Joi.array()
        .items(
          Joi.object({
            propertyName: Joi.string().allow(""),
            propertyDistance: Joi.string().allow(""),
          }).allow("")
        )
        .allow(""),
      language: Joi.string().required(),
      facilities: Joi.array().allow(""),
      propertyphoto: Joi.array().required(),
      advanceCancelfreeofCharge: Joi.string().required(),
      accidentalBookingPolicy: Joi.boolean().required(),
      policies: Joi.object().required(),
      pets: Joi.string().allow(""),
      chargesOfPets: Joi.number().allow(""),
      stayOfPets: Joi.string().allow(""),
      minimumStay: Joi.string().required(),
    });
    const hotelId = req.user._id;
    const hotel = await Hotel.findById(hotelId);
    // if (!hotel.paidActivation) {
    //   const error = {
    //     status: 403,
    //     message: "Please pay the activation fee to activate your account",
    //   };
    //   return next(error);
    // }

    const { error } = appartmentInfoSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const {
      propertyName,
      customName,
      contactNumber,
      alternativeContactNo,
      postCode,
      location,
      partOfCompany,
      nameOfCompany,
      channelManager,
      nameOfManager,
      apartments,
      amenities,
      parkingAvailability,
      priceOfParking,
      propertySurroundings,
      language,
      facilities,
      propertyphoto,
      advanceCancelfreeofCharge,
      accidentalBookingPolicy,
      policies,
      pets,
      chargesOfPets,
      stayOfPets,
      minimumStay,
    } = req.body;

    const filteredPropertySurroundings = propertySurroundings.filter(
      (ps) => ps.propertyName && ps.propertyDistance
    );

    const appartmentData = {
      hotelId: req.user._id,
      propertyName,
      customName,
      contactNumber,
      alternativeContactNo,
      postCode,
      location,
      partOfCompany,
      ...(nameOfCompany && { nameOfCompany }),
      channelManager,
      ...(nameOfManager && { nameOfManager }),
      apartments,
      parkingAvailability,
      amenities,
      ...(priceOfParking && { priceOfParking }),
      language,
      facilities,
      propertyphoto,
      advanceCancelfreeofCharge,
      accidentalBookingPolicy,
      policies,
      pets,
      ...(chargesOfPets && { chargesOfPets }),
      stayOfPets,
      minimumStay,
    };

    if (filteredPropertySurroundings.length > 0) {
      appartmentData.propertySurroundings = filteredPropertySurroundings;
    }

    let appartment;
    try {
      const appartmentInfoToRegister = new appartmentInfo(appartmentData);
      appartment = await appartmentInfoToRegister.save();
    } catch (error) {
      return next(error);
    }

    const appartmentDto = new appartmentDTO(appartment);
    return res.status(201).json({ Appartment: appartmentDto, auth: true });
  },
  // update
  async editAppartment(req, res, next) {
    const appartmentInfoSchema = Joi.object({
      propertyName: Joi.string(),
      customName: Joi.string(),
      contactNumber: Joi.string(),
      alternativeContactNo: Joi.string(),
      postCode: Joi.string(),
      location: Joi.object(),
      partOfCompany: Joi.string(),
      nameOfCompany: Joi.string(),
      channelManager: Joi.string(),
      nameOfManager: Joi.string(),
      apartments: Joi.array(),
      beds: Joi.array(),
      amenities: Joi.array(),
      numberOfSofaBed: Joi.string(),
      appartmentSize: Joi.string(),
      basePricePerNight: Joi.string(),
      appartmentImages: Joi.array(),
      parkingAvailability: Joi.string(),
      priceOfParking: Joi.string(),
      propertySurroundings: Joi.array(),
      language: Joi.string(),
      facilities: Joi.array(),
      propertyphoto: Joi.array(),
      advanceCancelfreeofCharge: Joi.string(),
      accidentalBookingPolicy: Joi.boolean(),
      policies: Joi.object(),
      pets: Joi.string(),
      chargesOfPets: Joi.number(),
      stayOfPets: Joi.string(),
      minimumStay: Joi.string(),
    });
    const { error } = appartmentInfoSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      propertyName,
      customName,
      contactNumber,
      alternativeContactNo,
      postCode,
      location,
      partOfCompany,
      nameOfCompany,
      channelManager,
      nameOfManager,
      apartments,
      amenities,
      beds,
      parkingAvailability,
      priceOfParking,
      propertySurroundings,
      language,
      facilities,
      propertyphoto,
      advanceCancelfreeofCharge,
      accidentalBookingPolicy,
      policies,
      pets,
      chargesOfPets,
      stayOfPets,
      minimumStay,
    } = req.body;

    const hotelAppartmentId = req.user._id;

    const appartmentId = req.query.appartmentId;
    const existingAppartment = await appartmentInfo.findById(appartmentId);

    if (!existingAppartment) {
      return res.status(404).json([]);
    }
    // fields

    if (propertyName) existingAppartment.propertyName = propertyName;
    if (customName) existingAppartment.customName = customName;
    if (contactNumber) existingAppartment.contactNumber = contactNumber;
    if (alternativeContactNo)
      existingAppartment.alternativeContactNo = alternativeContactNo;
    if (postCode) existingAppartment.postCode = postCode;
    if (location) existingAppartment.location = location;
    if (partOfCompany) existingAppartment.partOfCompany = partOfCompany;
    if (nameOfCompany) existingAppartment.nameOfCompany = nameOfCompany;
    if (channelManager) existingAppartment.channelManager = channelManager;
    if (nameOfManager) existingAppartment.nameOfManager = nameOfManager;
    if (apartments) existingAppartment.apartments = apartments;
    if (amenities) existingAppartment.amenities = amenities;
    if (beds) existingAppartment.beds = beds;
    if (parkingAvailability)
      existingAppartment.parkingAvailability = parkingAvailability;

    if (priceOfParking) existingAppartment.priceOfParking = priceOfParking;
    if (propertySurroundings)
      existingAppartment.propertySurroundings = propertySurroundings;
    if (language) existingAppartment.language = language;
    if (facilities) existingAppartment.facilities = facilities;
    if (propertyphoto) existingAppartment.propertyphoto = propertyphoto;
    if (advanceCancelfreeofCharge)
      existingAppartment.advanceCancelfreeofCharge = advanceCancelfreeofCharge;
    if (accidentalBookingPolicy)
      existingAppartment.accidentalBookingPolicy = accidentalBookingPolicy;
    if (policies) existingAppartment.policies = policies;
    if (pets) existingAppartment.pets = pets;
    if (stayOfPets) existingAppartment.stayOfPets = stayOfPets;
    if (chargesOfPets) existingAppartment.chargesOfPets = chargesOfPets;
    if (minimumStay) existingAppartment.minimumStay = minimumStay;

    await existingAppartment.save();

    return res.status(200).json({
      message: " Appartment updated successfully",
      appartment: existingAppartment,
    });
  },

  async deleteAppartment(req, res, next) {
    const appartmentId = req.query.appartmentId;
    const existingAppartment = await appartmentInfo.findById(appartmentId);

    if (!existingAppartment) {
      return res.status(404).json([]);
    }
    await appartmentInfo.deleteOne({ _id: appartmentId });
    return res.status(200).json({ message: "Appartment deleted successfully" });
  },

  async getAppartment(req, res, next) {
    try {
      const appartmentId = req.query.appartmentId;
      const appartment = await appartmentInfo.findById(appartmentId);

      if (!appartment) {
        return res.status(404).json([]);
      }
      return res.status(200).json({ appartment });
    } catch (error) {
      return next(error);
    }
  },

  async getAllAppartments(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const appartmentsPerPage = 10;
      const hotelId = req.user._id;

      // Get the total number of apartments for the hotel
      const totalAppartment = await appartmentInfo.count({ hotelId });

      // Calculate the total number of pages based on the number of apartments per page
      const totalPages = Math.ceil(totalAppartment / appartmentsPerPage);

      const skip = (page - 1) * appartmentsPerPage; // Calculate the number of apartments to skip based on the current page

      // Fetch the apartments for the hotel
      const appartments = await appartmentInfo
        .find({ hotelId })
        .skip(skip)
        .sort({ createdAt: -1 }) // Sort by creation date in descending order
        .limit(appartmentsPerPage);

      // Calculate previous and next page numbers
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      // Return the apartments along with pagination metadata and total count
      return res.status(200).json({
        appartments: appartments,
        totalAppartments: totalAppartment,
        auth: true,
        previousPage: previousPage,
        totalPages: totalPages,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = appartmentInfoController;
