const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Joi = require("joi");
const Pharmacy = require("../../models/Pharmacy/pharmacy");
const stripePaymentTransaction = require("../../models/stripeTransactions");
const Pharmaceutical = require("../../models/Pharmaceutical/pharmaceutical");
const Order = require("../../models/order");
const PharmacyCart = require("../../models/User/cart");
const geolib = require("geolib");
const Admin = require("../../models/Admin/Admin"); // Import the Admin model
const Medicine = require("../../models/Pharmaceutical/medicine");
const Notification = require("../../models/notification");
const User = require("../../models/User/user");
const MedicineRequest = require("../../models/Pharmacy/medicineRequest");
const BidRequest = require("../../models/Pharmacy/bid");
const { sendchatNotification } = require("../../firebase/service");
const pharmacy = require("../../models/Pharmacy/pharmacy");
const user = require("../../models/User/user");

async function getNextOrderNo() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestOrder = await Order.findOne({}).sort({ createdAt: -1 });

    let nextOrderIdNumber = 1;
    if (latestOrder && latestOrder.orderId) {
      // Extract the numeric part of the orderId and increment it
      const currentOrderIdNumber = parseInt(latestOrder.orderId.substring(3));
      nextOrderIdNumber = currentOrderIdNumber + 1;
    }
    // Generate the next orderId
    const nextOrderId = `PHR${nextOrderIdNumber.toString().padStart(4, "0")}`;

    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}

