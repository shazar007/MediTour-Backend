const express = require("express");
const app = express();
const Joi = require("joi");
const bnbInfo = require("../../models/Hotel/bnbInfo");
const bnbDTO = require("../../dto/bnb");
const hotel = require("../../models/Hotel/hotel");

const BnbInfoController = {
  async addBnb(req, res, next) {
    const bnbInfoSchema = Joi.object({
      category: Joi.string().required(),
      propertyName: Joi.string().required(),
      starRating: Joi.string().required(),
      customName: Joi.string().required(),
      contactNumber: Joi.string().required(),
      alternativeContactNo: Joi.string().required(),
      location: Joi.object().required(),
      postCode: Joi.string().required(),
      rooms: Joi.array().required(),
      amenities: Joi.array().required(),
      parkingAvailability: Joi.string().required(),
      priceOfParking: Joi.string().allow(""),
      language: Joi.string().required(),
      facilities: Joi.array(),
      propertySurroundings: Joi.array()
        .items(
          Joi.object({
            propertyName: Joi.string().allow(""),
            propertyDistance: Joi.string().allow(""),
          }).allow("")
        )
        .allow(""),
      extraBedAvailability: Joi.string(),
      noOfExtraBeds: Joi.string(),
      propertyphoto: Joi.array().required(),
      advanceCancelfreeofCharge: Joi.string().required(),
      accidentalBookingPolicy: Joi.boolean().required(),
      policies: Joi.object().required(),
      pets: Joi.string(),
      chargesOfPets: Joi.number().allow(""),
      stayOfPets: Joi.string(),
      minimumStay: Joi.string().required(),
    });
    const hotelId = req.user._id;
    const Hotel = await hotel.findById(hotelId);
    // if (!Hotel.paidActivation) {
    //   const error = {
    //     status: 403,
    //     message: "Please pay the activation fee to activate your account",
    //   };
    //   return next(error);
    // }
    const { error } = bnbInfoSchema.validate(req.body);
    if (error) {
      return next(error);
    }
    const {
      category,
      propertyName,
      starRating,
      customName,
      contactNumber,
      alternativeContactNo,
      location,
      postCode,
      rooms,
      amenities,
      parkingAvailability,
      priceOfParking,
      language,
      facilities,
      extraBedAvailability,
      noOfExtraBeds,
      propertySurroundings,
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
    let bnb;
    try {
      const bnbInfoToRegister = new bnbInfo({
        hotelId,
        category,
        propertyName,
        starRating,
        customName,
        contactNumber,
        alternativeContactNo,
        location,
        postCode,
        minimumStay,
        rooms,
        amenities,
        parkingAvailability,
        ...(priceOfParking && { priceOfParking }),
        language,
        facilities,
        extraBedAvailability,
        noOfExtraBeds,
        ...(filteredPropertySurroundings.length > 0 && {
          propertySurroundings: filteredPropertySurroundings,
        }),
        propertyphoto,
        advanceCancelfreeofCharge,
        accidentalBookingPolicy,
        policies,
        pets,
        ...(chargesOfPets && { chargesOfPets }),
        stayOfPets,
      });

      bnb = await bnbInfoToRegister.save();
    } catch (error) {
      return next(error);
    }

    const bnbDto = new bnbDTO(bnb);

    return res.status(201).json({ Bnb: bnbDto, auth: true });
  },

  async updateBnb(req, res, next) {
    const bnbInfoSchema = Joi.object({
      category: Joi.string(),
      propertyName: Joi.string(),
      starRating: Joi.string(),
      customName: Joi.string(),
      contactNumber: Joi.string(),
      alternativeContactNo: Joi.string(),
      location: Joi.object(),
      postCode: Joi.string(),
      rooms: Joi.array(),
      amenities: Joi.array(),
      propertySurroundings: Joi.array(),
      parkingAvailability: Joi.string(),
      priceOfParking: Joi.string(),
      language: Joi.string(),
      facilities: Joi.array(),
      extraBedAvailability: Joi.string(),
      noOfExtraBeds: Joi.string(),
      propertyphoto: Joi.array(),
      advanceCancelfreeofCharge: Joi.string(),
      accidentalBookingPolicy: Joi.boolean(),
      policies: Joi.object(),
      pets: Joi.string(),
      chargesOfPets: Joi.number(),
      stayOfPets: Joi.string(),
      minimumStay: Joi.string(),
    });
    const { error } = bnbInfoSchema.validate(req.body);
    if (error) {
      return next(error);
    }
    const {
      category,
      propertyName,
      starRating,
      customName,
      contactNumber,
      alternativeContactNo,
      location,
      postCode,
      rooms,
      amenities,
      propertySurroundings,
      parkingAvailability,
      priceOfParking,
      language,
      facilities,
      extraBedAvailability,
      noOfExtraBeds,
      propertyphoto,
      advanceCancelfreeofCharge,
      accidentalBookingPolicy,
      policies,
      pets,
      chargesOfPets,
      stayOfPets,
      minimumStay,
    } = req.body;
    const hotelBnbId = req.user._id;

    const bnbId = req.query.bnbId;
    const prevBnb = await bnbInfo.findById(bnbId);

    if (!prevBnb) {
      return res.status(404).json([]);
    }

    // update fields

    if (category) prevBnb.category = category;
    if (propertyName) prevBnb.propertyName = propertyName;
    if (starRating) prevBnb.starRating = starRating;
    if (customName) prevBnb.customName = customName;
    if (contactNumber) prevBnb.contactNumber = contactNumber;
    if (alternativeContactNo)
      prevBnb.alternativeContactNo = alternativeContactNo;
    if (location) prevBnb.location = location;
    if (postCode) prevBnb.postCode = postCode;
    if (rooms) prevBnb.rooms = rooms;
    if (amenities) prevBnb.amenities = amenities;
    if (propertySurroundings)
      prevBnb.propertySurroundings = propertySurroundings;
    if (parkingAvailability) prevBnb.parkingAvailability = parkingAvailability;
    if (priceOfParking) prevBnb.priceOfParking = priceOfParking;
    if (language) prevBnb.language = language;
    if (facilities) prevBnb.facilities = facilities;
    if (extraBedAvailability)
      prevBnb.extraBedAvailability = extraBedAvailability;
    if (noOfExtraBeds) prevBnb.noOfExtraBeds = noOfExtraBeds;
    if (propertyphoto) prevBnb.propertyphoto = propertyphoto;
    if (advanceCancelfreeofCharge)
      prevBnb.advanceCancelfreeofCharge = advanceCancelfreeofCharge;
    if (accidentalBookingPolicy)
      prevBnb.accidentalBookingPolicy = accidentalBookingPolicy;
    if (policies) prevBnb.policies = policies;
    if (pets) prevBnb.pets = pets;
    if (stayOfPets) prevBnb.stayOfPets = stayOfPets;
    if (chargesOfPets) prevBnb.chargesOfPets = chargesOfPets;
    if (minimumStay) prevBnb.minimumStay = minimumStay;
    await prevBnb.save();

    return res.status(200).json({
      message: "B&Bs Updated Successfully",
      bnb: prevBnb,
    });
  },
  async deleteBnb(req, res, next) {
    const bnbId = req.query.bnbId;
    const prevBnb = await bnbInfo.findById(bnbId);

    if (!prevBnb) {
      return res.status(404).json([]);
    }
    await bnbInfo.deleteOne({ _id: bnbId });
    return res.status(200).json({ message: "B&B deleted successfully" });
  },

  async getBnb(req, res, next) {
    try {
      const bnbId = req.query.bnbId;
      const bnb = await bnbInfo.findById(bnbId);
      if (!bnb) {
        return res.status(404).json([]);
      }

      return res.status(200).json(bnb);
    } catch (error) {
      return next(error);
    }
  },
  async getAllBnb(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const bnbsPerPage = 10;
      const hotelId = req.user._id;

      // Get the total number of BnBs for the hotel directly from the database
      const totalBnb = await bnbInfo.countDocuments({ hotelId });

      const totalPages = Math.ceil(totalBnb / bnbsPerPage);
      const skip = (page - 1) * bnbsPerPage;

      // Fetch the paginated BnBs for the hotel
      const paginatedBnbs = await bnbInfo
        .find({ hotelId })
        .skip(skip)
        .limit(bnbsPerPage)
        .populate("hotelId")
        .sort({ createdAt: -1 }); // Sort by creation date in descending order;

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      const hotelsWithRoomInfo = await Promise.all(
        paginatedBnbs.map(async (bnb) => {
          const roomTypes = {};
          let totalRooms = 0;

          bnb.rooms.forEach((room) => {
            if (roomTypes.hasOwnProperty(room.roomType)) {
              roomTypes[room.roomType] += room.noOfRoomType;
            } else {
              roomTypes[room.roomType] = room.noOfRoomType;
            }
            totalRooms += room.noOfRoomType;
          });

          const totalRoomTypes = Object.keys(roomTypes).length;

          // Return individual bnb with room information
          return {
            bnb: bnb,
            roomTypes: roomTypes,
            totalRooms: totalRooms,
            totalRoomTypes: totalRoomTypes,
          };
        })
      );

      // Return all bnbs with room information along with pagination metadata
      return res.status(200).json({
        bnbs: hotelsWithRoomInfo,
        totalBnb,
        previousPage,
        nextPage,
        totalPages,
      });
    } catch (error) {
      return next(error);
    }
  },
  async getAllHotels(req, res, next) {
    try {
      // Get pagination parameters from the query string
      const page = parseInt(req.query.page) || 1; // Default to page 1 if not specified
      const limit = parseInt(req.query.limit) || 10; // Default to 10 items per page if not specified
      const skip = (page - 1) * limit;

      // Fetch all bnbs from the database with pagination
      const bnbs = await bnbInfo.find().skip(skip).limit(limit);

      // Iterate through each bnb and calculate room type information
      const hotelsWithRoomInfo = await Promise.all(
        bnbs.map(async (bnb) => {
          // Calculate room type information for each bnb
          const roomTypes = {};
          let totalRooms = 0;

          bnb.rooms.forEach((room) => {
            if (roomTypes.hasOwnProperty(room.roomType)) {
              roomTypes[room.roomType] += 1;
            } else {
              roomTypes[room.roomType] = 1;
            }
            totalRooms += 1;
          });
          const totalRoomTypes = Object.keys(roomTypes).length;

          // Construct hotel object with room information
          const hotelWithRoomInfo = {
            _id: bnb._id,
            roomTypes: roomTypes,
            totalRooms: totalRooms,
            totalRoomTypes: totalRoomTypes,
          };

          return hotelWithRoomInfo;
        })
      );

      // Get total number of hotels to calculate total pages
      const totalBnbs = await bnbInfo.countDocuments();
      const totalPages = Math.ceil(totalBnbs / limit);

      // Return hotels with room information and pagination details
      return res.status(200).json({
        hotels: hotelsWithRoomInfo,
        currentPage: page,
        totalPages: totalPages,
        totalHotels: totalBnbs,
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = BnbInfoController;
