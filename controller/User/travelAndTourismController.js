const bnbInfo = require("../../models/Hotel/bnbInfo");
const BNB = require("../../models/Hotel/bnbInfo");
const Apartment = require("../../models/Hotel/appartmentInfo");
const HotelBookingRequests = require("../../models/Hotel/bookHotelRequest");
const Admin = require("../../models/Admin/Admin"); // Import the Admin model
const BookHotel = require("../../models/Hotel/bookhotel");
const appartmentInfo = require("../../models/Hotel/appartmentInfo");
const homeInfo = require("../../models/Hotel/homeInfo");
const Notification = require("../../models/notification");
const { sendchatNotification } = require("../../firebase/service");
const stripePaymentTransaction = require("../../models/stripeTransactions");
const Hotel = require("../../models/Hotel/hotel");
const User = require("../../models/User/user.js");
const Property = require("../../models/Hotel/property.js");
const Joi = require("joi");

async function getNextRequestNo() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestOrder = await HotelBookingRequests.findOne({}).sort({
      createdAt: -1,
    });

    let nextOrderIdNumber = 1;
    if (latestOrder && latestOrder.requestId) {
      // Extract the numeric part of the orderId and increment it
      const currentOrderIdNumber = parseInt(latestOrder.requestId.substring(3));
      nextOrderIdNumber = currentOrderIdNumber + 1;
    }

    // Generate the next orderId
    const nextOrderId = `REQ${nextOrderIdNumber.toString().padStart(4, "0")}`;

    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}

