const moment = require("moment");
const bookhotel = require("../../models/Hotel/bookhotel.js");
const homeInfo = require("../../models/Hotel/homeInfo.js");
const appartmentInfo = require("../../models/Hotel/appartmentInfo.js");
const HotelBookingRequests = require("../../models/Hotel/bookHotelRequest");
const bnbInfo = require("../../models/Hotel/bnbInfo.js");

async function getReservationCountsForMonths(hotelId, startDate, endDate) {
  const months = [];
  let totalReservationsCount = 0;
  let totalConfirmedBookings = 0;
  let currentDate = moment(startDate);

  while (currentDate.isSameOrBefore(endDate)) {
    const nextMonth = moment(currentDate).endOf("month");
    // Modify this query based on your actual data structure
    const distinctUserIds = await bookhotel.distinct("userId", {
      createdAt: { $gte: currentDate.toDate(), $lt: nextMonth.toDate() },
      hotelId: hotelId,
    });

    const reservationsCount = distinctUserIds.length;
    const confirmedBookings = distinctUserIds.length; // Assuming confirmed bookings logic is same for simplicity

    // Aggregate total counts
    totalReservationsCount += reservationsCount;
    totalConfirmedBookings += confirmedBookings;

    months.push({
      month: currentDate.format("YYYY-MM"),
      reservationsCount,
      confirmedBookings,
    });

    currentDate.add(1, "months");
  }

  return { months, totalReservationsCount, totalConfirmedBookings };
}

const hotelDashController = {
  //not in use//
  async hotelGraph(req, res, next) {
    try {
      // Calculate date ranges for the last 12 months
      const today = moment().startOf("day");
      const last12MonthsStart = moment(today)
        .subtract(12, "months")
        .startOf("month");
      const last12MonthsEnd = moment(today).endOf("day");

      // Fetch data for the last 12 months
      const { months, totalReservationsCount, totalConfirmedBookings } =
        await getReservationCountsForMonths(
          req.user._id,
          last12MonthsStart,
          last12MonthsEnd
        );

      res.json({ months, totalReservationsCount, totalConfirmedBookings });
    } catch (error) {
      next(error);
    }
  },
  async getAllLatestReservations(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = 10;
      const hotelId = req.user._id;

      // Get the total number of pending bookings for the hotel
      const totalBookings = await HotelBookingRequests.countDocuments({
        hotelId,
        status: "pending",
      });

      // Get the distinct count of users who have made pending reservations
      const distinctUserCount = await HotelBookingRequests.distinct("userId", {
        hotelId,
        status: "pending",
      }).then((users) => users.length);

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalBookings / requestsPerPage);

      // Calculate the number of bookings to skip based on the current page
      const skip = (page - 1) * requestsPerPage;

      // Retrieve pending bookings with pagination and populate userId
      const bookings = await HotelBookingRequests.find({
        hotelId,
        status: "pending",
      })
        .sort({ createdAt: -1 }) // Sort by createdAt field in descending order
        .skip(skip)
        .limit(requestsPerPage)
        .populate("userId"); // Populate userId field with User details

      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        bookings: bookings,
        distinctUserCount: distinctUserCount, // Total count of distinct users
        auth: true,
        totalPages,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
  async getLatestBookings(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const bookingsPerPage = 10;
      const hotelId = req.user._id;
      const searchKeyword = req.query.search || "";
  
      const matchStage = { hotelId };
  
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
  
      const totalConfirmedBookings = await bookhotel.countDocuments(matchStage);
      const totalPages = Math.ceil(totalConfirmedBookings / bookingsPerPage);
      const skip = (page - 1) * bookingsPerPage;
  
      const confirmedBookings = await bookhotel.aggregate([
        { $match: matchStage },
  
        // Populate user details with type-safe lookup
        {
          $lookup: {
            from: "Users",
            let: { userId: "$userId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
              { $project: { name: 1, email: 1 } },
            ],
            as: "userDetails",
          },
        },
        { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },
  
        // Populate property details with type-safe lookup
        {
          $lookup: {
            from: "properties",
            let: { propertyId: "$propertyId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$propertyId"] } } },
              { $project: { property: 1, numberOfBeds: 1 } },  // Add numberOfBeds here
            ],
            as: "propertyDetails",
          },
        },        
        { $unwind: { path: "$propertyDetails", preserveNullAndEmptyArrays: true } },
  
        ...(searchKeyword ? [searchStage] : []),
  
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: bookingsPerPage },
  
        {
          $project: {
            _id: 1,
            bookingId: 1,
            user: {
              name: { $ifNull: ["$userDetails.name", "N/A"] },
              email: { $ifNull: ["$userDetails.email", "N/A"] },
            },
            property: {
              name: { $ifNull: ["$propertyDetails.property", "N/A"] },
              numberOfBeds: { $ifNull: ["$propertyDetails.numberOfBeds", "N/A"] },
            },
            arrivalDate: 1,
            spaceType: 1,
            noOfGuest: 1,
            createdAt: 1,
            status: 1,
          },
        }
      ]);
  
      const distinctUsers = await bookhotel.distinct("userId", { hotelId });
      const totalUsersBooking = distinctUsers.length;
  
      return res.status(200).json({
        bookings: confirmedBookings,
        auth: true,
        totalPages,
        previousPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
        totalUsersBooking,
      });
    } catch (error) {
      console.error("Error in getLatestBookings:", error);
      return next(error);
    }
  },  
  //not in use//
  async getTotalPropertyCounts(req, res, next) {
    try {
      const hotelId = req.user._id; // Assuming the hotel's ID is stored in req.user._id

      // Get the total count of homes for the hotel
      const totalHomes = await homeInfo.countDocuments({ hotelId });

      // Get the total count of apartments for the hotel
      const totalApartments = await appartmentInfo.countDocuments({ hotelId });

      // Get the total count of BnBs for the hotel
      const totalBnbs = await bnbInfo.countDocuments({ hotelId });

      return res.status(200).json({
        totalHomes: totalHomes,
        totalApartments: totalApartments,
        totalBnbs: totalBnbs,
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = hotelDashController;
