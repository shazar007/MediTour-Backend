const pharmOrder = require("../../models/Pharmacy/medicineRequest");
const PaymentToVendor = require("../../models/Admin/paymentToVendors");
const mongoose = require("mongoose");
const moment = require("moment");

async function getOrderCountsForWeek(pharmId, startDate, endDate) {
  const days = [];
  let currentDate = moment(startDate);

  while (currentDate.isSameOrBefore(endDate)) {
    const nextDate = moment(currentDate).endOf("day");
    // Modify this query based on your actual data structure
    const ordersCount = await pharmOrder
      .find({
        createdAt: { $gte: currentDate, $lt: nextDate },
        vendorId: pharmId,
      })
      .countDocuments();

    days.push({
      date: currentDate.format("YYYY-MM-DD"),
      ordersCount,
    });

    currentDate.add(1, "days");
  }

  return days;
}

const pharmDashController = {
  async dashDetails(req, res, next) {
    try {
      const pharmacyId = req.user._id;
      
      // Get the current date
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0); // Set the time to the beginning of the day
  
      // Calculate yesterday's date
      const yesterdayDate = new Date(currentDate);
      yesterdayDate.setDate(currentDate.getDate() - 1);
      yesterdayDate.setHours(0, 0, 0, 0); // Set the time to the beginning of yesterday
  
      const dayBeforeYesterday = new Date(currentDate);
      dayBeforeYesterday.setDate(currentDate.getDate() - 2);
      dayBeforeYesterday.setHours(0, 0, 0, 0); // Set the time to the beginning of the day before yesterday
  
      // Fetch the count of orders for the day before yesterday
      const penDayBefYesCount = await pharmOrder.countDocuments({
        addedAt: { $gte: dayBeforeYesterday, $lt: yesterdayDate },
        status: "pending",
        pharmacyId,
      });
  
      // Fetch the count of orders for yesterday
      const yesterdayOrdersCount = await pharmOrder.countDocuments({
        addedAt: { $gte: yesterdayDate, $lt: currentDate },
        pharmacyId,
      });
  
      const pendingYesOrdersCount = await pharmOrder.countDocuments({
        addedAt: { $gte: yesterdayDate, $lt: currentDate },
        status: "pending",
        pharmacyId,
      });
  
      // Fetch the count of orders for today
      const todayOrdersCount = await pharmOrder.countDocuments({
        addedAt: { $gte: currentDate, $lt: new Date() },
        pharmacyId,
      });
  
      const completeTodayOrdersCount = await pharmOrder.countDocuments({
        addedAt: { $gte: currentDate, $lt: new Date() },
        status: "completed",
        pharmacyId,
      });
  
      const completeYesOrdersCount = await pharmOrder.countDocuments({
        addedAt: { $gte: yesterdayDate, $lt: currentDate },
        status: "completed",
        pharmacyId,
      });
  
      // Calculate pending percentage change
      let pendingPercentageChange;
      if (penDayBefYesCount === 0) {
        pendingPercentageChange = pendingYesOrdersCount * 100;
      } else {
        pendingPercentageChange = (
          ((pendingYesOrdersCount - penDayBefYesCount) / penDayBefYesCount) *
          100
        ).toFixed(2);
      }
      pendingPercentageChange = pendingPercentageChange > 0 
        ? `+${pendingPercentageChange}%` 
        : `${pendingPercentageChange}%`;
  
      // Calculate new orders percentage change
      let newOrdersPercentageChange;
      if (yesterdayOrdersCount === 0) {
        newOrdersPercentageChange = todayOrdersCount * 100;
      } else {
        newOrdersPercentageChange = (
          ((todayOrdersCount - yesterdayOrdersCount) / yesterdayOrdersCount) *
          100
        ).toFixed(2);
      }
      newOrdersPercentageChange = newOrdersPercentageChange > 0 
        ? `+${newOrdersPercentageChange}%` 
        : `${newOrdersPercentageChange}%`;
  
      // Calculate completed orders percentage change
      let comOrdersPercentageChange;
      if (completeYesOrdersCount === 0) {
        comOrdersPercentageChange = completeTodayOrdersCount * 100;
      } else {
        comOrdersPercentageChange = (
          ((completeTodayOrdersCount - completeYesOrdersCount) / completeYesOrdersCount) *
          100
        ).toFixed(2);
      }
      comOrdersPercentageChange = comOrdersPercentageChange > 0 
        ? `+${comOrdersPercentageChange}%` 
        : `${comOrdersPercentageChange}%`;
  
      // Count the number of orders with `results` field present for today
      const resultCount = await pharmOrder.countDocuments({
        results: { $exists: true },
        pharmacyId,
        addedAt: { $gte: currentDate, $lt: new Date() },
      });
  
      // Get total payable amount using aggregation
      const result = await PaymentToVendor.aggregate([
        {
          $match: { vendorId: mongoose.Types.ObjectId(pharmacyId) },
        },
        {
          $group: {
            _id: "$pharmacyId",
            totalPayableAmount: { $sum: "$payableAmount" },
          },
        },
      ]);
  
      const totalPayableAmount = result.length > 0 ? result[0].totalPayableAmount : 0;
  
      // Send final response
      res.json({
        todayOrdersCount,
        newOrdersPercentageChange,
        pendingYesOrdersCount,
        pendingPercentageChange,
        completeTodayOrdersCount,
        comOrdersPercentageChange,
        resultCount,
        totalPayableAmount,
      });
  
    } catch (error) {
      next(error);
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

module.exports = pharmDashController;