const travelAndTourismController = {
  // async searchHotel(req, res, next) {
  //   try {
  //     const { city, rooms, adults, filters, serviceType } = req.body;
  //     const page = parseInt(req.query.page) || 1;
  //     const perPage = 10;
  //     const numRooms = parseInt(rooms);
  //     const numAdults = parseInt(adults);

  //     // Validate input parameters
  //     if (!city || isNaN(numRooms) || isNaN(numAdults)) {
  //       return res.status(400).json({ error: "Invalid input parameters" });
  //     }

  //     let pipeline = [];
  //     let hotels;
  //     let totalCount;
  //     let totalPages;

  //     if (serviceType === "hotel") {
  //       // Count total properties matching the criteria
  //       totalCount = await BNB.countDocuments({
  //         "location.city": city,
  //         // "rooms.noOfGuestsStay": { $gte: numAdults },
  //         // totalRooms: { $gte: numRooms },
  //       });
  //       console.log("totalCountBNB", totalCount);
  //       totalPages = Math.ceil(totalCount / perPage);
  //       // Add filters if provided
  //       if (filters) {
  //         const { lowerPriceLimit, upperPriceLimit, popularFilters, sort } =
  //           filters;

  //         // Add price range filter
  //         if (lowerPriceLimit !== undefined && upperPriceLimit !== undefined) {
  //           pipeline.push({
  //             $match: {
  //               "rooms.pricePerNight": {
  //                 $gte: lowerPriceLimit,
  //                 $lte: upperPriceLimit,
  //               },
  //             },
  //           });
  //         }

  //         // Add popular filters
  //         if (popularFilters && popularFilters.length > 0) {
  //           pipeline.push({
  //             $match: {
  //               "rooms.amenities": { $in: popularFilters },
  //             },
  //           });
  //         }

  //         // Add sorting
  //         if (sort) {
  //           pipeline.push({
  //             $addFields: {
  //               minRoomPrice: { $min: "$rooms.pricePerNight" },
  //             },
  //           });

  //           pipeline.push({
  //             $sort: {
  //               minRoomPrice: sort === "ascending" ? 1 : -1,
  //             },
  //           });
  //         }
  //       }
  //       pipeline.push({
  //         $match: {
  //           "location.city": city, // Ensure filtering by city
  //         },
  //       });
  //       pipeline.push({ $skip: (page - 1) * perPage }, { $limit: perPage });

  //       hotels = await BNB.aggregate(pipeline).exec();
  //     } else if (serviceType === "apartment") {
  //       // Count total properties matching the criteria
  //       totalCount = await Apartment.countDocuments({
  //         "location.city": city,
  //       });
  //       console.log("totalCountapp", totalCount);
  //       totalPages = Math.ceil(totalCount / perPage);
  //       // Add filters if provided (similar to hotels)
  //       if (filters) {
  //         const { lowerPriceLimit, upperPriceLimit, popularFilters, sort } =
  //           filters;

  //         // Add price range filter
  //         if (lowerPriceLimit !== undefined && upperPriceLimit !== undefined) {
  //           pipeline.push({
  //             $match: {
  //               "apartments.basePricePerNight": {
  //                 $gte: lowerPriceLimit,
  //                 $lte: upperPriceLimit,
  //               },
  //             },
  //           });
  //         }

  //         // Add popular filters
  //         if (popularFilters && popularFilters.length > 0) {
  //           pipeline.push({
  //             $match: {
  //               "apartments.amenities": { $in: popularFilters },
  //             },
  //           });
  //         }

  //         // Add sorting (similar to hotels)
  //         if (sort) {
  //           pipeline.push({
  //             $addFields: {
  //               minApartmentPrice: { $min: "$apartments.basePricePerNight" },
  //             },
  //           });

  //           pipeline.push({
  //             $sort: {
  //               minApartmentPrice: sort === "ascending" ? 1 : -1,
  //             },
  //           });
  //         }
  //       }
  //       pipeline.push({
  //         $match: {
  //           "location.city": city, // Ensure filtering by city
  //         },
  //       });
  //       pipeline.push({ $skip: (page - 1) * perPage }, { $limit: perPage });

  //       hotels = await Apartment.aggregate(pipeline).exec();
  //     } else if (serviceType === "home") {
  //       // Count total properties matching the criteria
  //       totalCount = await homeInfo.countDocuments({
  //         "location.city": city,
  //       });
  //       console.log("totalCounthom", totalCount);
  //       totalPages = Math.ceil(totalCount / perPage);

  //       // Add filters if provided (similar to hotels)
  //       if (filters) {
  //         const { lowerPriceLimit, upperPriceLimit, popularFilters, sort } =
  //           filters;

  //         // Add price range filter
  //         if (lowerPriceLimit !== undefined && upperPriceLimit !== undefined) {
  //           pipeline.push({
  //             $match: {
  //               basePricePerNight: {
  //                 $gte: lowerPriceLimit,
  //                 $lte: upperPriceLimit,
  //               },
  //             },
  //           });
  //         }

  //         // Add popular filters
  //         if (popularFilters && popularFilters.length > 0) {
  //           pipeline.push({
  //             $match: {
  //               amenities: { $in: popularFilters },
  //             },
  //           });
  //         }

  //         // Add sorting (similar to hotels)
  //         if (sort) {
  //           pipeline.push({
  //             $addFields: {
  //               minHomePrice: { $min: "$basePricePerNight" },
  //             },
  //           });

  //           pipeline.push({
  //             $sort: {
  //               minHomePrice: sort === "ascending" ? 1 : -1,
  //             },
  //           });
  //         }
  //       }
  //       pipeline.push({
  //         $match: {
  //           "location.city": city, // Ensure filtering by city
  //         },
  //       });
  //       pipeline.push({ $skip: (page - 1) * perPage }, { $limit: perPage });

  //       hotels = await homeInfo.aggregate(pipeline).exec();
  //     }
  //     // Populate hotel details
  //     if (hotels && hotels.length > 0) {
  //       hotels = await BNB.populate(hotels, {
  //         path: "hotelId",
  //         model: "Hotel",
  //       });
  //     }

  //     const lowestPrice = hotels.reduce((min, hotel) => {
  //       return hotel.minRoomPrice < min ? hotel.minRoomPrice : min;
  //     }, Infinity);
  //     // Filter out hotels where hotelId.blocked is true
  //     hotels = hotels.filter(
  //       (hotel) =>
  //         hotel.hotelId &&
  //         hotel.hotelId.paidActivation === true &&
  //         !hotel.hotelId.blocked
  //     );
  //     // Calculate next and previous page existence
  //     const nextPage = hotels.length === perPage ? page + 1 : null;
  //     const prevPage = page > 1 ? page - 1 : null;

  //     // Return response including total count
  //     res.status(200).json({
  //       hotels,
  //       totalCount,
  //       totalPages: Math.ceil(totalCount / perPage),
  //       auth: true,
  //       lowestPrice,
  //       nextPage,
  //       prevPage,
  //     });
  //   } catch (error) {
  //     next(error);
  //   }
  // },

  async searchHotel(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const hotelsPerPage = 10;
      const { city, country } = req.query;
      const filterTypes = req.query.filter
        ? req.query.filter.split(",")
        : ["all"];

      const query = {};

      if (filterTypes.includes("country")) {
        query.country = country;
      }

      if (filterTypes.includes("recommended")) {
        query.isRecommended = true; // Filter by recommended status
      }

      if (filterTypes.includes("city") && city) {
        query["location.city"] = city.trim(); // Filter by city
      }

      const totalHotels = await Hotel.countDocuments(query);
      const totalPages = Math.ceil(totalHotels / hotelsPerPage);
      const skip = (page - 1) * hotelsPerPage;

      const hotels = await Hotel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(hotelsPerPage)
        .exec();

      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        Hotels: hotels,
        hotelsLength: totalHotels,
        previousPage,
        nextPage,
        totalPages,
        auth: true,
      });
    } catch (error) {
      return res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },

  async listProperties(req, res, next) {
    try {
      const hotelId = req.query.hotelId;
      const page = parseInt(req.query.page) || 1;
      const propertiesPerPage = 10;

      const totalProperties = await Property.countDocuments({ hotelId });
      const totalPages = Math.ceil(totalProperties / propertiesPerPage);
      const skip = (page - 1) * propertiesPerPage;

      const properties = await Property.find({ hotelId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(propertiesPerPage);

      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        properties: properties,
        propertiesLength: totalProperties,
        previousPage,
        nextPage,
        totalPages,
        auth: true,
      });
    } catch (error) {
      next(error);
    }
  },

  async cancelReservation(req, res, next) {
    try {
      const userId = req.user._id;
      const reservationId = req.query.reservationId;

      const reservation = await HotelBookingRequests.findById(reservationId);
      if (!reservation) {
        return res.status(404).json({
          auth: true,
          message:
            "Reservation not found. Please provide a valid reservation ID.",
        });
      }

      if (reservation.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          auth: true,
          message:
            "You do not have permission to cancel this reservation. It does not belong to your account.",
        });
      }

      if (!reservation.isReservation) {
        return res.status(400).json({
          auth: true,
          message:
            "This reservation is not active and cannot be cancelled. Please check the reservation status.",
        });
      }

      reservation.status = "expired";
      await reservation.save();

      res.status(200).json({
        auth: true,
        message: "Reservation cancelled successfully!",
      });
    } catch (error) {
      next(error);
    }
  },
  //not in use//
  async addHotelBooking(req, res, next) {
    try {
      const userId = req.user._id; // User making the booking
      const {
        paymentId,
        paidByUserAmount,
        processingFee,
        gatewayName,
        isPaidFull,
        hotelId,
        serviceId,
        serviceType,
        rooms,
        apartments,
        name,
        email,
        age,
        address,
        purpose,
        totalAmount,
        arrivalDate,
        noOfGuest,
        remainingAmount,
      } = req.body;

      // Validate the required fields for all service types
      if (
        !hotelId ||
        !serviceId ||
        !serviceType ||
        !name ||
        !email ||
        !arrivalDate ||
        !totalAmount ||
        !paymentId
      ) {
        return res.status(400).json({ message: "Missing required fields." });
      }
      let serviceModelType;
      let notificationMessage;
      let newBooking;
      // Retrieve the hotel details
      const hotel = await Hotel.findById(hotelId);
      if (!hotel) {
        return res.status(404).json([]); // Send empty response
      }
      let travelCompanyId;
      if (hotel.travelCompanyId) {
        travelCompanyId = hotel.travelCompanyId;
      }

      const requestId = await getNextRequestNo();

      let paymentDetails = {
        id: paymentId,
        status: gatewayName === "stripe" ? "completed" : "pending",
        createdAt: new Date(),
      };

      // Determine service model type and create a new booking based on serviceType
      switch (serviceType.toLowerCase()) {
        case "hotel":
          if (!rooms) {
            return res.status(400).json({
              message: "Missing required field: rooms for hotel booking.",
            });
          }
          serviceModelType = "Hotels And Bnb";
          newBooking = new HotelBookingRequests({
            requestId,
            paymentId: paymentDetails,
            paidByUserAmount,
            processingFee,
            isPaidFull,
            hotelId,
            serviceId,
            serviceModelType,
            userId,
            rooms,
            name,
            email,
            age,
            address,
            purpose,
            totalAmount,
            arrivalDate,
            noOfGuest,
            gatewayName,
            remainingAmount,
            isCompany: hotel.entityType === "company" ? true : false,
            ...(travelCompanyId && { travelCompanyId }),
          });
          break;

        case "apartment":
          if (!apartments) {
            return res.status(400).json({
              message:
                "Missing required field: apartments for apartment booking.",
            });
          }
          serviceModelType = "AppartmentInfo";
          newBooking = new HotelBookingRequests({
            requestId,
            paymentId: paymentDetails,
            paidByUserAmount,
            processingFee,
            isPaidFull,
            hotelId,
            serviceId,
            serviceModelType,
            userId,
            apartments,
            name,
            email,
            age,
            address,
            purpose,
            totalAmount,
            arrivalDate,
            noOfGuest,
            gatewayName,
            remainingAmount,
            isCompany: hotel.entityType === "company" ? true : false,
            ...(travelCompanyId && { travelCompanyId }),
          });
          break;

        case "home":
          serviceModelType = "HomeInfo";
          newBooking = new HotelBookingRequests({
            requestId,
            paymentId: paymentDetails,
            paidByUserAmount,
            processingFee,
            isPaidFull,
            hotelId,
            serviceId,
            serviceModelType,
            userId,
            name,
            email,
            age,
            address,
            purpose,
            totalAmount,
            arrivalDate,
            noOfGuest,
            gatewayName,
            remainingAmount,
            isCompany: hotel.entityType === "company" ? true : false,
            ...(travelCompanyId && { travelCompanyId }),
          });
          break;

        default:
          return res.status(400).json({ message: "Invalid service type." });
      }

      // Save the new booking to the database
      const savedBooking = await newBooking.save();
      const id = savedBooking._id;
      const idModelType = "Hotel Booking Requests";
      if (gatewayName !== "blinq") {
        const stripePaymentToRegister = new stripePaymentTransaction({
          id,
          idModelType,
          paymentId,
          gatewayName,
          paidByUserAmount,
          isPaidFull,
        });
        const stripeController = await stripePaymentToRegister.save();
        // Check if the booking is saved successfully
        if (savedBooking) {
          // Retrieve all admin users
          const admins = await Admin.find({});
          // Prepare notification message based on service type
          switch (serviceModelType) {
            case "AppartmentInfo":
              notificationMessage = `You have a new booking request for Apartments with ${hotel.name} received from ${name} with the payment of ${paidByUserAmount}.`;
              break;

            case "HomeInfo":
              notificationMessage = `You have a new booking request for Homes with ${hotel.name} received from ${name} with the payment of ${paidByUserAmount}.`;
              break;

            default:
              notificationMessage = `You have a new booking request for ${serviceModelType} with ${hotel.name} received from ${name} with the payment of ${paidByUserAmount}.`;
          }

          // Prepare notification data
          const notifications = admins.map((admin) => ({
            senderId: userId,
            senderModelType: "Users",
            receiverId: admin._id,
            receiverModelType: "Admin",
            title: "MediTour Global",
            message: notificationMessage,
            createdAt: new Date(), // Set the creation date for notifications
          }));

          // Insert notifications into the database in bulk for efficiency
          await Notification.insertMany(notifications);

          // Send chat notifications to all admins asynchronously
          admins.forEach((admin) => {
            sendchatNotification(
              admin._id,
              {
                title: "MediTour Global",
                message: notificationMessage,
              },
              "admin"
            );
          });
        }
      }

      // Return the created booking request in the response
      res.status(201).json({
        success: true,
        booking: savedBooking,
      });
    } catch (error) {
      // Pass any errors to the error handling middleware
      return next(error);
    }
  },

  //..........new api.........//
  async addHotelRequest(req, res, next) {
    try {
      const userId = req.user._id;

      const bookingSchema = Joi.object({
        paymentId: Joi.when("isReservation", {
          is: false,
          then: Joi.string().required(),
          otherwise: Joi.string().forbidden(),
        }),
        paidByUserAmount: Joi.when("isReservation", {
          is: false,
          then: Joi.number().required(),
          otherwise: Joi.number().forbidden(),
        }),
        propertyId: Joi.string()
          .regex(/^[0-9a-fA-F]{24}$/)
          .required(),
        noOfGuest: Joi.number().required(),
        name: Joi.string(),
        email: Joi.string().email(),
        age: Joi.number(),
        address: Joi.string(),
        status: Joi.string()
          .valid("pending", "accepted", "rejected")
          .default("pending"),
        totalAmount: Joi.number().required(),
        arrivalDate: Joi.object({
          from: Joi.string().required(),
          to: Joi.string().required(),
        }).required(),
        processingFee: Joi.when("isReservation", {
          is: false,
          then: Joi.number().required(),
          otherwise: Joi.number().forbidden(),
        }),
        isPaidFull: Joi.when("isReservation", {
          is: false,
          then: Joi.boolean().required(),
          otherwise: Joi.boolean().forbidden(),
        }),
        gatewayName: Joi.when("isReservation", {
          is: false,
          then: Joi.string().required(),
          otherwise: Joi.string().forbidden(),
        }),
        remainingAmount: Joi.number().required(),
        isCompany: Joi.boolean().default(false),
        travelCompanyId: Joi.string().regex(/^[0-9a-fA-F]{24}$/),
        isReservation: Joi.boolean().required(),
        spaceNumbers: Joi.when("isReservation", {
          is: true,
          then: Joi.array().min(1).max(2).required().messages({
            "array.min": "Place specify at least 1 space.",
            "array.max":
              "Cannot book more than 2 spaces in case of reservation.",
            "any.required": "The spaceNumbers field is required.",
          }),
          otherwise: Joi.array().min(1).required().messages({
            "array.min": "The spaceNumbers array cannot be empty.",
            "any.required": "The spaceNumbers field is required.",
          }),
        }),
      });

      const { error } = bookingSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ message: error.details[0].message });
      }

      const {
        paymentId,
        paidByUserAmount,
        processingFee,
        gatewayName,
        isPaidFull,
        propertyId,
        name,
        email,
        age,
        address,
        purpose,
        totalAmount,
        arrivalDate,
        noOfGuest,
        remainingAmount,
        isReservation,
        spaceNumbers,
      } = req.body;

      const property = await Property.findById(propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found." });
      }

      const hotelId = property.hotelId;
      const hotel = await Hotel.findById(hotelId);
      if (!hotel) {
        return res.status(404).json({ message: "Hotel not found." });
      }

      const existingUserReservation = await HotelBookingRequests.findOne({
        userId,
        status: "pending",
        isReservation: true,
      });
      console.log("existingUserReservation", existingUserReservation);

      if (existingUserReservation) {
        return res.status(400).json({
          message: "You already have an active reservation!",
        });
      }

      const arrivalFrom = new Date(arrivalDate.from);
      const arrivalTo = new Date(arrivalDate.to);
      arrivalTo.setDate(arrivalTo.getDate() + 1);

      const overlappingBookings = await HotelBookingRequests.find({
        spaceNumbers: { $in: spaceNumbers },
        "arrivalDate.from": { $lt: arrivalTo },
        "arrivalDate.to": { $gt: arrivalFrom },
        status: { $in: ["pending", "accepted"] },
      });

      if (overlappingBookings.length > 0) {
        return res.status(400).json({
          message:
            "Some or all of the requested spaces are already booked for the specified dates.",
        });
      }

      const requestId = await getNextRequestNo();

      let paymentDetails = {
        id: paymentId,
        status: gatewayName === "stripe" ? "completed" : "pending",
        createdAt: new Date(),
      };

      const newBooking = new HotelBookingRequests({
        requestId,
        ...(paymentId && { paymentId: paymentDetails }),
        ...(paidByUserAmount && { paidByUserAmount }),
        ...(processingFee && { processingFee }),
        isPaidFull: isPaidFull,
        hotelId,
        spaceType: property.property,
        propertyId,
        userId,
        name,
        email,
        age,
        address,
        purpose,
        totalAmount,
        arrivalDate: {
          from: arrivalFrom,
          to: arrivalTo,
        },
        noOfGuest,
        ...(gatewayName && { gatewayName }),
        remainingAmount,
        isCompany: hotel.entityType === "company" ? true : false,
        ...(hotel.travelCompanyId && {
          travelCompanyId: hotel.travelCompanyId,
        }),
        isReservation: isReservation,
        spaceNumbers,
      });

      const savedBooking = await newBooking.save();

      if (gatewayName && gatewayName !== "blinq") {
        const stripePaymentToRegister = new stripePaymentTransaction({
          id: savedBooking._id,
          idModelType: "Hotel Booking Requests",
          paymentId,
          gatewayName,
          paidByUserAmount,
          isPaidFull,
        });
        await stripePaymentToRegister.save();
      }

      let notificationMessage;
      if (!isReservation) {
        notificationMessage = `You have a new booking request for ${
          property.propertyName
        } with ${hotel.name} received from ${name} with the payment of ${
          paidByUserAmount - processingFee
        }.`;
      } else if (isReservation) {
        notificationMessage = `You have a new reservation request for ${property.propertyName} with ${hotel.name} received from ${name}.`;
      }

      const admins = await Admin.find({});
      console.log("notificationMessage", notificationMessage);

      const notifications = admins.map((admin) => ({
        senderId: userId,
        senderModelType: "Users",
        receiverId: admin._id,
        receiverModelType: "Admin",
        title: "MediTour Global",
        message: notificationMessage,
        createdAt: new Date(),
      }));

      await Notification.insertMany(notifications);

      admins.forEach((admin) => {
        sendchatNotification(
          admin._id,
          {
            title: "MediTour Global",
            message: notificationMessage,
          },
          "admin"
        );
      });

      res.status(201).json({
        success: true,
        booking: savedBooking,
      });
    } catch (error) {
      return next(error);
    }
  },

  async hotelRemainingPayment(req, res, next) {
    try {
      const paymentSchema = Joi.object({
        bookingId: Joi.when("isReservation", {
          is: false, // If isReservation is false
          then: Joi.string().required(), // paymentId is required
          otherwise: Joi.string().forbidden(), // Otherwise, it's optional
        }),
        requestId: Joi.when("isReservation", {
          is: true,
          then: Joi.string().required(),
          otherwise: Joi.string().forbidden(),
        }),
        paidByUserAmount: Joi.number().required(),
        paymentId: Joi.string().required(),
        gatewayName: Joi.string().required(),
        processingFee: Joi.number().required(),
        isReservation: Joi.boolean().required(),
      });
      const { error } = paymentSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ message: error.details[0].message });
      }

      let {
        bookingId,
        requestId,
        paidByUserAmount,
        paymentId,
        gatewayName,
        processingFee,
        isReservation,
      } = req.body;
      if (isReservation) {
        const request = await HotelBookingRequests.findById(requestId);
        if (!request) {
          return res.status(404).json([]); // Send empty response
        }
        const hotelId = request.hotelId;
        const userId = request.userId;

        const hotel = await Hotel.findById(hotelId);
        const user = await User.findById(userId);
        let amount;

        let paymentDetails = {
          id: paymentId,
          status: gatewayName === "stripe" ? "completed" : "pending",
          createdAt: new Date(),
        };
        request.paymentId.push(paymentDetails);

        const idModelType = "Hotel Booking Requests";
        if (gatewayName != "blinq") {
          request.paidByUserAmount = paidByUserAmount;
          request.processingFee = processingFee;
          request.isPaidFull = true;
          request.gatewayName = "stripe";
          request.isReservation = false;

          const stripePaymentToRegister = new stripePaymentTransaction({
            id: requestId,
            idModelType,
            paymentId,
            gatewayName,
            paidByUserAmount: request.paidByUserAmount,
            isPaidFull: true,
          });
          const stripeController = await stripePaymentToRegister.save();
          const admins = await Admin.find({});
          const property = await Property.findById(request.propertyId).select(
            "propertyName"
          );
          const propertyName = property.propertyName;

          // Prepare notification data
          const notifications = admins.map((admin) => ({
            senderId: userId,
            senderModelType: "Users",
            receiverId: admin._id,
            receiverModelType: "Admin",
            title: "MediTour Global",
            message: `Payment of ${paidByUserAmount} received for ${propertyName} with ${hotel.name} from ${user.name}.`,
            createdAt: new Date(), // Set the creation date for notifications
          }));

          await Notification.insertMany(notifications);

          admins.forEach((admin) => {
            sendchatNotification(
              admin._id,
              {
                title: "MediTour Global",
                message: `Payment of ${paidByUserAmount} received for ${propertyName} with ${hotel.name} from ${user.name}.`,
              },
              "admin"
            );
          });
        } else {
          request.gatewayName = "blinq";
        }
        await request.save();

        return res.json({ request, auth: true });
      } else {
        const booking = await BookHotel.findById(bookingId);
        if (!booking) {
          return res.status(404).json([]); // Send empty response
        }
        const hotelId = booking.hotelId;
        const userId = booking.userId;

        const hotel = await Hotel.findById(hotelId);
        const user = await User.findById(userId);
        let amount;

        let paymentDetails = {
          id: paymentId,
          status: gatewayName === "stripe" ? "completed" : "pending",
          createdAt: new Date(),
        };
        booking.paymentId.push(paymentDetails);

        const idModelType = "Hotel Booking";
        if (gatewayName != "blinq") {
          const userAmount = booking.paidByUserAmount;
          amount = paidByUserAmount;
          paidByUserAmount = userAmount + paidByUserAmount;
          booking.paidByUserAmount = paidByUserAmount;
          const userFee = booking.processingFee;
          processingFee = userFee + processingFee;
          booking.processingFee = processingFee;
          booking.isPaidFull = true;

          const stripePaymentToRegister = new stripePaymentTransaction({
            id: bookingId,
            idModelType,
            paymentId,
            gatewayName,
            paidByUserAmount: amount,
            isPaidFull: false,
          });
          const stripeController = await stripePaymentToRegister.save();
          const admins = await Admin.find({});
          const property = await Property.findById(booking.propertyId).select(
            "propertyName"
          );
          const propertyName = property.propertyName;

          // Prepare notification data
          const notifications = admins.map((admin) => ({
            senderId: userId,
            senderModelType: "Users",
            receiverId: admin._id,
            receiverModelType: "Admin",
            title: "MediTour Global",
            message: `Payment of ${paidByUserAmount} received for ${propertyName} with ${hotel.name} from ${user.name}.`,
            createdAt: new Date(), // Set the creation date for notifications
          }));

          await Notification.insertMany(notifications);

          admins.forEach((admin) => {
            sendchatNotification(
              admin._id,
              {
                title: "MediTour Global",
                message: `Payment of ${paidByUserAmount} received for ${propertyName} with ${hotel.name} from ${user.name}.`,
              },
              "admin"
            );
          });
        }
        await booking.save();

        return res.json({ booking, auth: true });
      }
    } catch (error) {
      next(error);
    }
  },

  //not in use//
  async getHotelInfo(req, res, next) {
    try {
      const { id, serviceType } = req.query;

      let hotel;

      // Determine which schema to query based on the provided identifier
      if (serviceType === "hotel") {
        hotel = await bnbInfo.findById(id);
      } else if (serviceType === "apartment") {
        hotel = await appartmentInfo.findById(id);
      } else if (serviceType === "home") {
        hotel = await homeInfo.findById(id);
      } else {
        return res.status(400).json({ error: "Invalid input parameters" });
      }

      // Check if hotel exists
      if (!hotel) {
        return res.status(404).json([]); // Send empty response
      }

      // Return the fetched hotel information
      res.status(200).json({ hotel });
    } catch (error) {
      next(error);
    }
  },
};
module.exports = travelAndTourismController;
