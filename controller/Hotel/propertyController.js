const Hotel = require("../../models/Hotel/hotel"); // Adjust the path to your Hotel model
const Property = require("../../models/Hotel/property");
const RoomCounter = require("./roomCounter");
const Joi = require("joi");

async function getNextRoomNumber(prefix) {
  const counter = await RoomCounter.findByIdAndUpdate(
    `room_number_${prefix}`,
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true }
  );

  const sequenceValue = counter.sequence_value;
  return `${prefix}-${String(sequenceValue).padStart(2, "0")}`; // e.g., "RO-01", "RO-02"
}

const hotelDashController = {
  async addProperty(req, res, next) {
    const homeInfoSchema = Joi.object({
      property: Joi.string()
        .valid(
          "house",
          "rooms",
          "guest house",
          "camp",
          "container",
          "POD",
          "farm house",
          "tree house",
          "suite"
        )
        .required(),
      propertyName: Joi.string().required(),
      contactNumber: Joi.string().required(),
      location: Joi.object({
        lng: Joi.number().required(),
        lat: Joi.number().required(),
        address: Joi.string().required(),
        city: Joi.string().required(),
      }).when('property', {
        is: Joi.valid('rooms', 'suite'),
        then: Joi.optional(),
        otherwise: Joi.required(),
      }),
      numberOfBeds: Joi.number().required(),
      noOfGuests: Joi.number().required(),
      noOfBathrooms: Joi.object({
        count: Joi.number().required(),
        type: Joi.string().valid("attached", "dedicated", "shared").required(),
      }).required(),
      propertyDetails: Joi.string().required(),
      features: Joi.array()
        .items(
          Joi.object({
            name: Joi.string().required(),
            options: Joi.array().items(Joi.string()).required(),
          })
        )
        .required(),
      propertyCount: Joi.number().required(),
      checkInTime: Joi.string().required(),
      checkOutTime: Joi.string().required(),
      propertyRent: Joi.number().required(),
      meditourFee: Joi.number().required(),
      smoking: Joi.boolean().required(),
      parking: Joi.boolean().required(),
      pets: Joi.boolean().required(),
      extraBeds: Joi.boolean().required(),
      safetyDetails: Joi.array().required(),
      sorroundingProperty: Joi.string(),
      propertyphotos: Joi.array().items(Joi.string()).required(),
      paymentMethods: Joi.array()
        .items(Joi.string().valid("all", "cash", "online", "credit/debit"))
        .required(),
      cancellationWindow: Joi.string().required(),
    });

    const { error } = homeInfoSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const hotelId = req.query.hotelId;

    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      const error = {
        status: 404,
        message: "Hotel not found",
      };
      return next(error);
    }

    let {
      property,
      propertyName,
      contactNumber,
      location,
      numberOfBeds,
      noOfGuests,
      noOfBathrooms,
      propertyDetails,
      features,
      propertyCount,
      checkInTime,
      checkOutTime,
      propertyRent,
      meditourFee,
      smoking,
      parking,
      pets,
      extraBeds,
      safetyDetails,
      sorroundingProperty,
      propertyphotos,
      paymentMethods,
      cancellationWindow,
    } = req.body;

    let space = [];

    if (!propertyCount || propertyCount <= 0) {
      const error = {
        status: 400,
        message:
          "propertyCount is required and must be greater than 0 for rooms",
      };
      return next(error);
    }

    let prefix;
    switch (property) {
      case "house":
        prefix = "HO";
        break;
      case "rooms":
        prefix = "RO";
        break;
      case "guest house":
        prefix = "GH";
        break;
      case "camp":
        prefix = "CA";
        break;
      case "container":
        prefix = "CO";
        break;
      case "POD":
        prefix = "PO";
        break;
      case "farm house":
        prefix = "FH";
        break;
      case "tree house":
        prefix = "TH";
        break;
      case "suite":
        prefix = "SU";
        break;
    }

    for (let i = 1; i <= propertyCount; i++) {
      const spaceNumber = await getNextRoomNumber(prefix);
      space.push({
        spaceNumber,
        isBooked: false,
      });
    }

    if(property == "suite" || property == "rooms"){
      location = hotel.location
    }

    let propertyDoc;
    try {
      const propertyToRegister = new Property({
        hotelId,
        property,
        propertyName,
        contactNumber,
        location,
        numberOfBeds,
        noOfGuests,
        noOfBathrooms,
        propertyDetails,
        features,
        propertyCount,
        checkInTime,
        checkOutTime,
        propertyRent,
        meditourFee,
        smoking,
        parking,
        pets,
        extraBeds,
        safetyDetails,
        sorroundingProperty,
        propertyphotos,
        paymentMethods,
        cancellationWindow,
        space, // Add the space array to the document
      });

      propertyDoc = await propertyToRegister.save();
    } catch (error) {
      return next(error);
    }

    // Return success response
    return res.status(201).json({ propertyDoc: propertyDoc, auth: true });
  },

  async editProperty(req, res, next) {
    const homeInfoSchema = Joi.object({
      hotelId: Joi.string(),
      property: Joi.string().valid(
        "house",
        "rooms",
        "guest house",
        "camp",
        "container",
        "POD",
        "farm house",
        "tree house",
        "suite"
      ),
      propertyName: Joi.string(),
      contactNumber: Joi.string(),
      location: Joi.object({
        lng: Joi.number(),
        lat: Joi.number(),
        address: Joi.string(),
        city: Joi.string(),
      }),
      numberOfBeds: Joi.number(),
      noOfGuests: Joi.number(),
      noOfBathrooms: Joi.object({
        count: Joi.number(),
        type: Joi.string().valid("attached", "dedicated", "shared"),
      }),
      propertyDetails: Joi.string(),
      features: Joi.array().items(
        Joi.object({
          name: Joi.string(),
          options: Joi.array().items(Joi.string()),
        })
      ),
      propertyCount: Joi.number(),
      checkInTime: Joi.string(),
      checkOutTime: Joi.string(),
      propertyRent: Joi.string(),
      meditourFee: Joi.string(),
      smoking: Joi.boolean(),
      pets: Joi.boolean(),
      extraBeds: Joi.boolean(),
      safetyDetails: Joi.array(),
      sorroundingProperty: Joi.string(),
      propertyphotos: Joi.array().items(Joi.string()),
      paymentMethods: Joi.array().items(
        Joi.string().valid("all", "cash", "online", "credit/debit")
      ),
      cancellationWindow: Joi.string(),
    });

    const { error } = homeInfoSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const propertyId = req.query.propertyId;

    let propertyDoc;
    try {
      propertyDoc = await Property.findById(propertyId);
      if (!propertyDoc) {
        const error = {
          status: 404,
          message: "Property not found",
        };
        return next(error);
      }
    } catch (error) {
      return next(error);
    }

    const hotelId = req.user._id;

    if (propertyDoc.hotelId.toString() !== hotelId.toString()) {
      const error = {
        status: 403,
        message: "You are not authorized to edit this property",
      };
      return next(error);
    }

    const {
      property,
      propertyName,
      contactNumber,
      location,
      numberOfBeds,
      noOfGuests,
      noOfBathrooms,
      propertyDetails,
      features,
      propertyCount,
      checkInTime,
      propertyRent,
      meditourFee,
      smoking,
      pets,
      extraBeds,
      safetyDetails,
      sorroundingProperty,
      propertyphotos,
      paymentMethods,
      cancellationWindow,
    } = req.body;

    try {
      if (property) propertyDoc.property = property;
      if (propertyName) propertyDoc.propertyName = propertyName;
      if (contactNumber) propertyDoc.contactNumber = contactNumber;
      if (location) propertyDoc.location = location;
      if (numberOfBeds) propertyDoc.numberOfBeds = numberOfBeds;
      if (noOfGuests) propertyDoc.noOfGuests = noOfGuests;
      if (noOfBathrooms) propertyDoc.noOfBathrooms = noOfBathrooms;
      if (propertyDetails) propertyDoc.propertyDetails = propertyDetails;
      if (features) propertyDoc.features = features;
      if (checkInTime) propertyDoc.checkInTime = checkInTime;
      if (checkOutTime) propertyDoc.checkOutTime = checkOutTime;
      if (propertyRent) propertyDoc.propertyRent = propertyRent;
      if (meditourFee) propertyDoc.meditourFee = meditourFee;
      if (smoking !== undefined) propertyDoc.smoking = smoking;
      if (pets !== undefined) propertyDoc.pets = pets;
      if (extraBeds !== undefined) propertyDoc.extraBeds = extraBeds;
      if (safetyDetails) propertyDoc.safetyDetails = safetyDetails;
      if (sorroundingProperty)
        propertyDoc.sorroundingProperty = sorroundingProperty;
      if (propertyphotos) propertyDoc.propertyphotos = propertyphotos;
      if (paymentMethods) propertyDoc.paymentMethods = paymentMethods;
      if (cancellationWindow)
        propertyDoc.cancellationWindow = cancellationWindow;

      if (
        propertyCount !== undefined &&
        propertyCount !== propertyDoc.propertyCount
      ) {
        const prefix = propertyDoc.property === "rooms" ? "RO" : "HO";
        const currentRooms = propertyDoc.space.length;

        if (propertyCount > currentRooms) {
          const roomsToAdd = propertyCount - currentRooms;
          for (let i = 0; i < roomsToAdd; i++) {
            const spaceNumber = await getNextRoomNumber(prefix);
            propertyDoc.space.push({
              spaceNumber,
              isBooked: false,
            });
          }
        } else if (propertyCount < currentRooms) {
          propertyDoc.space.splice(propertyCount);
        }

        propertyDoc.propertyCount = propertyCount;
      }

      await propertyDoc.save();
    } catch (error) {
      return next(error);
    }

    return res.status(200).json({ property: propertyDoc, auth: true });
  },

  async getProperties(req, res, next) {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const hotelId = req.user._id;
    const search = req.query.search;
    let searchregex = new RegExp(search, "i");

    const skip = (page - 1) * limit;

    try {
      const properties = await Property.find({
        hotelId,
        propertyName: searchregex,
      })
        .skip(skip)
        .limit(limit)
        .exec();

      const totalProperties = await Property.countDocuments({
        hotelId,
        propertyName: searchregex,
      });

      const totalPages = Math.ceil(totalProperties / limit);

      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        auth: true,
        properties: properties,
        totalPages: totalPages,
        totalProperties: totalProperties,
        previousPage,
        nextPage,
        limit: limit,
      });
    } catch (error) {
      return next(error);
    }
  },

  async updateAvailability(req, res, next) {
    const availabilitySchema = Joi.object({
      isAvailable: Joi.boolean().required(),
    });

    const { error } = availabilitySchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const propertyId = req.query.propertyId;

    let propertyDoc;
    try {
      propertyDoc = await Property.findById(propertyId);
      if (!propertyDoc) {
        const error = {
          status: 404,
          message: "Property not found",
        };
        return next(error);
      }
    } catch (error) {
      return next(error);
    }

    const hotelId = req.user._id;

    if (propertyDoc.hotelId.toString() !== hotelId.toString()) {
      const error = {
        status: 403,
        message: "You are not authorized to update this property",
      };
      return next(error);
    }

    const { isAvailable } = req.body;

    try {
      propertyDoc.isAvailable = isAvailable;
      await propertyDoc.save();
    } catch (error) {
      return next(error);
    }

    return res.status(200).json({
      message: "Availability updated successfully",
      property: propertyDoc,
      auth: true,
    });
  },
};

module.exports = hotelDashController;
