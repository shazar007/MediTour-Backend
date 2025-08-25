const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Joi = require("joi");
const geolib = require("geolib");
const Laboratory = require("../../models/Laboratory/laboratory");
const stripePaymentTransaction = require("../../models/stripeTransactions");
const User = require("../../models/User/user");
const Tests = require("../../models/Laboratory/tests");
const Order = require("../../models/order");
const Rating = require("../../models/rating");
const Notification = require("../../models/notification");
const Appointment = require("../../models/All Doctors Models/appointment");
const Admin = require("../../models/Admin/Admin"); // Import the Admin model
const moment = require("moment");
const { sendchatNotification } = require("../../firebase/service");
const Pharmacy = require("../../models/Pharmacy/pharmacy");
const Doctor = require("../../models/Doctor/doctors");
const Ambulance = require("../../models/Ambulance/ambulanceCompany");
const Hospital = require("../../models/Hospital/hospital");
const Insurance = require("../../models/Insurance/insurance");
const RentCar = require("../../models/Rent A Car/rentCar");
const TravelAgency = require("../../models/Travel Agency/travelAgency");
const Hotel = require("../../models/Hotel/hotel");
const TestName = require("../../models/Laboratory/testName");
const Donation = require("../../models/Donation/donationCompany");
const Booking = require("../../models/Pharmacy/booking");
const MedRequest = require("../../models/Pharmacy/medicineRequest");
const ePrescription = require("../../models/All Doctors Models/ePrescription");
const laboratory = require("../../models/Laboratory/laboratory");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const Test = require("../../models/Laboratory/tests");
const exchangeRateApi = require("../../utils/ExchangeRate");
const axios = require("axios");
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
    const nextOrderId = `LAB${nextOrderIdNumber.toString().padStart(4, "0")}`;
    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}

