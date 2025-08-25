const TravelCompany = require("../../models/Travel Company/travelCompany");
const AgencyBooking = require("../../models/Travel Agency/booking");
const BidRequest = require("../../models/Travel Agency/bid");
const HotelBooking = require("../../models/Hotel/bookhotel");
const Hotel = require("../../models/Hotel/hotel");
const Agency = require("../../models/Travel Agency/travelAgency");
const mongoose = require("mongoose");

const agencyRequestController = {
  async dashboard(req, res, next) {
    try {
      const travelCompanyId = req.user._id;
      const travelCompany = await TravelCompany.findById(travelCompanyId);

      const agencyCount = travelCompany.agencyIds.length;
      const hotelCount = travelCompany.hotelIds.length;

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const { agencyId, hotelId } = req.query;

      // Optional filter conditions
      const agencyFilter = agencyId
        ? { agencyId, travelCompanyId }
        : { travelCompanyId };
      const hotelFilter = hotelId
        ? { hotelId, travelCompanyId }
        : { travelCompanyId };

      const totalAgencyBookings = await AgencyBooking.countDocuments(
        agencyFilter
      );
      const totalHotelBookings = await HotelBooking.countDocuments(hotelFilter);

      const totalPages = Math.ceil(totalAgencyBookings / limit);
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      const agencyBooking = await AgencyBooking.find(agencyFilter)
        .populate({
          path: "userId",
          select: "name email",
        })
        .populate({
          path: "agencyId",
          select: "name",
        }) // Populate agency name and ID
        .populate({
          path: "tourId", // Populate the tourId for "tour" requestType
          select: "arrivalDate",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const agencyBookingForNames = await AgencyBooking.find({
        travelCompanyId,
      })
        .populate({
          path: "agencyId",
          select: "name _id",
        })
        .sort({ createdAt: -1 });

      console.log("agencyBookingForNames", agencyBookingForNames);

      const agencyNames = [
        ...new Set(
          agencyBookingForNames
            .filter((booking) => booking.agencyId) // Ensure agencyId is not null
            .map((booking) => `${booking.agencyId.name}-${booking.agencyId._id}`) // Combine name and _id as a string for uniqueness
        ),
      ].map((agencyString) => {
        const [name, id] = agencyString.split('-');
        return { name, _id: id }; // Convert back to an object
      });
      
      console.log(agencyNames);      

      console.log("Distinct Agency Names:", agencyNames);

      const hotelBooking = await HotelBooking.find(hotelFilter)
        .populate({
          path: "userId",
          select: "name email",
        })
        .populate({
          path: "hotelId",
          select: "name",
        }) // Populate hotel name and ID
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const hotelBookingForNames = await HotelBooking.find({ travelCompanyId })
        .populate({
          path: "hotelId",
          select: "name _id",
        }) // Populate hotel name and ID
        .sort({ createdAt: -1 });
      console.log("hotelBookingForNames", hotelBookingForNames);

      const hotelNames = [
        ...new Set(
          hotelBookingForNames
            .filter((booking) => booking.hotelId) // Ensure hotelId is not null
            .map((booking) => `${booking.hotelId.name}-${booking.hotelId._id}`) // Combine name and _id as a string for uniqueness
        ),
      ].map((hotelString) => {
        const [name, id] = hotelString.split('-');
        return { name, _id: id }; // Convert back to an object
      });
      
      console.log(hotelNames);
      

      // Process agency bookings
      const filteredAgencyBooking = await Promise.all(
        agencyBooking.map(async (booking) => {
          const {
            status,
            requestType,
            travellers,
            bookingId,
            agencyId,
            tourId,
            createdAt,
          } = booking;
          const numberOfTravelers = travellers?.length || 0;

          if (requestType === "flight") {
            const bidRequest = await BidRequest.findById(booking.bidRequestId);

            if (bidRequest) {
              const { departureDate, departureTime } =
                bidRequest.flightDetails?.[0] || {};
              return {
                bookingId,
                userId: booking.userId,
                agency: {
                  _id: agencyId?._id || null,
                  name: agencyId?.name || null,
                },
                travelCompanyId: booking.travelCompanyId,
                status,
                requestType,
                numberOfTravelers,
                createdAt,
              };
            }

            // Default flight data (if no bidRequest)
            return {
              bookingId,
              userId: booking.userId,
              agency: {
                _id: agencyId?._id || null,
                name: agencyId?.name || null,
              },
              travelCompanyId: booking.travelCompanyId,
              status,
              requestType,
              numberOfTravelers,
              createdAt,
            };
          }

          if (requestType === "tour") {
            const date = tourId?.arrivalDate?.from || null;

            return {
              bookingId,
              userId: booking.userId,
              agency: {
                _id: agencyId?._id || null,
                name: agencyId?.name || null,
              },
              travelCompanyId: booking.travelCompanyId,
              status,
              requestType,
              totalUser: booking.totalUser,
              createdAt,
            };
          }

          // Default for other request types
          return {
            bookingId,
            userId: booking.userId,
            agency: {
              _id: agencyId?._id || null,
              name: agencyId?.name || null,
            },
            travelCompanyId: booking.travelCompanyId,
            status,
            requestType,
            numberOfTravelers,
            createdAt,
          };
        })
      );

      // Process hotel bookings
      const filteredHotelBooking = hotelBooking.map((booking) => {
        const {
          status,
          bookingId,
          hotelId,
          travelCompanyId,
          arrivalDate,
          noOfGuest,
          userId,
          createdAt,
        } = booking;

        return {
          bookingId,
          hotel: {
            _id: hotelId?._id || null,
            name: hotelId?.name || null,
          },
          travelCompanyId,
          status,
          requestType: "hotel",
          arrivalDate: arrivalDate.from,
          noOfGuest,
          userId,
          createdAt,
        };
      });

      res.json({
        agencyCount,
        hotelCount,
        agencyBooking: {
          total: totalAgencyBookings,
          agencyNames: agencyNames,
          page,
          limit,
          totalPages,
          previousPage,
          nextPage,
          data: filteredAgencyBooking.filter((booking) => booking !== null),
        },
        hotelBooking: {
          total: totalHotelBookings,
          page,
          limit,
          totalPages: Math.ceil(totalHotelBookings / limit),
          previousPage: page > 1 ? page - 1 : null,
          nextPage:
            page < Math.ceil(totalHotelBookings / limit) ? page + 1 : null,
          data: filteredHotelBooking,
          hotelNames: hotelNames,
        },
        auth: true,
      });
    } catch (error) {
      next(error);
    }
  },

  async listHotels(req, res, next) {
    try {
      const travelCompanyId = req.user._id;

      // // Parse pagination parameters
      // const page = parseInt(req.query.page) || 1;
      // const limit = parseInt(req.query.limit) || 10;
      // const skip = (page - 1) * limit;

      const keyword = req.query.keyword || "";
      // Match agencies by travelCompanyId
      const matchStage = {
        $match: {
          travelCompanyId: travelCompanyId,
          name: { $regex: keyword, $options: "i" },
        },
      };

      // Aggregation pipeline
      const agenciesPipeline = [
        matchStage,
        {
          $lookup: {
            from: "ratings",
            localField: "_id",
            foreignField: "vendorId",
            as: "ratings",
          },
        },
        {
          $lookup: {
            from: "hotel and bnb",
            localField: "_id",
            foreignField: "hotelId",
            as: "hotelDetails",
          },
        },
        {
          $addFields: {
            ratingsArray: {
              $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
            },
            satisfiedPatientCount: {
              $size: {
                $filter: {
                  input: {
                    $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
                  },
                  as: "rating",
                  cond: { $eq: ["$$rating.rating", 5] },
                },
              },
            },
            totalRatingsCount: {
              $size: {
                $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
              },
            },
            satisfiedPatientPercentage: {
              $cond: {
                if: { $gt: ["$totalRatingsCount", 0] },
                then: {
                  $multiply: [
                    {
                      $divide: ["$satisfiedPatientCount", "$totalRatingsCount"],
                    },
                    100,
                  ],
                },
                else: 0,
              },
            },
          },
        },
        {
          $unwind: {
            path: "$hotelDetails",
            preserveNullAndEmptyArrays: true, // Handles cases where there are no hotel details
          },
        },
        {
          $addFields: {
            noOfRooms: {
              $size: {
                $ifNull: ["$hotelDetails.rooms", []],
              },
            },
          },
        },
        {
          $group: {
            _id: "$_id", // Group by agency ID
            name: { $first: "$name" },
            email: { $first: "$email" },
            logo: { $first: "$logo" },
            phoneNumber: { $first: "$phoneNumber" },
            location: { $first: "$location" },
            experience: { $first: "$experience" },
            features: { $first: "$features" },
            satisfiedPatientCount: { $first: "$satisfiedPatientCount" },
            satisfiedPatientPercentage: {
              $first: "$satisfiedPatientPercentage",
            },
            totalRatingsCount: { $first: "$totalRatingsCount" },
            totalRooms: { $sum: "$noOfRooms" }, // Sum of noOfRooms for the agency
            createdAt: { $first: "$createdAt" }, // Include createdAt for sorting
          },
        },
        {
          $sort: {
            createdAt: -1, // Sort by createdAt in descending order
          },
        },
        {
          $project: {
            name: 1,
            email: 1,
            logo: 1,
            phoneNumber: 1,
            location: 1,
            experience: 1,
            features: 1,
            satisfiedPatientCount: 1,
            satisfiedPatientPercentage: 1,
            totalRatingsCount: 1,
            totalRooms: 1, // Include totalRooms
          },
        },
        // { $skip: skip }, // Pagination: Skip documents
        // { $limit: limit }, // Pagination: Limit documents
      ];

      // Count total agencies
      const totalHotels = await Hotel.countDocuments(matchStage.$match);

      // Aggregate agencies
      const hotels = await Hotel.aggregate(agenciesPipeline);

      // // Calculate pagination metadata
      // const totalPages = Math.ceil(totalHotels / limit);
      // const previousPage = page > 1 ? page - 1 : null;
      // const nextPage = page < totalPages ? page + 1 : null;

      // Respond with data
      res.status(200).json({
        hotels,
        totalHotels,
        // totalPages,
        // previousPage,
        // nextPage,
        auth: true,
      });
    } catch (error) {
      next(error);
    }
  },

  async agencyList(req, res, next) {
    try {
      const travelCompanyId = req.user._id;

      // // Parse pagination parameters
      // const page = parseInt(req.query.page) || 1;
      // const limit = parseInt(req.query.limit) || 10;
      // const skip = (page - 1) * limit;

      // Parse keyword search parameter
      const keyword = req.query.keyword || "";

      // Match agencies by travelCompanyId and keyword search on name
      const matchStage = {
        $match: {
          travelCompanyId: travelCompanyId,
          name: { $regex: keyword, $options: "i" }, // Case-insensitive regex search
        },
      };

      // Aggregation pipeline
      const agenciesPipeline = [
        matchStage,
        {
          $lookup: {
            from: "ratings",
            localField: "_id",
            foreignField: "vendorId",
            as: "ratings",
          },
        },
        {
          $lookup: {
            from: "tours",
            localField: "_id",
            foreignField: "agencyId",
            as: "tours",
          },
        },
        {
          $addFields: {
            ratingsArray: {
              $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
            },
            satisfiedPatientCount: {
              $size: {
                $filter: {
                  input: {
                    $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
                  },
                  as: "rating",
                  cond: { $eq: ["$$rating.rating", 5] },
                },
              },
            },
            totalRatingsCount: {
              $size: {
                $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
              },
            },
            satisfiedPatientPercentage: {
              $cond: {
                if: { $gt: ["$totalRatingsCount", 0] },
                then: {
                  $multiply: [
                    {
                      $divide: ["$satisfiedPatientCount", "$totalRatingsCount"],
                    },
                    100,
                  ],
                },
                else: 0,
              },
            },
            toursCount: {
              $size: "$tours",
            },
          },
        },
        {
          $project: {
            name: 1,
            email: 1,
            logo: 1,
            phoneNumber: 1,
            location: 1,
            experience: 1,
            features: 1,
            satisfiedPatientCount: 1,
            satisfiedPatientPercentage: 1,
            toursCount: 1,
          },
        },
        // { $skip: skip }, // Pagination: Skip documents
        // { $limit: limit }, // Pagination: Limit documents
      ];

      // Count total agencies matching the keyword
      const totalAgencies = await Agency.countDocuments(matchStage.$match);

      // Aggregate agencies
      const agencies = await Agency.aggregate(agenciesPipeline);

      // // Calculate pagination metadata
      // const totalPages = Math.ceil(totalAgencies / limit);
      // const previousPage = page > 1 ? page - 1 : null;
      // const nextPage = page < totalPages ? page + 1 : null;

      // Respond with data
      res.status(200).json({
        agencies,
        totalAgencies,
        // totalPages,
        // previousPage,
        // nextPage,
        auth: true,
      });
    } catch (error) {
      next(error);
    }
  },

  async getAgencyDetails(req, res, next) {
    try {
      const { agencyId } = req.query; // Get the agency _id from the request parameters
      const travelCompanyId = req.user._id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Fetch the agency details
      const agency = await Agency.aggregate([
        {
          $match: {
            _id: mongoose.Types.ObjectId(agencyId),
          },
        },
        {
          $lookup: {
            from: "ratings",
            localField: "_id",
            foreignField: "vendorId",
            as: "ratings",
          },
        },
        {
          $lookup: {
            from: "tours",
            localField: "_id",
            foreignField: "agencyId",
            as: "tours",
          },
        },
        {
          $addFields: {
            ratingsArray: {
              $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
            },
            satisfiedPatientCount: {
              $size: {
                $filter: {
                  input: {
                    $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
                  },
                  as: "rating",
                  cond: { $eq: ["$$rating.rating", 5] },
                },
              },
            },
            totalRatingsCount: {
              $size: {
                $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
              },
            },
            satisfiedPatientPercentage: {
              $cond: {
                if: { $gt: ["$totalRatingsCount", 0] },
                then: {
                  $multiply: [
                    {
                      $divide: ["$satisfiedPatientCount", "$totalRatingsCount"],
                    },
                    100,
                  ],
                },
                else: 0,
              },
            },
            toursCount: {
              $size: "$tours",
            },
          },
        },
        {
          $project: {
            name: 1,
            email: 1,
            logo: 1,
            phoneNumber: 1,
            location: 1,
            experience: 1,
            features: 1,
            satisfiedPatientCount: 1,
            satisfiedPatientPercentage: 1,
            toursCount: 1,
          },
        },
      ]);

      if (!agency.length) {
        return res.status(404).json({ message: "Agency not found" });
      }

      // Fetch the bookings for the agency
      const agencyFilter = { agencyId, travelCompanyId };

      const totalAgencyBookings = await AgencyBooking.countDocuments(
        agencyFilter
      );
      const agencyBooking = await AgencyBooking.find(agencyFilter)
        .populate({
          path: "userId",
          select: "name phone",
        })
        .populate({
          path: "agencyId",
          select: "name",
        })
        .populate({
          path: "tourId", // Populate the tourId for "tour" requestType
          select: "arrivalDate",
        })
        .skip(skip)
        .limit(limit);

      // Process and filter bookings
      const filteredAgencyBooking = await Promise.all(
        agencyBooking.map(async (booking) => {
          const {
            status,
            requestType,
            travellers,
            bookingId,
            agencyId,
            totalUser,
            tourId,
            createdAt,
          } = booking;

          if (requestType === "flight") {
            const numberOfTravelers = travellers?.length || 0;

            const bidRequest = await BidRequest.findById(booking.bidRequestId);

            if (bidRequest) {
              const { departureDate, departureTime } =
                bidRequest.flightDetails?.[0] || {};
              return {
                bookingId,
                userId: booking.userId,
                agency: {
                  _id: agencyId?._id || null,
                  name: agencyId?.name || null,
                },
                travelCompanyId: booking.travelCompanyId,
                status,
                requestType,
                numberOfTravelers,
                createdAt,
              };
            }

            // Default flight data (if no bidRequest)
            return {
              bookingId,
              userId: booking.userId,
              agency: {
                _id: agencyId?._id || null,
                name: agencyId?.name || null,
              },
              travelCompanyId: booking.travelCompanyId,
              status,
              requestType,
              numberOfTravelers,
              createdAt,
            };
          }

          if (requestType === "tour") {
            const date = tourId?.arrivalDate?.from || null;

            return {
              bookingId,
              userId: booking.userId,
              agency: {
                _id: agencyId?._id || null,
                name: agencyId?.name || null,
              },
              travelCompanyId: booking.travelCompanyId,
              status,
              requestType,
              totalUser,
              createdAt,
            };
          }

          // Default for other request types
          return {
            bookingId,
            userId: booking.userId,
            agency: {
              _id: agencyId?._id || null,
              name: agencyId?.name || null,
            },
            travelCompanyId: booking.travelCompanyId,
            status,
            requestType,
            createdAt,
          };
        })
      );

      const totalPages = Math.ceil(totalAgencyBookings / limit);
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      res.status(200).json({
        agency: agency[0],
        agencyBooking: {
          total: totalAgencyBookings,
          page,
          limit,
          totalPages,
          previousPage,
          nextPage,
          data: filteredAgencyBooking.filter((booking) => booking !== null),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getHotelDetails(req, res, next) {
    try {
      const { hotelId } = req.query; // Get the hotel _id from the request parameters
      const travelCompanyId = req.user._id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Fetch the hotel details
      const hotel = await Hotel.aggregate([
        {
          $match: {
            _id: mongoose.Types.ObjectId(hotelId),
          },
        },
        {
          $lookup: {
            from: "ratings",
            localField: "_id",
            foreignField: "vendorId",
            as: "ratings",
          },
        },
        {
          $addFields: {
            ratingsArray: {
              $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
            },
            satisfiedGuestCount: {
              $size: {
                $filter: {
                  input: {
                    $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
                  },
                  as: "rating",
                  cond: { $eq: ["$$rating.rating", 5] },
                },
              },
            },
            totalRatingsCount: {
              $size: {
                $ifNull: [{ $arrayElemAt: ["$ratings.ratings", 0] }, []],
              },
            },
            satisfiedGuestPercentage: {
              $cond: {
                if: { $gt: ["$totalRatingsCount", 0] },
                then: {
                  $multiply: [
                    {
                      $divide: ["$satisfiedGuestCount", "$totalRatingsCount"],
                    },
                    100,
                  ],
                },
                else: 0,
              },
            },
          },
        },
        {
          $project: {
            name: 1,
            email: 1,
            logo: 1,
            phoneNumber: 1,
            location: 1,
            features: 1,
            satisfiedGuestCount: 1,
            satisfiedGuestPercentage: 1,
          },
        },
      ]);

      if (!hotel.length) {
        return res.status(404).json({ message: "Hotel not found" });
      }

      // Fetch the bookings for the hotel
      const hotelFilter = { hotelId, travelCompanyId };

      const totalHotelBookings = await HotelBooking.countDocuments(hotelFilter);
      const hotelBooking = await HotelBooking.find(hotelFilter)
        .populate({
          path: "userId",
          select: "name phone",
        })
        .populate({
          path: "hotelId",
          select: "name",
        })
        .sort({ createdAt: -1 }) // Sort bookings by createdAt in descending order
        .skip(skip)
        .limit(limit);

      // Process and filter bookings
      const filteredHotelBooking = await Promise.all(
        hotelBooking.map(async (booking) => {
          const {
            status,
            bookingId,
            hotelId,
            noOfGuest,
            arrivalDate,
            serviceModelType,
            createdAt,
          } = booking;

          const date = arrivalDate?.from || null;

          return {
            bookingId,
            userId: booking.userId,
            hotel: {
              _id: hotelId?._id || null,
              name: hotelId?.name || null,
            },
            status,
            noOfGuest,
            date,
            type: serviceModelType,
            createdAt,
          };
        })
      );

      const totalPages = Math.ceil(totalHotelBookings / limit);
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      res.status(200).json({
        hotel: hotel[0],
        hotelBooking: {
          total: totalHotelBookings,
          page,
          limit,
          totalPages,
          previousPage,
          nextPage,
          data: filteredHotelBooking.filter((booking) => booking !== null),
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = agencyRequestController;
