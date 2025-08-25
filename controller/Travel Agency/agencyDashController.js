const AgencyBooking = require("../../models/Travel Agency/booking");
const HotelBooking = require("../../models/Hotel/bookhotel");
const Agency = require("../../models/Travel Agency/travelAgency");
const mongoose = require("mongoose");
const BidRequest = require("../../models/Travel Agency/bid");
const moment = require("moment");

const agencyRequestController = {
  async dashDetails(req, res, next) {
    try {
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      const startOfMonth = moment(currentDate).startOf("month").toDate();
      const endOfMonth = moment(currentDate).endOf("month").toDate();
      const lastMonth = moment(currentDate).subtract(30, "days").toDate();
      const agencyId = req.user._id;

      // Today's Flight Bookings
      const todayFlightBooking = await AgencyBooking.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfMonth, $lt: endOfMonth },
            agencyId: mongoose.Types.ObjectId(agencyId),
            requestType: "flight",
          },
        },
        {
          $unwind: "$travellers",
        },
        {
          $count: "totalTravellers",
        },
      ]);

      const totalTodayTravellers =
      todayFlightBooking.length > 0
      ? todayFlightBooking[0].totalTravellers
      : 0;
  // Today's Tour Bookings
  const todayTourBooking = await AgencyBooking.aggregate([
    {
      $match: {
        createdAt: { $gte: currentDate, $lt: new Date() }, // Match today's date
        agencyId: mongoose.Types.ObjectId(agencyId),
        requestType: "tour",
      },
    },
    {
      $group: {
        _id: null, // No specific grouping needed, just aggregate the totalUser
        totalUsers: { $sum: "$totalUser" }, // Sum up totalUser field
      },
    },
  ]);


      const totalTodayUsers =
        todayTourBooking.length > 0 ? todayTourBooking[0].totalUsers : 0;

      // Last Month's travellers count in Flight Bookings
      const lastMonthFlightBooking = await AgencyBooking.aggregate([
        {
          $match: {
            createdAt: { $gte: lastMonth, $lt: new Date() },
            agencyId: mongoose.Types.ObjectId(agencyId),
            requestType: "flight",
          },
        },
        {
          $unwind: "$travellers",
        },
        {
          $count: "totalTravellers",
        },
      ]);

      const totalTravellers =
        lastMonthFlightBooking.length > 0
          ? lastMonthFlightBooking[0].totalTravellers
          : 0;

      // Last Month's Tour Bookings
      const lastMonthTourBooking = await AgencyBooking.aggregate([
        {
          $match: {
            createdAt: { $gte: lastMonth, $lt: new Date() },
            agencyId: mongoose.Types.ObjectId(agencyId),
            requestType: "tour",
          },
        },
        {
          $group: {
            _id: null, // No specific grouping needed, just aggregate the totalUser
            totalUsers: { $sum: "$totalUser" }, // Sum up totalUser field
          },
        },
      ]);
    

      const totalUser =
        lastMonthTourBooking.length > 0
          ? lastMonthTourBooking[0].totalUsers
          : 0;

      // Current Month's Flight Bookings
      const currentMonthFlightBooking = await AgencyBooking.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfMonth, $lt: endOfMonth },
            agencyId: mongoose.Types.ObjectId(agencyId),
            requestType: "flight",
          },
        },
        {
          $unwind: "$travellers",
        },
        {
          $count: "totalTravellers",
        },
      ]);

      const totalCurrentTravellers =
        currentMonthFlightBooking.length > 0
          ? currentMonthFlightBooking[0].totalTravellers
          : 0;

      // Current Month's Tour Bookings
      const currentMonthTourBooking = await AgencyBooking.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfMonth, $lt: endOfMonth },
            agencyId: mongoose.Types.ObjectId(agencyId),
            requestType: "tour",
          },
        },
        {
          $group: {
            _id: null, // No specific grouping needed, just aggregate the totalUser
            totalUsers: { $sum: "$totalUser" }, // Sum up totalUser field
          },
        },
      ]);
    
      const totalCurrentUsers =
        currentMonthTourBooking.length > 0
          ? currentMonthTourBooking[0].totalUsers
          : 0;

      // Recent Tour Schedule with Duration Calculation
      const recentTourSchedule = await AgencyBooking.find({
        agencyId,
        requestType: "tour",
      })
        .sort({ createdAt: -1 })
        .populate("agencyId userId tourId")
        .limit(3);

      const processedTourSchedule = recentTourSchedule.map((booking) => {
        if (
          booking.tourId &&
          booking.tourId.departDate &&
          booking.tourId.returnDate
        ) {
          const departDate = new Date(booking.tourId.departDate);
          const returnDate = new Date(booking.tourId.returnDate);
          const durationInMilliseconds = returnDate - departDate;
          const durationInDays = durationInMilliseconds / (1000 * 60 * 60 * 24); // Corrected conversion to days

          return {
            ...booking.toObject(),
            tourDuration: durationInDays,
          };
        } else {
          return {
            ...booking.toObject(),
            tourDuration: null,
          };
        }
      });

      // Response
      return res.json({
        todayFlightBooking: totalTodayTravellers,
        todayTourBooking: totalTodayUsers,
        lastMonthFlightBooking: totalTravellers,
        lastMonthTourBooking: totalUser,
        currentMonthFlightBooking: totalCurrentTravellers,
        currentMonthTourBooking: totalCurrentUsers,
        recentTourSchedule: processedTourSchedule,
      });
    } catch (error) {
      return next(error);
    }
  },
  async graph(req, res, next) {
    try {
      const today = moment().startOf("day");
      const lastWeek = moment().subtract(7, "days").startOf("day");
      const agencyId = req.user._id;

      console.log(
        `Calculating data from ${lastWeek.toDate()} to ${today.toDate()} for agency ${agencyId}`
      );

      // Fetch flight payments
      const flightPayments = await AgencyBooking.aggregate([
        {
          $match: {
            createdAt: { $gte: lastWeek.toDate(), $lt: today.toDate() },
            agencyId,
            requestType: "flight",
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            totalAmount: { $sum: "$actualPrice" },
          },
        },
        {
          $sort: { _id: 1 }, // Sort by date
        },
      ]);

      // Fetch tour payments
      const tourPayments = await AgencyBooking.aggregate([
        {
          $match: {
            createdAt: { $gte: lastWeek.toDate(), $lt: today.toDate() },
            agencyId,
            requestType: "tour",
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            totalAmount: { $sum: "$actualPrice" },
          },
        },
        {
          $sort: { _id: 1 }, // Sort by date
        },
      ]);
       // Calculate total payments
       const totalFlightPayments = Math.round(
        flightPayments.reduce((acc, curr) => acc + curr.totalAmount, 0)
      );
      const totalTourPayments = Math.round(tourPayments.reduce(
        (acc, curr) => acc + curr.totalAmount,
        0
      ));
      const totalRevenue = totalFlightPayments + totalTourPayments;
      // Send response
      return res.json({
        flightPayments,
        tourPayments,
        totalFlightPayments,
        totalTourPayments,
        totalRevenue
      });
    } catch (error) {
      console.error(`Error in graph API: ${error.message}`);
      next(error);
    }
  },

  async graphByMonth(req, res, next) {
    try {
      const currentMonth = moment().startOf("month");
      const lastTwelveMonths = Array.from({ length: 12 })
        .map((_, index) => moment(currentMonth).subtract(index, "months"))
        .reverse(); // Reverse to get in ascending order

      const agencyId = req.user._id;

      // Set the start and end dates
      const startDate = lastTwelveMonths[0].toDate();
      const endDate = moment(currentMonth).endOf("month").toDate();

      const flightPayments = await AgencyBooking.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            agencyId,
            requestType: "flight",
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            totalAmount: { $sum: "$actualPrice" },
          },
        },
        {
          $project: {
            _id: 1,
            totalAmount: { $round: ["$totalAmount", 0] }, // Round to the nearest integer
          },
        },
      ]);
      flightPayments.sort((a, b) => a._id.localeCompare(b._id));

      const tourPayments = await AgencyBooking.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            agencyId,
            requestType: "tour",
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            totalAmount: { $sum: "$actualPrice" },
          },
        },
        {
          $project: {
            _id: 1,
            totalAmount: { $round: ["$totalAmount", 0] }, // Round to the nearest integer
          },
        },
      ]);
      tourPayments.sort((a, b) => a._id.localeCompare(b._id));

      res.json({
        flightPayments,
        tourPayments,
      });
    } catch (error) {
      next(error);
    }
  },

  
};

module.exports = agencyRequestController;
