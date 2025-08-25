const geolib = require("geolib");
const Joi = require("joi");
const rentCar = require("../../models/Rent A Car/rentCar");
const Vehicle = require("../../models/Rent A Car/vehicle");
const VehicleRequest = require("../../models/Rent A Car/vehicleRequest");
const Admin = require("../../models/Admin/Admin"); // Import the Admin model
const AcceptedRequest = require("../../models/Rent A Car/acceptedRequests");
const stripePaymentTransaction = require("../../models/stripeTransactions");
const Notification = require("../../models/notification");
const Rating = require("../../models/rating");
const { sendchatNotification } = require("../../firebase/service");
const exchangeRateApi = require("../../utils/ExchangeRate");

const User = require("../../models/User/user");
async function getNextOrderNo() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestOrder = await AcceptedRequest.findOne({}).sort({
      createdAt: -1,
    });
    let nextOrderIdNumber = 1;
    if (latestOrder && latestOrder.orderId) {
      // Extract the numeric part of the orderId and increment it
      const currentOrderIdNumber = parseInt(latestOrder.orderId.substring(3));
      nextOrderIdNumber = currentOrderIdNumber + 1;
    }

    // Generate the next orderId
    const nextOrderId = `ORD${nextOrderIdNumber.toString().padStart(4, "0")}`;

    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}

function calculateAge(dateOfBirth) {
  // Split the date string into day, month, and year components
  const [day, month, year] = dateOfBirth.split("/");

  // Construct a date string in the format "mm/dd/yyyy" (month/day/year)
  const dob = new Date(`${month}/${day}/${year}`);

  // Get the current date
  const currentDate = new Date();

  // Calculate the difference in milliseconds between the current date and date of birth
  const ageDifferenceMs = currentDate - dob;

  // Convert the age difference from milliseconds to years
  const ageDate = new Date(ageDifferenceMs);
  const calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);

  return calculatedAge;
}

