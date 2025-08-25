const Package = require("../../models/Donation/package.js");
const mongoose = require("mongoose");
const moment = require("moment");

const DonorList = require("../../models/Donation/donations.js");

async function getAmountCountForWeek(companyId, startDate, endDate) {
  const days = [];
  let currentDate = moment(startDate);

  while (currentDate.isSameOrBefore(endDate)) {
    const nextDate = moment(currentDate).endOf("day");
    // Modify this query based on your actual data structure
    try {
      const result = await DonorList.aggregate([
        {
          $match: {
            companyId,
            createdAt: { $gte: currentDate.toDate(), $lt: nextDate.toDate() },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: "$donationAmount",
            },
          },
        },
      ]);

      let totalAmount = 0;

      if (result.length > 0) {
        totalAmount = result[0].totalAmount;
      } else {
        console.log("No documents found for the specified companyId.");
      }

      days.push({
        date: currentDate.format("YYYY-MM-DD"),
        totalAmount: totalAmount,
      });
    } catch (error) {
      console.error("Error:", error);
    }

    currentDate.add(1, "days");
  }

  return days;
}

const docDashController = {
  async dashDetails(req, res, next) {
    try {
      const companyId = req.user._id;
      const result = await DonorList.aggregate([
        {
          $match: {
            companyId: mongoose.Types.ObjectId(companyId),
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: "$donationAmount",
            },
          },
        },
      ]);

      let totalAmount = 0;

      if (result.length > 0) {
        totalAmount = Math.floor(result[0].totalAmount);
      } else {
        console.log("No documents found for the specified companyId.");
      }

      const uniqueUserDocs = await DonorList.aggregate([
        {
          $match: {
            companyId: mongoose.Types.ObjectId(companyId),
          },
        },
        { $group: { _id: "$userId", count: { $sum: 1 } } },
        { $count: "uniqueUserIds" },
      ]);

      const totalPackages = await Package.countDocuments({
        donationId: companyId,
      });
      res.json({
        totalAmount,
        totalDonors: uniqueUserDocs.length > 0 ? uniqueUserDocs[0].uniqueUserIds : 0,
        totalPackages,
      });
    } catch (error) {
      next(error);
    }
  },
  async donorsList(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const donationsPerPage = 10;

      // Get today's date
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get yesterday's date
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Find donations made today
      const todayDonations = await DonorList.find({
        createdAt: { $gte: today },
      })
        .populate("userId")
        .sort({ createdAt: -1 })
        .limit(donationsPerPage);

      // Find donations made yesterday
      const yesterdayDonations = await DonorList.find({
        createdAt: { $gte: yesterday, $lt: today },
      })
        .populate("userId")
        .sort({ createdAt: -1 })
        .limit(donationsPerPage);

      // Paginate the donations for today
      const todayTotalDonations = todayDonations.length;
      const todayTotalPages = Math.ceil(todayTotalDonations / donationsPerPage);
      const todaySkip = (page - 1) * donationsPerPage;
      const todayPaginatedDonations = todayDonations.slice(
        todaySkip,
        todaySkip + donationsPerPage
      );

      // Paginate the donations for yesterday
      const yesterdayTotalDonations = yesterdayDonations.length;
      const yesterdayTotalPages = Math.ceil(
        yesterdayTotalDonations / donationsPerPage
      );
      const yesterdaySkip = (page - 1) * donationsPerPage;
      const yesterdayPaginatedDonations = yesterdayDonations.slice(
        yesterdaySkip,
        yesterdaySkip + donationsPerPage
      );

      let todayPreviousPage = page > 1 ? page - 1 : null;
      let todayNextPage = page < todayTotalPages ? page + 1 : null;

      let yesterdayPreviousPage = page > 1 ? page - 1 : null;
      let yesterdayNextPage = page < yesterdayTotalPages ? page + 1 : null;

      return res.status(200).json({
        todayDonations: {
          donations: todayPaginatedDonations,
          auth: true,
          todayTotalPages,
          previousPage: todayPreviousPage,
          nextPage: todayNextPage,
        },
        yesterdayDonations: {
          donations: yesterdayPaginatedDonations,
          auth: true,
          yesterdayTotalPages,
          previousPage: yesterdayPreviousPage,
          nextPage: yesterdayNextPage,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
  async graph(req, res, next) {
    try {
      // Calculate date ranges for the current week (including previous 7 days) and previous week
      const today = moment().startOf("day");
      const currentWeekStart = moment(today).subtract(7, "days").startOf("day");
      const currentWeekEnd = moment(today).endOf("day");
      const previousWeekStart = moment(currentWeekStart).subtract(7, "days");
      const previousWeekEnd = moment(currentWeekStart).subtract(1, "days");

      // Fetch data for the current week (including previous 7 days)
      const currentWeekData = await getAmountCountForWeek(
        req.user._id,
        currentWeekStart,
        currentWeekEnd
      );

      res.json({ currentWeekData });
    } catch (error) {
      next(error);
    }
  },
  async topDonors(req, res, next) {
    try {
      const companyId = req.user._id; // Assuming company ID is stored in req.user._id
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const donationsPerPage = 10;

      // Get the total number of donations associated with the company
      const totalDonations = await DonorList.countDocuments({
        companyId: companyId,
      });

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalDonations / donationsPerPage);

      // Calculate the number of donations to skip based on the current page
      const skip = (page - 1) * donationsPerPage;

      // Find donations associated with the company, sorted by createdAt field in descending order
      const donations = await DonorList.find({ companyId: companyId })
        .sort({ donationAmount: -1 }) // Sort by highest donation amount
        .populate("userId") // Populate user details
        .skip(skip)
        .limit(donationsPerPage);

      // Determine previous and next page numbers
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      // Send response
      return res.status(200).json({
        donations: donations,
        auth: true,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = docDashController;