const userPharmacyController = {
  async getNearbyPharmacies(req, res, next) {
    try {
      // Extract and parse query parameters
      const latitude = parseFloat(req.query.lat);
      const longitude = parseFloat(req.query.long);
      const radius = parseInt(req.query.radius) || 10000; // Default to 10,000 meters
      const name = req.query.search; // Search by name
      const city = req.query.city; // Filter by city
      const country = req.query.country;
      const filterTypes = req.query.filter
        ? req.query.filter.split(",")
        : ["all"]; // Allow multiple filters
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = 28; // Default to 28 pharmacies per page

      // Initialize the base query object
      let pharmacyQuery = {
        blocked: false,
        paidActivation: true,
        $or: [
          // Include individual pharmacies (no hospitalIds, regardless of isActive)
          { hospitalIds: { $exists: false } },
          { hospitalIds: { $size: 0 } },
          // Include hospital-linked pharmacies where isActive is true
          { isActive: true },
        ],
      };

      // Apply search query if provided
      if (name) {
        const regex = new RegExp(name, "i"); // Case-insensitive regex
        pharmacyQuery.name = regex;
      }

      // Handle multiple filters
      if (filterTypes.includes("recommended")) {
        pharmacyQuery.isRecommended = true; // Filter by recommended status
      }
      if (filterTypes.includes("country")) {
        pharmacyQuery.country = country;
      }
      if (filterTypes.includes("city") && city) {
        pharmacyQuery["location.city"] = city.trim(); // Filter by city
      }

      if (filterTypes.includes("nearby")) {
        if (!isNaN(latitude) && !isNaN(longitude)) {
          pharmacyQuery.location = {
            $geoWithin: {
              $centerSphere: [[longitude, latitude], radius / 6378137], // Radius in radians
            },
          };
        } else {
          return res
            .status(400)
            .json({ error: "Invalid latitude or longitude for nearby filter" });
        }
      }

      // Count total pharmacies for pagination
      const totalPharmacies = await Pharmacy.countDocuments(pharmacyQuery);
      const totalPages = Math.ceil(totalPharmacies / limit);
      const skip = (page - 1) * limit;

      // Fetch pharmacies with pagination
      let pharmaciesQuery = Pharmacy.find(pharmacyQuery)
        .skip(skip)
        .limit(limit);

      // Sorting logic based on the filter type
      if (filterTypes.includes("all") || filterTypes.includes("city")) {
        pharmaciesQuery = pharmaciesQuery.sort({
          isRecommended: -1, // Recommended first
          averageRating: -1, // Sort by rating within each group
        });
      } else if (filterTypes.includes("recommended")) {
        pharmaciesQuery = pharmaciesQuery.sort({ averageRating: -1 }); // Sort only by rating
      }

      const pharmacies = await pharmaciesQuery.exec();

      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Convert averageRating to a plain number
      pharmacies.forEach((pharmacy) => {
        if (pharmacy.averageRating && pharmacy.averageRating.$numberDecimal) {
          pharmacy.averageRating = parseFloat(
            pharmacy.averageRating.$numberDecimal
          );
        }
      });

      return res.status(200).json({
        pharmacies,
        previousPage,
        nextPage,
        totalPages,
        totalPharmacies,
        auth: true,
      });
    } catch (error) {
      return next(error);
    }
  },
  async filterPharmacies(req, res, next) {
    try {
      const minRating = parseFloat(req.query.minRating) || 0;
      const longitude = parseFloat(req.query.long);
      const latitude = parseFloat(req.query.lat);
      const radius = parseInt(req.query.radius) || 1000000; // Default radius in meters
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 10; // Default to 10 pharmacies per page

      // Find pharmacies within the specified radius
      const pharmaciesWithinRadius = await Pharmacy.find({
        location: {
          $geoWithin: {
            $centerSphere: [[longitude, latitude], radius / 6378.1], // Convert radius from meters to radians
          },
        },
      });

      // Get IDs of pharmacies within the radius
      const pharmacyIdsWithinRadius = pharmaciesWithinRadius.map(
        (pharmacy) => pharmacy._id
      );

      // Count total number of pharmacies with the given filters
      const totalPharmacies = await Pharmacy.countDocuments({
        _id: { $in: pharmacyIdsWithinRadius },
        averageRating: { $gte: minRating },
        paidActivation: true,
      });

      // Calculate total pages
      const totalPages = Math.ceil(totalPharmacies / limit);

      // Calculate the number of pharmacies to skip based on the current page
      const skip = (page - 1) * limit;

      // Fetch the filtered pharmacies with pagination
      const pharmacies = await Pharmacy.find({
        _id: { $in: pharmacyIdsWithinRadius },
        averageRating: { $gte: minRating },
        paidActivation: true,
      })
        .skip(skip)
        .limit(limit);

      // Determine previous and next page numbers
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Return the paginated list of pharmacies with pagination details
      res.status(200).json({
        pharmacies,
        currentPage: page,
        totalPages,
        previousPage,
        nextPage,
        totalPharmacies,
      });
    } catch (error) {
      next(error);
    }
  },
  async getPharmacy(req, res, next) {
    try {
      const pharmacyId = req.query.pharmacyId;
      const userLatitude = req.query.lat;
      const userLongitude = req.query.long;
      const pharmacy = await Pharmacy.findById(pharmacyId);

      if (!pharmacy) {
        return res.status(404).json([]); // Send empty response
      }
      const pharmacyCoordinates = {
        latitude: pharmacy.location.lat,
        longitude: pharmacy.location.lng,
      };
      const distance = geolib.getDistance(
        { latitude: userLatitude, longitude: userLongitude },
        pharmacyCoordinates
      );

      return res.status(200).json({ pharmacy, distance });
    } catch (error) {
      return next(error);
    }
  },

  async addToCart(req, res, next) {
    try {
      const userId = req.user._id; // Replace with your authentication logic to get the user ID
      const medicineIdToAdd = req.body.medicineId;
      const quantityToAdd = req.body.quantity || 1; // Default quantity is 1 if not specified

      // Use findOneAndUpdate to add the medicine to the cart
      const updatedCart = await PharmacyCart.findOneAndUpdate(
        { userId },
        {
          $addToSet: {
            cartItems: { medicineId: medicineIdToAdd, quantity: quantityToAdd },
          },
        },
        { upsert: true, new: true }
      );

      // Return the updated cart as a response
      return res.status(200).json({ cart: updatedCart });
    } catch (error) {
      return next(error);
    }
  },
  async getCart(req, res, next) {
    try {
      const userId = req.user._id; // Replace with your authentication logic to get the user ID
      const cart = await PharmacyCart.findOne({ userId });
      if (!cart) {
        return res.status(404).json([]); // Send empty response
      }

      // Return the updated cart as a response
      return res.status(200).json({ cart, auth: true });
    } catch (error) {
      return next(error);
    }
  },

  async getAllMeds(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const medPerPage = 5;
      const pharmaceuticalId = req.query.pharmaceuticalId;

      // Build the filter object
      const filter = pharmaceuticalId
        ? { pharmaceuticalId: new mongoose.Types.ObjectId(pharmaceuticalId) }
        : {};

      // Aggregation for total count
      const countAggregation = await Medicine.aggregate([
        {
          $lookup: {
            from: "pharmaceuticals",
            localField: "pharmaceuticalId",
            foreignField: "_id",
            as: "pharmaceuticalDetails",
          },
        },
        {
          $unwind: "$pharmaceuticalDetails",
        },
        {
          $match: {
            $and: [
              { "pharmaceuticalDetails.paidActivation": true },
              { "pharmaceuticalDetails.blocked": false },
              filter, // Add your pharmaceuticalId filter if provided
            ],
          },
        },
        {
          $count: "totalMeds",
        },
      ]);

      const totalMeds =
        countAggregation.length > 0 ? countAggregation[0].totalMeds : 0;

      const totalPages = Math.ceil(totalMeds / medPerPage); // Calculate total pages
      const skip = (page - 1) * medPerPage; // Calculate skip

      // Fetch medicines with pagination
      const medicines = await Medicine.aggregate([
        {
          $lookup: {
            from: "pharmaceuticals",
            localField: "pharmaceuticalId",
            foreignField: "_id",
            as: "pharmaceuticalDetails",
          },
        },
        {
          $unwind: "$pharmaceuticalDetails",
        },
        {
          $match: {
            $and: [
              { "pharmaceuticalDetails.paidActivation": true },
              { "pharmaceuticalDetails.blocked": false },
              filter,
            ],
          },
        },
        { $skip: skip },
        { $limit: medPerPage },
      ]);

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        medicines,
        auth: true,
        totalMeds,
        totalPages,
        previousPage,
        nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },

  async addPharmacyOrder(req, res, next) {
    try {
      const orderSchema = Joi.object({
        vendorId: Joi.string().required(),
        paymentId: Joi.string().required(),
        paidByUserAmount: Joi.number().required(),
        items: Joi.array().required(),
        preference: Joi.string().valid("visit", "homeSample"),
        currentLocation: Joi.object().required(),
        prescription: Joi.string(),
        customerName: Joi.string().required(),
        MR_NO: Joi.string().required(),
        processingFee: Joi.number().required(),
        gatewayName: Joi.string().required(),
      });
      // Validate the request body
      const { error } = orderSchema.validate(req.body);
      if (error) {
        return next(error);
      }
      const userId = req.user._id;
      const {
        paymentId,
        paidByUserAmount,
        vendorId,
        items,
        preference,
        currentLocation,
        prescription,
        customerName,
        MR_NO,
        processingFee,
        gatewayName,
      } = req.body;
      // Fetch user and vendor details
      const user = await User.findById(userId);
      const pharmacy = await Pharmacy.findById(vendorId); // Assuming Pharmacy model

      if (!user || !pharmacy) {
        return res.status(400).json({
          success: false,
          message: "User or Pharmacy not found",
        });
      }

      const orderId = await getNextOrderNo();
      let order;
      let stripePayment;
      const itemIds = items.map((item) => item.itemId);
      const medicines = await Medicine.find({ _id: { $in: itemIds } });

      // Calculate totals
      const grandTotal = items.reduce((sum, item) => {
        const test = medicines.find(
          (test) => test._id.toString() === item.itemId
        );
        return sum + parseFloat(test.actualPrice) * item.quantity;
      }, 0);

      const discount = items.reduce((sum, item) => {
        const test = medicines.find(
          (test) => test._id.toString() === item.itemId
        );
        return sum + parseFloat(test.discount) * item.quantity;
      }, 0);

      const totalAmount = grandTotal - discount;
      try {
        const orderToRegister = new Order({
          orderId,
          paymentId,
          paidByUserAmount,
          userId,
          vendorId,
          vendorModelType: "Pharmacy",
          items,
          itemModelType: "Medicine",
          preference,
          currentLocation,
          prescription,
          customerName,
          MR_NO,
          totalAmount,
          discount,
          grandTotal,
          processingFee,
        });

        order = await orderToRegister.save();
        const stripePaymentToRegister = new stripePaymentTransaction({
          id: order._id,
          idModelType: "Order",
          paymentId,
          gatewayName,
          paidByUserAmount,
          isPaidFull: true,
        });
        stripePayment = await stripePaymentToRegister.save();
        if (order) {
          sendchatNotification(
            vendorId,
            {
              title: "MediTour Global",
              message: `You have a new order.`,
            },
            "pharmacy"
          );
          const notification = new Notification({
            senderId: userId,
            senderModelType: "Users",
            receiverId: vendorId,
            title: "MediTour Global",
            message: "You have a new order",
          });
          await notification.save();
          // Notify admins
          const admins = await Admin.find(); // Adjust this to match your admin retrieval logic

          const adminNotifications = admins.map((admin) => ({
            senderId: userId,
            senderModelType: "Users",
            receiverId: admin._id,
            receiverModelType: "Admin",
            title: "MediTour Global",
            message: `${user.name} paid ${paidByUserAmount} for ${pharmacy.name} `,
          }));

          await Notification.insertMany(adminNotifications);

          admins.forEach((admin) => {
            sendchatNotification(
              admin._id,
              {
                title: "MediTour Global",
                message: `${user.name} paid ${paidByUserAmount} for ${pharmacy.name} `,
              },
              "admin"
            );
          });
        }
      } catch (error) {
        return next(error);
      }

      return res.status(201).json(order);
    } catch (error) {
      return next(error);
    }
  },

  async addRemoveFavPharmacy(req, res, next) {
    try {
      const pharmacyId = req.query.pharmacyId;
      const userId = req.user._id;

      const pharmacy = await Pharmacy.findById(pharmacyId);
      if (!pharmacy) {
        return res.status(404).json([]); // Send empty response
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json([]); // Send empty response
      }

      const alreadyExistsIndex = user.favouritePharmacies.indexOf(pharmacyId);

      if (alreadyExistsIndex !== -1) {
        // If PharmacyID is found in the favourites array, remove it using the pull operator
        user.favouritePharmacies.pull(pharmacyId);
      } else {
        // If labId is not found, add it to the favourites array
        user.favouritePharmacies.push(pharmacyId);
      }

      // Save the updated user document
      await user.save();

      return res.status(200).json({ user });
    } catch (error) {
      return next(error);
    }
  },
  async getAllFavPharmacies(req, res, next) {
    try {
      const userId = req.user._id;

      const user = await User.findOne({ _id: userId }).populate(
        "favouritePharmacies"
      );
      if (!user) {
        return res.status(404).json([]); // Send empty response);
      }
      const favourites = user.favouritePharmacies;
      // Save the updated user document
      await user.save();

      return res.status(200).json({ favouritePharmacies: favourites });
    } catch (error) {
      return next(error);
    }
  },
  async getMedicineRequests(req, res, next) {
    try {
      const patientId = req.user._id;
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = 10;

      const totalRequests = await MedicineRequest.countDocuments({
        status: "pending",
        patientId,
      }); // Get the total number of requests for the user

      const totalPages = Math.ceil(totalRequests / requestsPerPage); // Calculate the total number of pages

      const skip = (page - 1) * requestsPerPage; // Calculate the number of requests to skip based on the current page
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      const allRequests = await MedicineRequest.find({
        status: "pending",
        patientId,
      })
        .sort({ createdAt: -1 }) // Sort by createdAt field in descending order
        .populate("medicineIds.id patientId")
        .populate({
          path: "bidIds", // Populate bidIds array
          model: "PharmacyBid", // Reference to the Bid Request model
        })
        .skip(skip)
        .limit(requestsPerPage)
        .lean(); // Convert documents to plain JavaScript objects
      return res.status(200).json({
        medicineRequests: allRequests,
        previousPage: previousPage,
        totalPages: totalPages,
        nextPage: nextPage,
        auth: true,
      });
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },
  async getMedicineRequest(req, res, next) {
    try {
      const id = req.query.id;
      const request = await MedicineRequest.findById(id).populate(
        "medicineIds.id doctorId"
      );

      return res.status(200).json({
        medicineRequest: request,
        auth: true,
      });
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },
};

module.exports = userPharmacyController;
