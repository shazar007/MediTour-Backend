const HotelBookingRequests = require("../../models/Hotel/bookHotelRequest");
const bookhotel = require("../../models/Hotel/bookhotel.js");
const Property = require("../../models/Hotel/property.js");
const PayToVendor = require("../../models/Admin/paymentToVendors.js");
const mongoose = require("mongoose");

const hotelBookingController = {
  async getAllReservations(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const requestsPerPage = 10;
      const hotelId = req.user._id;
      const searchKeyword = req.query.search || "";
  
      const matchStage = {
        hotelId,
        status: "pending",
        isReservation: true,
      };
  
      const searchStage = searchKeyword
        ? {
            $match: {
              $or: [
                { "userDetails.name": { $regex: searchKeyword, $options: "i" } },
                { "userDetails.email": { $regex: searchKeyword, $options: "i" } },
                { "propertyDetails.property": { $regex: searchKeyword, $options: "i" } },
              ],
            },
          }
        : {};
  
      const bookings = await HotelBookingRequests.aggregate([
        { $match: matchStage },
  
        // Join with users collection
        {
          $lookup: {
            from: "Users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },
  
        // Join with properties collection
        {
          $lookup: {
            from: "properties",
            localField: "propertyId",
            foreignField: "_id",
            as: "propertyDetails",
          },
        },
        { $unwind: { path: "$propertyDetails", preserveNullAndEmptyArrays: true } },
  
        // Apply search if keyword exists
        ...(searchKeyword ? [searchStage] : []),
  
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * requestsPerPage },
        { $limit: requestsPerPage },
  
        // Avoid collisions by renaming fields in the projection
        {
          $project: {
            _id: 1,
            arrivalDate: 1,
            requestId: 1,
            hotelId: 1,
            spaceType: 1,
            noOfGuest: 1,
            createdAt: 1,
            user: { name: "$userDetails.name", email: "$userDetails.email" },
            property: "$propertyDetails.property",
          },
        },
      ]);

      const bookingsWithExpiry = bookings.map((booking) => {
        const createdAt = new Date(booking.createdAt); // Get the createdAt timestamp
        const now = new Date(); // Current time
        const timeElapsed = now - createdAt; // Time elapsed in milliseconds
        const timeElapsedInHours = timeElapsed / (1000 * 60 * 60); // Convert to hours
  
        let reservationExpiresIn = Math.max(24 - timeElapsedInHours, 0); // Time left in hours (minimum 0)
        reservationExpiresIn = Math.round(reservationExpiresIn)
  
        return {
          ...booking,
          reservationExpiresIn: reservationExpiresIn,
        };
      });
  
      const totalBookingsCount = await HotelBookingRequests.countDocuments(matchStage);
      const totalPages = Math.ceil(totalBookingsCount / requestsPerPage);
  
      return res.status(200).json({
        bookings: bookingsWithExpiry,
        bookingCount: bookings.length,
        auth: true,
        totalPages,
        previousPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
      });
    } catch (error) {
      console.error("Error in getAllReservations:", error);
      return next(error);
    }
  },
  async getConfirmedBookings(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const bookingsPerPage = 10;
      const hotelId = req.user._id;

      // Count the total number of confirmed bookings for the hotel
      const totalConfirmedBookings = await bookhotel.countDocuments({
        hotelId,
        // Add any other filters if needed
      });

      const totalPages = Math.ceil(totalConfirmedBookings / bookingsPerPage); // Calculate the total number of pages

      const skip = (page - 1) * bookingsPerPage; // Calculate the number of bookings to skip based on the current page

      // Find confirmed bookings, sorted by createdAt field in descending order
      const confirmedBookings = await bookhotel
        .find({ hotelId })
        .populate("userId")
        .populate({
          path: "serviceId",
          select: "propertyName",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(bookingsPerPage);

      // Count the distinct users who have made bookings
      const distinctUsers = await bookhotel.distinct("userId", { hotelId });
      const totalUsersBooking = distinctUsers.length;

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        bookings: confirmedBookings,
        auth: true,
        totalPages,
        bookingCount: confirmedBookings.length,
        previousPage: previousPage,
        nextPage: nextPage,
        totalUsersBooking: totalUsersBooking,
      });
    } catch (error) {
      return next(error);
    }
  },
  async getReservationDetail(req, res, next) {
    try {
      const reservationId = req.query.reservationId;
      const request = await HotelBookingRequests.findById(reservationId);

      return res.status(200).json({ request });
    } catch (error) {
      return next(error);
    }
  },

  async dashboard(req, res, next) {
    try {
      const hotelId = req.user._id;
      console.log(hotelId);
      const results = await Property.aggregate([
        {
          $match: {
            property: "rooms",
            hotelId: mongoose.Types.ObjectId(hotelId),
          },
        },
        {
          $group: {
            _id: null,
            totalRooms: { $sum: "$propertyCount" },
          },
        },
      ]);
      console.log("results", results)
      // res.json(results[0].totalRooms)
      const bookingCount = await bookhotel.countDocuments({ hotelId: hotelId });
      const reservationsCount = await HotelBookingRequests.countDocuments({
        hotelId: hotelId,
        isReservation: true,
      });
      const propertyCount = await Property.countDocuments({ hotelId: hotelId });
      const paymentToVendors = await PayToVendor.countDocuments({
        hotelId: hotelId,
      });
      const roomsCount = results[0] ? results[0].totalRooms : 0;
      res.status(200).json({
        auth: true,
        roomsCount: roomsCount,
        bookingCount: bookingCount,
        reservationsCount: reservationsCount,
        propertyCount: propertyCount,
        paymentToVendors: paymentToVendors,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = hotelBookingController;
