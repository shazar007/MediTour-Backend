const Order = require("../../models/order");
const Laboratory = require("../../models/Laboratory/laboratory")
const Tests = require("../../models/Laboratory/tests");
const PaymentToVendor = require("../../models/Admin/paymentToVendors");
const moment = require("moment");
const mongoose = require("mongoose");

async function getOrderCountsForWeek(vendorId, startDate, endDate) {
  const days = [];
  let currentDate = moment(startDate);

  while (currentDate.isSameOrBefore(endDate)) {
    const nextDate = moment(currentDate).endOf("day");
    // Modify this query based on your actual data structure
    const ordersCount = await Order.find({
      createdAt: { $gte: currentDate, $lt: nextDate },
      vendorId: vendorId,
    }).countDocuments();

    days.push({
      date: currentDate.format("YYYY-MM-DD"),
      ordersCount,
    });

    currentDate.add(1, "days");
  }

  return days;
}

const labDashController = {
  async dashDetails(req, res, next) {
    try {
      const vendorId = req.user._id;
      // Get the current date
      const currentDate = new Date();

      // Set the time to the beginning of the day
      currentDate.setHours(0, 0, 0, 0);
      // Get the current date
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0); // Start of the day

      // Set the end of the day
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999); // End of the day

      // Calculate yesterday's date
      const yesterdayDate = new Date(currentDate);
      yesterdayDate.setDate(currentDate.getDate() - 1);

      // Set the time to the beginning of yesterday
      yesterdayDate.setHours(0, 0, 0, 0);

      const dayBeforeYesterday = new Date(currentDate);
      dayBeforeYesterday.setDate(currentDate.getDate() - 2);

      // Set the time to the beginning of the day before yesterday
      dayBeforeYesterday.setHours(0, 0, 0, 0);

      // Fetch the count of orders for the day before yesterday
      const penDayBefYesCount = await Order.countDocuments({
        createdAt: { $gte: dayBeforeYesterday, $lt: yesterdayDate },
        status: "pending",
        vendorId,
      });
      // Fetch the count of orders for yesterday
      const yesterdayOrdersCount = await Order.countDocuments({
        createdAt: { $gte: yesterdayDate, $lt: currentDate },
        vendorId,
      });

      const pendingYesOrdersCount = await Order.countDocuments({
        // createdAt: { $gte: yesterdayDate, $lt: currentDate },
        status: "pending",
        vendorId,
      });

      // Fetch the count of orders for today
      const todayOrdersCount = await Order.countDocuments({
        // createdAt: { $gte: startOfDay, $lt: endOfDay },
        vendorId,
      });

      const completeTodayOrdersCount = await Order.countDocuments({
        // createdAt: { $gte: startOfDay, $lt: endOfDay },
        status: "completed",
        vendorId,
      });

      const completeYesOrdersCount = await Order.countDocuments({
        createdAt: { $gte: yesterdayDate, $lt: currentDate },
        status: "completed",
        vendorId,
      });

      let pendingPercentageChange;
      if (penDayBefYesCount === 0) {
        pendingPercentageChange = pendingYesOrdersCount * 100 + "%"; // If the day before yesterday's orders are zero, the change is undefined
      } else {
        pendingPercentageChange =
          (
            ((pendingYesOrdersCount - penDayBefYesCount) / penDayBefYesCount) *
            100
          ).toFixed(2) + "%";
      }

      // Handle the case where yesterday's orders are zero
      let newOrdersPercentageChange;
      if (yesterdayOrdersCount === 0) {
        newOrdersPercentageChange = todayOrdersCount * 100 + "%"; // If yesterday's orders are zero, the change is undefined
      } else {
        newOrdersPercentageChange =
          (
            ((todayOrdersCount - yesterdayOrdersCount) / yesterdayOrdersCount) *
            100
          ).toFixed(2) + "%";
      }

      let comOrdersPercentageChange;
      if (completeYesOrdersCount === 0) {
        comOrdersPercentageChange = completeTodayOrdersCount * 100 + "%"; // If yesterday's orders are zero, the change is undefined
      } else {
        comOrdersPercentageChange =
          (
            ((completeTodayOrdersCount - completeYesOrdersCount) /
              completeYesOrdersCount) *
            100
          ).toFixed(2) + "%";
      }
      const testCounts = await Tests.countDocuments({ labId: vendorId });
      const resultCount = await Order.countDocuments({
        results: { $exists: true },
        vendorId: vendorId, // Ensure `vendorId` is defined properly
        // createdAt: { $gte: startOfDay, $lt: endOfDay },
      });
      const yesterdayResultCount = await Order.countDocuments({
        results: { $exists: true },
        vendorId: vendorId, // Ensure `vendorId` is defined properly
        createdAt: { $gte: yesterdayDate, $lt: currentDate },
      });
      let resultPercentageChange;
      if (yesterdayResultCount === 0) {
        resultPercentageChange = resultCount * 100 + "%"; // If yesterday's result count is zero, the change is undefined
      } else {
        resultPercentageChange =
          (
            ((resultCount - yesterdayResultCount) / yesterdayResultCount) *
            100
          ).toFixed(2) + "%";
      }

      const result = await PaymentToVendor.aggregate([
        {
          $match: { vendorId: mongoose.Types.ObjectId(vendorId) },
        },
        {
          $group: {
            _id: "$vendorId",
            totalPayableAmount: { $sum: "$payableAmount" },
          },
        },
      ]);

      const labCount = await Laboratory.countDocuments({ mainLab: vendorId });

      // Extract the totalPayableAmount from the result
      const totalPayableAmount =
        result.length > 0 ? result[0].totalPayableAmount : 0;
      res.json({
        todayOrdersCount,
        newOrdersPercentageChange,
        pendingYesOrdersCount,
        pendingPercentageChange,
        completeTodayOrdersCount,
        comOrdersPercentageChange,
        totalTests: resultPercentageChange,
        resultCount: resultCount,
        testCounts,
        yesterdayResultCount,
        totalPayableAmount,
        labCount
      });
    } catch (error) {
      next(error);
    }
  },

  async graph(req, res, next) {
    try {
      // Calculate date ranges for the current week (including previous 7 days) and previous week
      const today = moment().startOf("day");
      // For the current week (today + next 7 days)
      const currentWeekStart = moment(today).startOf("day"); // Today
      const currentWeekEnd = moment(today).add(7, "days").endOf("day"); // 7 days ahead

      // For the previous week (today - 7 days to yesterday)
      const previousWeekStart = moment(today)
        .subtract(7, "days")
        .startOf("day"); // 7 days before today
      const previousWeekEnd = moment(today).subtract(1, "days").endOf("day"); // Yesterday
      // Fetch data for the current week (including previous 7 days)
      const currentWeekData = await getOrderCountsForWeek(
        req.user._id,
        currentWeekStart,
        currentWeekEnd
      );

      // Fetch data for the previous week
      const previousWeekData = await getOrderCountsForWeek(
        req.user._id,
        previousWeekStart,
        previousWeekEnd
      );

      res.json({ currentWeekData, previousWeekData });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = labDashController;
