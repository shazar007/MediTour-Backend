const InsuranceRequests = require("../../models/Insurance/insuranceRequest");
const InsuranceBooking = require("../../models/Insurance/insuranceBooking");
const moment = require("moment");

const insuranceGeneralController = {
  async dashDetails(req, res, next) {
    try {
      const insuranceCompanyId = req.user._id;

      const currentDate = new Date();
      const tomorrow = moment(currentDate).add(1, "days");
      // Set the time to the beginning of the day
      currentDate.setHours(0, 0, 0, 0);

      // Calculate yesterday's date
      const yesterdayDate = new Date(currentDate);
      yesterdayDate.setDate(currentDate.getDate() - 1);

      // Set the time to the beginning of yesterday
      yesterdayDate.setHours(0, 0, 0, 0);

      const dayBeforeYesterday = new Date(currentDate);
      dayBeforeYesterday.setDate(currentDate.getDate() - 2);

      // Set the time to the beginning of the day before yesterday
      dayBeforeYesterday.setHours(0, 0, 0, 0);

      const todayRequestCount = await InsuranceRequests.countDocuments({
        createdAt: { $gte: currentDate, $lt: new Date() },
        insuranceCompanyId,
      });
      const todayCustomerCount = await InsuranceBooking.countDocuments({
        createdAt: { $gte: currentDate, $lt: new Date() },
        insuranceCompanyId,
      });

      const today = moment().startOf("day");
      const lastWeek = moment().subtract(7, "days");

      const travelPayments = await InsuranceBooking.aggregate([
        {
          $match: {
            insuranceType: "travel",
            insuranceCompanyId,
            createdAt: { $gte: lastWeek.toDate(), $lt: tomorrow.toDate() },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);
      travelPayments.sort((a, b) => a._id.localeCompare(b._id));

      const healthPayments = await InsuranceBooking.aggregate([
        {
          $match: {
            insuranceType: "health",
            insuranceCompanyId,
            createdAt: { $gte: lastWeek.toDate(), $lt: tomorrow.toDate() },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);
      healthPayments.sort((a, b) => a._id.localeCompare(b._id));

      const totalTravelPayments = travelPayments.reduce(
        (acc, curr) => acc + curr.totalAmount,
        0
      );

      const totalHealthPayments = healthPayments.reduce(
        (acc, curr) => acc + curr.totalAmount,
        0
      );
      const totalRevenue = totalTravelPayments + totalHealthPayments;

      return res.json({
        todayRequestCount,
        todayCustomerCount,
        travelPayments,
        healthPayments,
        totalTravelPayments,
        totalHealthPayments,
        totalRevenue,
      });
    } catch (error) {
      next(error);
    }
  },

  async customerStats(req, res, next) {
    try {
      const insuranceCompanyId = req.user._id;

      const currentMonth = moment().startOf("month");
      const lastTwelveMonths = Array.from({ length: 12 }).map((_, index) =>
        moment(currentMonth).subtract(index, "months")
      );

      const stats = await Promise.all(
        lastTwelveMonths.map(async (month) => {
          const startDate = month.clone().startOf("month").toDate();
          const endDate = month.clone().endOf("month").toDate();
          // Count new customers
          const newCustomersCount = await InsuranceBooking.distinct("userId", {
            createdAt: {
              $gte: startDate,
              $lte: endDate,
            },
            insuranceCompanyId,
          }).countDocuments();

          const distinctUsersCurrentMonth = await InsuranceBooking.distinct(
            "userId",
            {
              createdAt: {
                $gte: startDate,
                $lte: endDate,
              },
              insuranceCompanyId,
            }
          );

          let previousCustomersCount = 0;

          for (const userId of distinctUsersCurrentMonth) {
            const previousBookingsCount = await InsuranceBooking.countDocuments(
              {
                userId,
                createdAt: {
                  $lt: startDate,
                },
              }
            );

            if (previousBookingsCount > 0) {
              previousCustomersCount++;
            }
          }

          return {
            month: month.format("YYYY-MM"),
            newCustomers: newCustomersCount,
            previousCustomers: previousCustomersCount,
          };
        })
      );
      stats.reverse();

      res.json(stats);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = insuranceGeneralController;