const rentACarController = {
  async getNearbyRentCars(req, res, next) {
    try {
      const userLatitude = parseFloat(req.query.lat);
      const userLongitude = parseFloat(req.query.long);
      const name = req.query.search;
      const radius = parseInt(req.query.radius) || 10000; // Default radius
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 12; // Default to 10 rent cars per page
      const filterType = req.query.filter || "all"; // Default to "all"
  
      // Base query object
      let rentACarQuery = {
        blocked: false,
        paidActivation: true,
      };
  
      if (name) {
        const regex = new RegExp(name, "i");
        rentACarQuery.name = regex; // Apply search filter
      }
  
      // Handling filterType
      if (filterType === "nearby") {
        if (!isNaN(userLatitude) && !isNaN(userLongitude)) {
          rentACarQuery.location = {
            $geoWithin: {
              $centerSphere: [[userLongitude, userLatitude], radius / 6378137], // Convert radius to radians
            },
          };
        } else {
          return res.status(400).json({ error: "Invalid latitude or longitude" });
        }
      } else if (filterType !== "all") {
        // Return error if an unsupported filter type is provided
        return res.status(400).json({ error: "Invalid filter type" });
      }
  
      // Count total results for pagination
      const totalLabs = await rentCar.countDocuments(rentACarQuery); // Get total count
      const totalPages = Math.ceil(totalLabs / limit); // Calculate total pages
      const skip = (page - 1) * limit; // Calculate skip value
  
      // Fetch rent cars with pagination
      let rentACars = await rentCar.find(rentACarQuery).skip(skip).limit(limit);
      
      const modifiedRentCars = rentACars.map((rentACar) => {
        const longitude = rentACar.location.lng;
        const latitude = rentACar.location.lat;
        const rentCarCoordinates = {
          latitude,
          longitude,
        };
  
        // Calculate distance
        const distanceInMeters = geolib.getDistance(
          { latitude: userLatitude, longitude: userLongitude },
          rentCarCoordinates
        );
        const distanceInKilometers = distanceInMeters / 1000; // Convert to kilometers
        return {
          rentACar,
          distance: distanceInKilometers,
        };
      });
  
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;
  
      return res.status(200).json({
        rentACars: modifiedRentCars,
        nextPage,
        previousPage,
        totalRentACars:totalLabs,
        totalPages: totalPages,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },

  async rentACarDetail(req, res, next) {
    try {
      const rentACarId = req.query.id;
      const userId = req.user._id; // Assuming you have the user ID from the authenticated user
      const name = req.query.name;

      const rentACar = await rentCar.findById(rentACarId);
      const rating = await Rating.find({ vendorId: rentACarId });
      let ratingCount = rating.length > 0 ? rating[0].ratings.length : 0;

      let vehicleName;
      let query = { rentACarId };

      if (name || name === "") {
        const regex = new RegExp(name, "i");
        vehicleName = regex;
        query.vehicleName = vehicleName;
      }

      const topRentalVehicles = await Vehicle.find(query).sort({
        timesBooked: -1,
      });
      const allVehicles = await Vehicle.find(query);
      // Add a key to indicate if the user has requested this vehicle
      const updatedTopRentalVehicles = await Promise.all(
        topRentalVehicles.map(async (vehicle) => {
          const vehicleRequests = await AcceptedRequest.find({
            vehicleId: vehicle._id,
            userId: userId,
          });

          // Initialize requestSent to true, assuming no pending or onRoute requests
          let requestSent = false;

          // Check each request's status
          for (const request of vehicleRequests) {
            if (request.status === "pending" || request.status === "OnRoute") {
              requestSent = true; // Set to false if any request is pending or OnRoute
              break; // Exit the loop early since we found a pending request
            } else if (request.status === "completed") {
              requestSent = false; // Keep it true if at least one request is completed
            }
          }

          // If no requests were found, requestSent remains true
          if (vehicleRequests.length === 0) {
            requestSent = false;
          }
          return {
            ...vehicle._doc, // Spread the vehicle object to retain all other properties
            requestSent, // Add the requestSent key
          };
        })
      );
      const updatedAllVehicles = await Promise.all(
        allVehicles.map(async (vehicle) => {
          const vehicleRequests = await AcceptedRequest.find({
            vehicleId: vehicle._id,
            userId: userId,
          });

          // Initialize requestSent to true, assuming no pending or onRoute requests
          let requestSent = false;

          // Check each request's status
          for (const request of vehicleRequests) {
            if (request.status === "pending" || request.status === "OnRoute") {
              requestSent = true; // Set to false if any request is pending or OnRoute
              break; // Exit the loop early since we found a pending request
            } else if (request.status === "completed") {
              requestSent = false; // Keep it true if at least one request is completed
            }
          }

          // If no requests were found, requestSent remains true
          if (vehicleRequests.length === 0) {
            requestSent = false;
          }

          return {
            ...vehicle._doc, // Spread the vehicle object to retain all other properties
            requestSent, // Add the requestSent key
          };
        })
      );

      return res.status(200).json({
        rentACar,
        ratingCount,
        topRentalVehicles: updatedTopRentalVehicles,
        allVehicles: updatedAllVehicles,
      });
    } catch (error) {
      return next(error);
    }
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

  async sendVehicleBooking(req, res, next) {
    try {
      const userId = req.user._id;
      let {
        paymentId,
        paidByUserAmount,
        vehicleId,
        rentACarId,
        name,
        phone,
        age,
        pickupLocation,
        pickupDateTime,
        dropoffLocation,
        dropoffDateTime,
        cnic,
        vehicleModel,
        totalAmount,
        withDriver,
        processingFee,
        isPaidFull,
        gatewayName,
        remainingAmount
      } = req.body;

      const rentCarModel = await rentCar.findById(rentACarId);
      if (!name && !phone && !age) {
        const user = await User.findById(req.user._id);
        const userAge = calculateAge(user.dateOfBirth);
        name = user.name;
        phone = user.phone;
        age = userAge;
      }

      const user = await User.findById(userId);
      const orderId = await getNextOrderNo();

      let paymentIdArray = [];

      if (gatewayName === "stripe") {
        paymentIdArray.push({
          id: paymentId,
          status: "completed",
          createdAt: new Date(),
        });
      } else if (gatewayName === "blinq") {
        paymentIdArray.push({
          id: paymentId,
          status: "pending",
          createdAt: new Date(),
        });
      }
      const dollarAmount = await exchangeRateApi(totalAmount);
       // Round off paidByUserAmount before saving
       paidByUserAmount = Math.round(paidByUserAmount);
      // Create a new vehicle request object
      const newBooking = new AcceptedRequest({
        orderId,
        paymentId: paymentIdArray,
        paidByUserAmount,
        vehicleId,
        rentACarId,
        userId,
        name,
        phone,
        age,
        pickupLocation,
        pickupDateTime,
        dropoffLocation,
        dropoffDateTime,
        cnic,
        vehicleModel,
        totalAmount,
        dollarAmount,
        withDriver,
        isPaidFull,
        processingFee,
        gatewayName,
        remainingAmount
      });

      // Save the new vehicle request to the database
      const savedRequest = await newBooking.save();
      if (gatewayName !== "blinq") {
        const stripePaymentToRegister = new stripePaymentTransaction({
          id: savedRequest._id,
          idModelType: "Accepted Vehicle Request",
          paymentId,
          gatewayName,
          paidByUserAmount,
          isPaidFull,
        });

        await stripePaymentToRegister.save();

        const vehicle = await Vehicle.findById(vehicleId);
        vehicle.timesBooked += 1;
        await vehicle.save();

        // Notification to the user
        sendchatNotification(
          userId,
          {
            title: "MediTour Global",
            message: `Your booking for a ${rentCarModel.name} has been confirmed.`,
          },
          "user"
        );

        const userNotification = new Notification({
          senderId: userId,
          senderModelType: "Users",
          receiverId: userId,
          receiverModelType: "Users",
          title: "MediTour Global",
          message: `Your booking for a ${rentCarModel.name} has been confirmed.`,
        });

        await userNotification.save();

        const rentCarNotifications =  new Notification({
          senderId: userId,
          senderModelType: "Users",
          receiverId: rentCarModel,
          receiverModelType: "Rent A Car",
          title: "MediTour Global",
          message: `${name} paid ${paidByUserAmount} for ${rentCarModel.name}.`,
        });
        await rentCarNotifications.save();

      }

      // Respond with the saved request object
      res.status(201).json({
        message: `Your booking for a ${rentCarModel.name} has been confirmed`,
        request: savedRequest,
      });
    } catch (error) {
      next(error);
    }
  },

  async timeClash(req, res, next) {
    try {
      let { vehicleId, pickupDateTime, dropoffDateTime } = req.body;
      const overlappingRequest = await AcceptedRequest.findOne({
        vehicleId: vehicleId,
        $or: [
          {
            $and: [
              { pickupDateTime: { $lt: dropoffDateTime } }, // New pickup time is before existing dropoff time
              { dropoffDateTime: { $gt: pickupDateTime } }, // New dropoff time is after existing pickup time
            ],
          },
        ],
      });

      if (overlappingRequest) {
        return res.status(400).json({
          message:
            "The vehicle is already rented during the specified time period.",
          auth: false,
        });
      } else {
        return res.json({
          message:
            "The vehicle is not rented during the specified time period.",
          auth: true,
        });
      }
    } catch (error) {
      next(error);
    }
  },
  async rentCarRemainingPayment(req, res, next) {
    try {
      const acceptedRequestId = req.query.acceptedRequestId;
      let { paymentId, paidByUserAmount, processingFee, gatewayName } =
        req.body;
      const booking = await AcceptedRequest.findById(acceptedRequestId);

      if (!booking) {
        return res.status(404).json([]); // Send empty response
      }
      booking.isPaidFull = true;
      const paymentIdArray = [];
      if (gatewayName === "stripe") {
        paymentIdArray.push({
          id: paymentId,
          status: "completed",
          createdAt: new Date(),
        });
      } else if (gatewayName === "blinq") {
        paymentIdArray.push({
          id: paymentId,
          status: "pending",
          createdAt: new Date(),
        });
      }
      booking.paymentId.push(paymentIdArray[0]);
      if (gatewayName !== "blinq") {
        const userAmount = booking.paidByUserAmount;
        paidByUserAmount = userAmount + paidByUserAmount;
        booking.paidByUserAmount = paidByUserAmount;
        const userFee = booking.processingFee;
        processingFee = userFee + processingFee;
        booking.processingFee = processingFee;
        const idModelType = "Accepted Vehicle Request";
        const stripePaymentToRegister = new stripePaymentTransaction({
          id: booking._id,
          idModelType,
          paymentId,
          gatewayName,
          paidByUserAmount,
          isPaidFull: false,
        });
        stripeController = await stripePaymentToRegister.save();
      }
      await booking.save();
      return res
        .status(200)
        .json({ booking, message: "Payment Added Successfully" });
    } catch (error) {
      return next(error);
    }
  },

  async addRemoveFavCars(req, res, next) {
    try {
      const rentACarId = req.query.rentACarId;
      const userId = req.user._id;

      const rentACar = await rentCar.findById(rentACarId);
      if (!rentACar) {
        return res.status(404).json([]); // Send empty response
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json([]); // Send empty response
      }

      const alreadyExistsIndex = user.favouriteRentACars.indexOf(rentACarId);

      if (alreadyExistsIndex !== -1) {
        // If rentACarId is found in the favourites array, remove it using the pull operator
        user.favouriteRentACars.pull(rentACarId);
      } else {
        // If labId is not found, add it to the favourites array
        user.favouriteRentACars.push(rentACarId);
      }

      // Save the updated user document
      await user.save();

      return res.status(200).json({ user });
    } catch (error) {
      return next(error);
    }
  },
  async getAllfavouriteRentACars(req, res, next) {
    try {
      const userId = req.user._id;

      const user = await User.findOne({ _id: userId }).populate(
        "favouriteRentACars"
      );
      if (!user) {
        return res.status(404).json([]); // Send empty response
      }
      const favourites = user.favouriteRentACars;
      // Save the updated user document
      await user.save();

      return res.status(200).json({ favouriteRentACars: favourites });
    } catch (error) {
      return next(error);
    }
  },

  async cancelRequest(req, res, next) {
    try {
      const requestId = req.query.requestId;
      const userId = req.user._id;

      // Find the vehicle request by ID and user ID
      const acceptedRequest = await AcceptedRequest.findOne({
        _id: requestId,
        userId: userId,
      });

      if (!acceptedRequest) {
        return res.status(404).json([]); // Send empty response
      }

      // Check if the status is pending
      if (acceptedRequest.status !== "pending") {
        return res
          .status(400)
          .json({ error: "Only pending requests can be cancelled" });
      }

      // Update the status to "cancelled"
      acceptedRequest.status = "cancelled";
      await acceptedRequest.save();

      return res
        .status(200)
        .json({ message: "Request cancelled successfully" });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = rentACarController;