async function getNextRequestNo() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestOrder = await MedRequest.findOne({}).sort({
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

const userLabController = {
  async getNearbyLabs(req, res, next) {
    try {
      // Extract and parse query parameters
      const latitude = parseFloat(req.query.lat);
      const longitude = parseFloat(req.query.long);
      const searchValue = req.query.search;
      const country = req.query.country;
      const radius = parseInt(req.query.radius) || 10000; // Default to 10,000 meters
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 12; // Default to 12 labs per page
      const city = req.query.city;
      const filterTypes = req.query.filter
        ? req.query.filter.split(",")
        : ["all"]; // Allow multiple filters

      // Initialize the base query object
      let labQuery = {
        blocked: false,
        paidActivation: true,
        // "tests.0": { $exists: true }, // Ensure the lab has at least one test
        $or: [
          // Include individual labs (no hospitalIds, regardless of isActive)
          { hospitalIds: { $exists: false } },
          { hospitalIds: { $size: 0 } },
          // Include hospital-linked labs where isActive is true
          { isActive: true },
        ],
      };

      // Add search query if searchValue is provided
      if (searchValue) {
        const regex = new RegExp(searchValue, "i"); // Case-insensitive regex
        labQuery.name = regex;
      }

      // Handle multiple filters
      if (filterTypes.includes("recommended")) {
        labQuery.isRecommended = true;
      }
      if (filterTypes.includes("country")) {
        labQuery.country = country;
      }
      if (filterTypes.includes("city") && city) {
        labQuery["location.city"] = city.trim();
      }

      // Handle nearby filter separately (geospatial query)
      if (filterTypes.includes("nearby")) {
        if (!isNaN(latitude) && !isNaN(longitude)) {
          labQuery.location = {
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

      // Count total labs for pagination
      const totalLabs = await Laboratory.countDocuments(labQuery);
      const totalPages = Math.ceil(totalLabs / limit);
      const skip = (page - 1) * limit;

      // Fetch labs with pagination
      let labsQuery = Laboratory.find(labQuery).skip(skip).limit(limit);

      // Sorting logic based on the filter type
      if (filterTypes.includes("all") || filterTypes.includes("city")) {
        labsQuery = labsQuery.sort({
          isRecommended: -1, // Recommended first
          averageRating: -1, // Sort by rating within each group
        });
      } else if (filterTypes.includes("recommended")) {
        labsQuery = labsQuery.sort({ averageRating: -1 }); // Sort only by rating
      }

      const labs = await labsQuery.exec();

      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Convert averageRating to a plain number
      labs.forEach((lab) => {
        if (lab.averageRating && lab.averageRating.$numberDecimal) {
          lab.averageRating = parseFloat(lab.averageRating.$numberDecimal);
        }
      });

      return res.status(200).json({
        labs,
        totalDocs: totalLabs,
        previousPage,
        nextPage,
        auth: true,
      });
    } catch (error) {
      // Handle any errors that occur during the request
      return next(error);
    }
  },
  async filterLabs(req, res, next) {
    try {
      const minRating = parseFloat(req.query.minRating) || 0;
      const longitude = parseFloat(req.query.long);
      const latitude = parseFloat(req.query.lat);
      const radius = parseInt(req.query.radius) || 1000000; // Default to 1,000,000 meters (1000 km)
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 10; // Default to 10 labs per page

      // Find labs within the specified radius
      const labsWithinRadius = await Laboratory.find({
        location: {
          $geoWithin: {
            $centerSphere: [[longitude, latitude], radius / 6378.1], // Convert radius from meters to radians
          },
        },
      });

      // Get IDs of labs within the radius
      const labIdsWithinRadius = labsWithinRadius.map((lab) => lab._id);

      // Count the total number of labs within the radius
      const totalLabs = await Laboratory.countDocuments({
        _id: { $in: labIdsWithinRadius },
        averageRating: { $gte: minRating },
        paidActivation: true,
      });

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalLabs / limit);

      // Calculate how many labs to skip based on the current page
      const skip = (page - 1) * limit;

      // Fetch labs based on the filters, skipping and limiting results
      const labs = await Laboratory.find({
        _id: { $in: labIdsWithinRadius },
        averageRating: { $gte: minRating },
        paidActivation: true,
      })
        .skip(skip)
        .limit(limit);

      // Determine previous and next page numbers
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Return the paginated labs with pagination details
      res.status(200).json({
        labs,
        currentPage: page,
        totalPages,
        previousPage,
        nextPage,
        totalLabs,
      });
    } catch (error) {
      next(error);
    }
  },

  async getLab(req, res, next) {
    try {
      const labId = req.query.labId;
      const userLatitude = req.query.lat;
      const userLongitude = req.query.long;

      const lab = await Laboratory.findById(labId);

      if (!lab) {
        return res.status(404).json([]); // Send empty response
      }
      // Calculate the distance between user and lab using Haversine formula
      const response = { lab };
      if (userLatitude && userLongitude) {
        const labCoordinates = {
          latitude: lab.location.lat,
          longitude: lab.location.lng,
        };
        const distance = geolib.getDistance(
          { latitude: userLatitude, longitude: userLongitude },
          labCoordinates
        );
        response.distance = distance;
      }

      // Distance will be in meters, you can convert it to other units if needed

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  },

  async getAllTests(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const testPerPage = 10;
      const testName = req.query.testName; // Use testName from the query parameter
      const labId = req.query.labId; // Use labId from the query parameter

      if (!labId) {
        return res.status(400).json({
          status: 400,
          message: "LabId is required",
        });
      }

      const testNameRegex = new RegExp(testName, "i");
      // Find TestNames matching the categoryName
      const testNames = await TestName.find({
        name: { $regex: testNameRegex },
      });

      // if (testNames.length === 0) {
      //   return res.status(404).json([]); // Send empty response
      // }

      const testNameIds = testNames.map((testName) => testName._id);

      // Get the total number of tests for the test names and labId
      const totalTests = await Tests.countDocuments({
        testNameId: { $in: testNameIds },
        labId: labId, // Filter by labId
      });
      console.log("totaltests", totalTests);

      const totalPages = Math.ceil(totalTests / testPerPage); // Calculate the total number of pages
      const skip = (page - 1) * testPerPage; // Calculate the number of tests to skip based on the current page

      // Fetch the tests based on testNameId and labId
      const tests = await Tests.find({
        testNameId: { $in: testNameIds },
        labId: labId, // Filter by labId
      })
        .populate({
          path: "testNameId",
          select: "name categoryName", // Include name and categoryName in the population
        })
        .sort({ createdAt: -1 }) // Sort by createdAt field in descending order
        .skip(skip)
        .limit(testPerPage);

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        tests: tests,
        auth: true,
        totalTests,
        previousPage: previousPage,
        totalPages: totalPages,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
  async addRemoveFav(req, res, next) {
    try {
      const labId = req.query.labId;
      const userId = req.user._id;

      const laboratory = await Laboratory.findById(labId);
      if (!laboratory) {
        return res.status(404).json([]); // Send empty response
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json([]); // Send empty response
      }

      const alreadyExistsIndex = user.favouriteLabs.indexOf(labId);

      if (alreadyExistsIndex !== -1) {
        // If labId is found in the favourites array, remove it using the pull operator
        user.favouriteLabs.pull(labId);
      } else {
        // If labId is not found, add it to the favourites array
        user.favouriteLabs.push(labId);
      }

      // Save the updated user document
      await user.save();

      return res.status(200).json({ user });
    } catch (error) {
      return next(error);
    }
  },

  async getAllFav(req, res, next) {
    try {
      const userId = req.user._id;

      const user = await User.findOne({ _id: userId }).populate(
        "favouriteLabs"
      );
      if (!user) {
        return res.status(404).json([]); // Send empty response
      }
      const favourites = user.favouriteLabs;
      // Save the updated user document
      await user.save();

      return res.status(200).json({ favouriteLabs: favourites });
    } catch (error) {
      return next(error);
    }
  },

  async addLabOrder(req, res, next) {
    try {
      const orderSchema = Joi.object({
        vendorId: Joi.string().required(),
        paymentId: Joi.string().required(),
        paidByUserAmount: Joi.number(),
        items: Joi.array().required(),
        preference: Joi.string().valid("visit", "homeSample").required(),
        currentLocation: Joi.object().allow(""),
        prescription: Joi.string().allow(""),
        customerName: Joi.string().required(),
        MR_NO: Joi.string().required(),
        processingFee: Joi.number(),
        gatewayName: Joi.string().required(),
      });

      // Validate the request body
      const { error } = orderSchema.validate(req.body);
      if (error) {
        return next(error);
      }

      const userId = req.user._id;
      const {
        vendorId,
        items,
        preference,
        currentLocation,
        prescription,
        customerName,
        MR_NO,
        paymentId,
        paidByUserAmount,
        processingFee,
        gatewayName,
      } = req.body;
      // Fetch user and vendor details
      const user = await User.findById(userId);
      const lab = await Laboratory.findById(vendorId); // Assuming Laboratory model
      const orderId = await getNextOrderNo();
      let order;
      let stripeController;
      const itemIds = items.map((item) => item.itemId);
      const tests = await Test.find({ _id: { $in: itemIds } });

      // Calculate totals
      const grandTotal = items.reduce((sum, item) => {
        const test = tests.find((test) => test._id.toString() === item.itemId);
        return sum + parseFloat(test.price) * item.quantity;
      }, 0);

      const discount = items.reduce((sum, item) => {
        const test = tests.find((test) => test._id.toString() === item.itemId);
        return sum + parseFloat(test.discount) * item.quantity;
      }, 0);

      const totalAmount = grandTotal - discount;
      try {
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
        const orderToRegister = new Order({
          vendorId,
          userId,
          items,
          orderId,
          paymentId: paymentIdArray,
          paidByUserAmount,
          preference,
          currentLocation,
          prescription,
          customerName,
          MR_NO,
          totalAmount,
          discount,
          grandTotal,
          dollarAmount,
          processingFee,
          gatewayName,
        });
        order = await orderToRegister.save();

        const id = order._id;
        const idModelType = "Order";
        if (gatewayName !== "blinq") {
          const stripePaymentToRegister = new stripePaymentTransaction({
            id,
            idModelType,
            paymentId,
            gatewayName,
            paidByUserAmount,
            isPaidFull: true,
          });
          stripeController = await stripePaymentToRegister.save();

          if (order) {
            sendchatNotification(
              vendorId,
              {
                title: "MediTour Global",
                message: `You have a new order.`,
              },
              "lab"
            );
            const notification = new Notification({
              senderId: userId,
              senderModelType: "Users",
              receiverId: vendorId,
              receiverModelType: "Laboratory",
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
              message: `${user.name} paid ${paidByUserAmount} for ${lab.name} `,
            }));

            await Notification.insertMany(adminNotifications);

            admins.forEach((admin) => {
              sendchatNotification(
                admin._id,
                {
                  title: "MediTour Global",
                  message: `${user.name} paid ${paidByUserAmount} for ${lab.name} `,
                },
                "admin"
              );
            });
          }
        }
      } catch (error) {
        return next(error);
      }

      return res.status(201).json(order);
    } catch (error) {
      return next(error);
    }
  },
  async downloadLabOrder(req, res, next) {
    try {
      const { labOrderId } = req.query; // Extract labOrderId from query params

      // Fetch the lab order from the database
      const labOrder = await Order.findById(labOrderId);

      if (!labOrder) {
        return res.status(404).json([]); // Send empty response
      }

      // Ensure the `results` key exists
      if (!labOrder.results) {
        return res.status(404).json([]); // Send empty response
      }

      const resultLink = labOrder.results; // Assuming `results` contains the file URL or path

      // Handle file retrieval based on resultLink type
      if (resultLink.startsWith("http")) {
        // If it's a URL, fetch the file and pipe it to the response
        const fileResponse = await axios.get(resultLink, {
          responseType: "stream",
        });
        res.setHeader("Content-Type", fileResponse.headers["content-type"]);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=laborder_${labOrderId}.pdf`
        );
        fileResponse.data.pipe(res);
      } else {
        // If it's a local file path, send the file
        const filePath = path.resolve(resultLink); // Adjust based on your file storage system
        if (fs.existsSync(filePath)) {
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=laborder_${labOrderId}.pdf`
          );
          fs.createReadStream(filePath).pipe(res);
        } else {
          return res.status(404).json([]); // Send empty response
        }
      }
    } catch (error) {
      console.error(error);
      return next(error);
    }
  },

  async addRatingReview(req, res, next) {
    try {
      const { rating, review } = req.body;
      const vendorId = req.query.vendorId;
      const vendorModel = req.body.vendorModel;
      const userId = req.user._id;
      const appointmentId = req.query.appointmentId;

      // Fetch the user
      const user = await User.findById(userId);

      // Check if the vendorId exists in the ratings collection
      let existingRating = await Rating.findOne({ vendorId });

      // If the vendorId doesn't exist, create a new entry
      if (!existingRating) {
        existingRating = new Rating({
          vendorId,
          ratings: [],
        });
      }

      let appointment;
      let appointmentType;
      let vendor;
      let vendorModelType;

      // Map vendorModel to corresponding schema
      if (vendorModel === "Laboratory") {
        vendorModelType = Laboratory;
      } else if (vendorModel === "Pharmacy") {
        vendorModelType = Pharmacy;
      } else if (vendorModel === "Doctor") {
        vendorModelType = Doctor;
      } else if (vendorModel === "Ambulance") {
        vendorModelType = Ambulance;
      } else if (vendorModel === "Hospital") {
        vendorModelType = Hospital;
      } else if (vendorModel === "Insurance") {
        vendorModelType = Insurance;
      } else if (vendorModel === "RentCar") {
        vendorModelType = RentCar;
      } else if (vendorModel === "TravelAgency") {
        vendorModelType = TravelAgency;
      } else if (vendorModel === "Hotel") {
        vendorModelType = Hotel;
      } else if (vendorModel === "Donation") {
        vendorModelType = Donation;
      }

      // Check if vendorModel is valid
      if (!vendorModelType) {
        return res.status(400).json({
          message: `Invalid vendorModel: ${vendorModel}. Please provide a valid vendor model.`,
        });
      }

      // Fetch vendor details
      vendor = await vendorModelType.findById(vendorId);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }

      // Handle appointment information if available
      if (appointmentId) {
        appointment = await Appointment.findById(appointmentId);
        if (appointment) {
          appointmentType = appointment.appointmentType;
        }
      }

      // Check if user has already added a rating
      const existingUserRating = existingRating.ratings.find(
        (rating) => rating.userId.toString() === userId.toString()
      );

      // Restrict duplicate ratings for non-Doctor vendors
      if (vendorModel !== "Doctor" && existingUserRating) {
        return res.status(409).json({
          message: "You can only add one rating for this vendor.",
        });
      }

      // Restrict duplicate ratings for Doctor based on appointmentId
      if (vendorModel === "Doctor") {
        const appointmentRating = existingRating.ratings.find(
          (rating) =>
            rating.userId.toString() === userId.toString() &&
            rating.appointmentId &&
            rating.appointmentId.toString() === appointmentId
        );
        if (appointmentRating) {
          return res.status(409).json({
            message: "Rating and review for this appointment already exist!",
          });
        }
      }

      // Add the new rating
      existingRating.ratings.push({
        userId,
        rating,
        review,
        userImage: user.userImage,
        userName: user.name,
        appointmentType,
        appointmentId,
        createdAt: Date.now(),
      });

      // Save the updated rating
      await existingRating.save();

      // Calculate the average rating
      const ratings = existingRating.ratings.map((r) => r.rating);
      const averageRating =
        ratings.length > 0
          ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
          : 0;

      // Update the vendor's average rating
      vendor.averageRating = averageRating.toFixed(1);
      await vendor.save();

      return res.status(200).json({
        message: "Review added successfully",
        averageRating: averageRating.toFixed(1), // Round to 1 decimal place
      });
    } catch (error) {
      return next(error);
    }
  },

  async getOrder(req, res, next) {
    try {
      const orderId = req.query.orderId;
      const type = req.query.type;
      let order;
      if (type == "laboratory") {
        order = await Order.findById(orderId)
          .populate({
            path: "items.itemId", // Populate the itemId in items array
            populate: {
              path: "testNameId", // Populate the testNameId in the populated itemId (Tests model)
              select: "name categoryName", // Select the name and categoryName fields from TestName
            },
          })
          .populate({ path: "vendorId", select: "logo" });
      } else if (type == "pharmacy") {
        order = await MedRequest.findById(orderId).populate(
          "medicineIds.id bidIds"
        );
      }

      if (!order) {
        return res.status(404).json([]); // Send empty response
      }
      return res.status(200).json({ order });
    } catch (error) {
      return next(error);
    }
  },

  async getAllOrders(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const ordersPerPage = 10;
      const userId = req.user._id;
      const type = req.query.type;
      let orders;
      let totalOrders;
      let previousPage;
      let nextPage;
      let totalPages;
      if (type == "laboratory") {
        totalOrders = await Order.countDocuments({ userId }); // Get the total number of posts for the user
        totalPages = Math.ceil(totalOrders / ordersPerPage); // Calculate the total number of pages

        const skip = (page - 1) * ordersPerPage; // Calculate the number of posts to skip based on the current page

        orders = await Order.find({ userId })
          .populate("vendorId")
          .populate({
            path: "items.itemId", // Populate the itemId in items array
            populate: {
              path: "testNameId", // Populate the testNameId in the populated itemId (Tests model)
              select: "name categoryName", // Select the name and categoryName fields from TestName
            },
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(ordersPerPage);
        previousPage = page > 1 ? page - 1 : null;
        nextPage = page < totalPages ? page + 1 : null;
      } else if (type === "pharmacy") {
        totalOrders = await MedRequest.countDocuments({ patientId: userId });

        // Calculate the total number of pages
        totalPages = Math.ceil(totalOrders / ordersPerPage);

        // Calculate the number of orders to skip based on the current page
        const skip = (page - 1) * ordersPerPage;

        // Find all pharmacy orders for the vendor, sorted by createdAt field in descending order
        orders = await MedRequest.find({ patientId: userId })
          .populate("bidIds medicineIds.id")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(ordersPerPage);

        previousPage = page > 1 ? page - 1 : null;
        nextPage = page < totalPages ? page + 1 : null;
      }
      res.status(200).json({
        orders: orders,
        auth: true,
        totalOrders,
        totalPages: totalPages,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },

  async getAllRatingReviews(req, res, next) {
    try {
      const vendorId = req.query.vendorId;
      const page = parseInt(req.query.page) || 1; // current page
      const ratingsPerPage = 6; // number of ratings to show per page

      // Fetch the rating data for the given vendorId
      const existingRating = await Rating.findOne({ vendorId });

      // Handle the case when no ratings exist for the vendor
      if (
        !existingRating ||
        !existingRating.ratings ||
        existingRating.ratings.length === 0
      ) {
        return res.status(404).json({
          reviewsWithTimeAgo: [],
          previousPage: null,
          currentPage: page,
          nextPage: null,
          totalPages: 0,
          auth: true,
          totalRatingCount: 0,
        });
      }
      // Total number of ratings
      const totalRatingCount = existingRating.ratings.length;

      const totalPages = Math.ceil(totalRatingCount / ratingsPerPage); // Total number of pages

      // Calculate the number of ratings to skip for pagination
      const skip = (page - 1) * ratingsPerPage;

      // Slice the ratings array based on pagination
      const paginatedRatings = existingRating.ratings.slice(
        skip,
        skip + ratingsPerPage
      );

      // Convert createdAt timestamps to "time ago"
      const reviewsWithTimeAgo = paginatedRatings.map((review) => {
        const timeAgo = moment(review.createdAt).fromNow();
        return {
          ...review.toObject(),
          timeAgo: timeAgo,
        };
      });

      // Pagination details
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Return paginated ratings
      res.status(200).json({
        reviewsWithTimeAgo,
        previousPage,
        currentPage: page,
        nextPage,
        totalPages,
        auth: true,
        totalRatingCount,
      });
    } catch (error) {
      return next(error);
    }
  },

  async handleLabAndMedicineRequests(req, res, next) {
    try {
      const {
        labOrder, // Object containing lab order details if provided
        medicineRequest, // Object containing medicine request details if provided
      } = req.body;

      // Extract user ID
      const userId = req.user._id;
      let paymentIdArray = [];
      let totalPaidAmount = 0; // To track the overall payment

      // Validate and handle Lab Order
      let labOrderData;
      if (labOrder) {
        const labOrderSchema = Joi.object({
          vendorId: Joi.string().required(),
          paymentId: Joi.string().required(),
          paidByUserAmount: Joi.number().required(),
          items: Joi.array().required(),
          preference: Joi.string().valid("visit", "homeSample").required(),
          currentLocation: Joi.object().allow(""),
          prescription: Joi.string().allow(""),
          customerName: Joi.string().required(),
          MR_NO: Joi.string().required(),
          processingFee: Joi.number().required(),
          gatewayName: Joi.string().required(),
          appointmentId: Joi.string().optional(), // Optional if linking with an existing appointment
        });

        const { error } = labOrderSchema.validate(labOrder);
        if (error) {
          return res.status(400).json({ error: error.message });
        }

        const {
          vendorId,
          items,
          preference,
          currentLocation,
          prescription,
          customerName,
          MR_NO,
          paymentId,
          paidByUserAmount,
          processingFee,
          gatewayName,
          appointmentId, // Extract appointmentId
        } = labOrder;

        // Fetch lab details and calculate totals
        const lab = await Laboratory.findById(vendorId);
        const orderId = await getNextOrderNo();
        const itemIds = items.map((item) => item.itemId);
        const tests = await Test.find({ _id: { $in: itemIds } });

        const grandTotal = items.reduce((sum, item) => {
          const test = tests.find(
            (test) => test._id.toString() === item.itemId
          );
          return sum + parseFloat(test.price) * item.quantity;
        }, 0);

        const discount = items.reduce((sum, item) => {
          const test = tests.find(
            (test) => test._id.toString() === item.itemId
          );
          return sum + parseFloat(test.discount) * item.quantity;
        }, 0);

        const totalAmount = grandTotal - discount;
        let paymentConfirmation;

        // Add payment details for lab order
        if (gatewayName === "stripe") {
          paymentConfirmation = true;
          paymentIdArray.push({
            id: paymentId,
            status: "completed",
            createdAt: new Date(),
          });
        } else if (gatewayName === "blinq") {
          paymentConfirmation = false;
          paymentIdArray.push({
            id: paymentId,
            status: "pending",
            createdAt: new Date(),
          });
        }
        totalPaidAmount += paidByUserAmount;

        const dollarAmount = await exchangeRateApi(totalAmount);
        labOrderData = new Order({
          vendorId,
          userId,
          items,
          orderId,
          paymentId: paymentIdArray,
          paidByUserAmount,
          preference,
          currentLocation,
          prescription,
          customerName,
          MR_NO,
          totalAmount,
          discount,
          grandTotal,
          dollarAmount,
          processingFee,
          combinedPayment:
            medicineRequest && Object.keys(medicineRequest).length === 0
              ? false
              : true,
          paymentConfirmation,
          appointmentId, // Link to the related appointment
          gatewayName,
        });
        await labOrderData.save();
      }

      // Validate and handle Medicine Request
      let medicineRequestData;
      if (medicineRequest) {
        const medicineRequestSchema = Joi.object({
          medicineIds: Joi.array().required(),
          doctorId: Joi.string().required(),
          paymentId: Joi.string().required(),
          paidByUserAmount: Joi.number().required(),
          processingFee: Joi.number().required(),
          totalAmount: Joi.number().required(),
          gatewayName: Joi.string().required(),
        });

        const { error } = medicineRequestSchema.validate(medicineRequest);
        if (error) {
          return res.status(400).json({ error: error.message });
        }

        const {
          medicineIds,
          doctorId,
          paymentId,
          paidByUserAmount,
          processingFee,
          totalAmount,
          gatewayName,
        } = medicineRequest;

        const requestId = await getNextRequestNo();
        paymentIdArray = [];

        // Add payment details for medicine request
        if (gatewayName === "stripe") {
          paymentConfirmation = true;
          paymentIdArray.push({
            id: paymentId,
            status: "completed",
            createdAt: new Date(),
          });
        } else if (gatewayName === "blinq") {
          paymentConfirmation = false;
          paymentIdArray.push({
            id: paymentId,
            status: "pending",
            createdAt: new Date(),
          });
        }
        totalPaidAmount += paidByUserAmount;

        const dollarAmount = await exchangeRateApi(totalAmount);
        medicineRequestData = new MedRequest({
          requestId,
          medicineIds,
          paymentId: paymentIdArray,
          doctorId,
          patientId: userId,
          isPaidFull: true,
          paidByUserAmount,
          processingFee,
          totalAmount,
          dollarAmount,
          combinedPayment:
            labOrder && Object.keys(labOrder).length === 0 ? false : true,
          paymentConfirmation,
          gatewayName,
        });
        await medicineRequestData.save();
      }

      // Save payment details in the Stripe controller for tracking purposes
      if (totalPaidAmount > 0) {
        const stripePaymentToRegister = new stripePaymentTransaction({
          id: labOrderData?._id || medicineRequestData?._id,
          idModelType: labOrderData ? "Order" : "MedicineRequest",
          paymentId: paymentIdArray.map((p) => p.id).join(", "),
          gatewayName: labOrder?.gatewayName || medicineRequest?.gatewayName,
          paidByUserAmount: totalPaidAmount,
          isPaidFull: true,
        });
        await stripePaymentToRegister.save();
      }

      return res.status(201).json({
        message: "Request processed successfully",
        labOrder: labOrderData || null,
        medicineRequest: medicineRequestData || null,
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = userLabController;
