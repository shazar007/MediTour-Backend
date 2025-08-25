const express = require("express");
const app = express();
const Joi = require("joi");
const HomeInfo = require("../../models/Hotel/homeInfo");
const BnbInfo = require("../../models/Hotel/bnbInfo");
const Hotel = require("../../models/Hotel/hotel");
const homeDTO = require("../../dto/home");
const bnbInfo = require("../../models/Hotel/bnbInfo");
const appartmentInfo = require("../../models/Hotel/appartmentInfo");
const homeInfo = require("../../models/Hotel/homeInfo");
const BnbInfoController = require("./bnbInfoController");

const homeInfoController = {
  async addHome(req, res, next) {
    const homeInfoSchema = Joi.object({
      guestBook: Joi.string().required(),
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
      homeType: Joi.string().required(),
      homeName: Joi.string().required(),
      numberOfBedroom: Joi.number(),
      numberOfDiningrooms: Joi.number(),
      numberOfBathroom: Joi.number().required(),
      kitchens: Joi.number().required(),
      numberOfFloors: Joi.number().required(),
      beds: Joi.array().required(),
      homeSize: Joi.string(),
      basePricePerNight: Joi.number().required(),
      homeImages: Joi.array().required(),
      parkingAvailability: Joi.string().required(),
      priceOfParking: Joi.string().allow(""),
      language: Joi.string().required(),
      facilities: Joi.array(),
      propertySurroundings: Joi.array(),
      amenities: Joi.array().required(),
      propertyphoto: Joi.array().required(),
      advanceCancelfreeofCharge: Joi.string().required(),
      accidentalBookingPolicy: Joi.boolean().required(),
      policies: Joi.object().required(),
      smoking: Joi.string(),
      accomodateChildren: Joi.string(),
      childrenAgeTo: Joi.string(),
      childrenAgeFrom: Joi.string(),
      childCharges: Joi.string(),
      pets: Joi.string(),
      stayOfPets: Joi.string(),
      chargesOfPets: Joi.number().allow(""),
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
    const { error } = homeInfoSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      guestBook,
      propertyName,
      customName,
      contactNumber,
      alternativeContactNo,
      postCode,
      location,
      partOfCompany,
      stayOfPets,
      nameOfCompany,
      channelManager,
      nameOfManager,
      homeType,
      homeName,
      numberOfBedroom,
      numberOfDiningrooms,
      numberOfBathroom,
      kitchens,
      numberOfFloors,
      beds,
      homeSize,
      basePricePerNight,
      homeImages,
      parkingAvailability,
      priceOfParking,
      language,
      facilities,
      propertySurroundings,
      amenities,
      propertyphoto,
      advanceCancelfreeofCharge,
      accidentalBookingPolicy,
      policies,
      smoking,
      accomodateChildren,
      childrenAgeTo,
      childrenAgeFrom,
      childCharges,
      pets,
      chargesOfPets,
      minimumStay,
    } = req.body;
    let home;
    try {
      const homeInfoToRegister = new homeInfo({
        hotelId,
        guestBook,
        propertyName,
        customName,
        contactNumber,
        alternativeContactNo,
        postCode,
        location,
        partOfCompany,
        stayOfPets,
        nameOfCompany,
        channelManager,
        nameOfManager,
        homeType,
        homeName,
        numberOfBedroom,
        numberOfDiningrooms,
        numberOfBathroom,
        kitchens,
        numberOfFloors,
        beds,
        homeSize,
        basePricePerNight,
        homeImages,
        parkingAvailability,
        priceOfParking,
        language,
        facilities,
        propertySurroundings,
        amenities,
        propertyphoto,
        advanceCancelfreeofCharge,
        accidentalBookingPolicy,
        policies,
        smoking,
        accomodateChildren,
        childrenAgeTo,
        childrenAgeFrom,
        childCharges,
        pets,
        chargesOfPets,
        minimumStay,
      });

      home = await homeInfoToRegister.save();
    } catch (error) {
      return next(error);
    }
    const homeDto = new homeDTO(home);

    return res.status(201).json({ Home: homeDto, auth: true });
  },
  // update
  async editHome(req, res, next) {
    const homeInfoSchema = Joi.object({
      guestBook: Joi.string(),
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
      homeType: Joi.string(),
      homeName: Joi.string(),
      numberOfBedroom: Joi.number(),
      numberOfDiningrooms: Joi.number(),
      numberOfBathroom: Joi.number(),
      kitchens: Joi.number(),
      numberOfFloors: Joi.number(),
      beds: Joi.array(),
      homeSize: Joi.string(),
      basePricePerNight: Joi.number(),
      homeImages: Joi.array(),
      parkingAvailability: Joi.string(),
      priceOfParking: Joi.string(),
      language: Joi.string(),
      facilities: Joi.array(),
      propertySurroundings: Joi.array(),
      amenities: Joi.array(),
      propertyphoto: Joi.array(),
      advanceCancelfreeofCharge: Joi.string(),
      accidentalBookingPolicy: Joi.boolean(),
      policies: Joi.object(),
      smoking: Joi.string(),
      accomodateChildren: Joi.string(),
      childrenAgeTo: Joi.string(),
      childrenAgeFrom: Joi.string(),
      childCharges: Joi.string(),
      pets: Joi.string(),
      stayOfPets: Joi.string(),
      chargesOfPets: Joi.number(),
      minimumStay: Joi.string(),
    });
    const { error } = homeInfoSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      guestBook,
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
      homeType,
      homeName,
      numberOfBedroom,
      numberOfDiningrooms,
      numberOfBathroom,
      kitchens,
      numberOfFloors,
      beds,
      homeSize,
      basePricePerNight,
      homeImages,
      parkingAvailability,
      priceOfParking,
      language,
      facilities,
      propertySurroundings,
      amenities,
      propertyphoto,
      advanceCancelfreeofCharge,
      accidentalBookingPolicy,
      policies,
      smoking,
      accomodateChildren,
      childrenAgeTo,
      childrenAgeFrom,
      childCharges,
      pets,
      stayOfPets,
      chargesOfPets,
      minimumStay,
    } = req.body;

    const hotelHomeId = req.user._id;

    const homeId = req.query.homeId;
    const existingHome = await homeInfo.findById(homeId);

    if (!existingHome) {
      return res.status(404).json([]);
    }
    // fields to
    if (guestBook) existingHome.guestBook = guestBook;
    if (propertyName) existingHome.propertyName = propertyName;
    if (customName) existingHome.customName = customName;
    if (contactNumber) existingHome.contactNumber = contactNumber;
    if (alternativeContactNo)
      existingHome.alternativeContactNo = alternativeContactNo;
    if (postCode) existingHome.postCode = postCode;
    if (location) existingHome.location = location;
    if (partOfCompany) existingHome.partOfCompany = partOfCompany;
    if (nameOfCompany) existingHome.nameOfCompany = nameOfCompany;
    if (channelManager) existingHome.channelManager = channelManager;
    if (nameOfManager) existingHome.nameOfManager = nameOfManager;
    if (homeType) existingHome.homeType = homeType;
    if (homeName) existingHome.homeName = homeName;
    if (numberOfBedroom) existingHome.numberOfBedroom = numberOfBedroom;
    if (numberOfDiningrooms)
      existingHome.numberOfDiningrooms = numberOfDiningrooms;
    if (numberOfBathroom) existingHome.numberOfBathroom = numberOfBathroom;
    if (kitchens) existingHome.kitchens = kitchens;
    if (numberOfFloors) existingHome.numberOfFloors = numberOfFloors;
    if (beds) existingHome.beds = beds;
    if (homeSize) existingHome.homeSize = homeSize;
    if (basePricePerNight) existingHome.basePricePerNight = basePricePerNight;
    if (homeImages) existingHome.homeImages = homeImages;
    if (parkingAvailability)
      existingHome.parkingAvailability = parkingAvailability;
    if (priceOfParking) existingHome.priceOfParking = priceOfParking;
    if (language) existingHome.language = language;
    if (facilities) existingHome.facilities = facilities;
    if (propertySurroundings)
      existingHome.propertySurroundings = propertySurroundings;
    if (amenities) existingHome.amenities = amenities;
    if (propertyphoto) existingHome.propertyphoto = propertyphoto;
    if (advanceCancelfreeofCharge)
      existingHome.advanceCancelfreeofCharge = advanceCancelfreeofCharge;
    if (accidentalBookingPolicy)
      existingHome.accidentalBookingPolicy = accidentalBookingPolicy;
    if (policies) existingHome.policies = policies;
    if (smoking) existingHome.smoking = smoking;
    if (accomodateChildren)
      existingHome.accomodateChildren = accomodateChildren;
    if (childrenAgeTo) existingHome.childrenAgeTo = childrenAgeTo;
    if (childrenAgeFrom) existingHome.childrenAgeFrom = childrenAgeFrom;
    if (childCharges) existingHome.childCharges = childCharges;
    if (pets) existingHome.pets = pets;
    if (stayOfPets) existingHome.stayOfPets = stayOfPets;
    if (chargesOfPets) existingHome.chargesOfPets = chargesOfPets;
    if (minimumStay) existingHome.minimumStay = minimumStay;

    await existingHome.save();

    return res.status(200).json({
      message: " Home updated successfully",
      home: existingHome,
    });
  },

  async deleteHome(req, res, next) {
    const homeId = req.query.homeId;
    const existingHome = await homeInfo.findById(homeId);

    if (!existingHome) {
      return res.status(404).json([]);
    }
    await homeInfo.deleteOne({ _id: homeId });
    return res.status(200).json({ message: "Home deleted successfully" });
  },

  async getHome(req, res, next) {
    try {
      const homeId = req.query.homeId;
      const home = await homeInfo.findById(homeId);

      if (!home) {
        return res.status(404).json([]);
      }
      return res.status(200).json({ home });
    } catch (error) {
      return next(error);
    }
  },

  async getAllHomes(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const homePerPage = 10;
      const hotelId = req.user._id;

      // Get the total number of homes for the hotel
      const totalHome = await homeInfo.countDocuments({ hotelId });

      const totalPages = Math.ceil(totalHome / homePerPage);
      const skip = (page - 1) * homePerPage;

      const homes = await homeInfo
        .find({ hotelId })
        .skip(skip)
        .limit(homePerPage)
        .sort({ createdAt: -1 }); // Sort by creation date in descending order;
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        homes: homes,
        totalHomes: totalHome, // Total count of homes
        auth: true,
        totalPages: totalPages,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
  async getProperty(req, res, next) {
    try {
      const hotelId = req.user._id;
      const homeId = req.query.homeId;
      const bnbId = req.query.bnbId;
      const appartmentId = req.query.appartmentId;

      let result;

      if (homeId) {
        result = await homeInfo.findById(homeId);
        if (!result) {
          return res.status(404).json([]);
        }
      } else if (bnbId) {
        result = await BnbInfo.findById(bnbId);
        if (!result) {
          return res.status(404).json([]);
        }
      } else if (appartmentId) {
        result = await appartmentInfo.findById(appartmentId);
        if (!result) {
          return res.status(404).json([]);
        }
      } else {
        const error = new Error("No valid ID provided!");
        error.status = 400;
        return next(error);
      }

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = homeInfoController;
