const vehicleRequest = require("../../models/Rent A Car/vehicleRequest");
const moment = require("moment");
const acceptedRequests = require("../../models/Rent A Car/acceptedRequests");
const vehicle = require("../../models/Rent A Car/vehicle")
const PaymentToVendor = require("../../models/Admin/paymentToVendors");
const mongoose = require("mongoose");

async function getCustomerCountsForMonths(rentACarId, startDate, endDate) {
  const months = [];
  let currentDate = moment(startDate);

  while (currentDate.isSameOrBefore(endDate)) {
    const nextMonth = moment(currentDate).endOf("month");
    // Modify this query based on your actual data structure
    const distinctCustomerIds = await acceptedRequests.distinct("userId", {
      createdAt: { $gte: currentDate, $lt: nextMonth },
      rentACarId: rentACarId,
    });

    const customersCount = distinctCustomerIds.length;

    months.push({
      month: currentDate.format("YYYY-MM"),
      customersCount,
    });

    currentDate.add(1, "months");
  }

  return months;
}
const rentCarDashController = {
  async dashDetails(req, res, next) {
    try {
      const rentACarId = req.user._id;

      //.......todayRequestCount......///
      const todayRequestCount = await acceptedRequests.countDocuments({
        // createdAt:{ $gte: startOfDay, $lt: endOfDay },
        rentACarId,
        status: { $in: ["pending", "OnRoute"] }
      });

      const historyCount = await acceptedRequests.countDocuments({
        rentACarId,
        status: "completed"
      });

        const totalVehicles = await vehicle.countDocuments({rentACarId})
        const totalPayments = await PaymentToVendor.countDocuments({vendorId: rentACarId})

      res.json({
        totalOrders: todayRequestCount,
        totalVehicles: totalVehicles,
        historyCount: historyCount,
        totalPayments: totalPayments,
      });
    } catch (error) {
      next(error);
    }
  },

  // In your main graph function
  async graph(req, res, next) {
    try {
      const today = moment().startOf("day");
      const last12MonthsStart = moment(today)
        .subtract(11, "months")
        .startOf("month");
      const last12MonthsEnd = moment(today).endOf("day");
      console.log(last12MonthsStart);

      // Fetch data for the last 12 months
      const last12MonthsData = await getCustomerCountsForMonths(
        req.user._id,
        last12MonthsStart,
        last12MonthsEnd
      );

      res.json({ last12MonthsData });
    } catch (error) {
      next(error);
    }
  },
};
module.exports = rentCarDashController;
