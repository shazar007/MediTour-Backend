const Doctor = require("../../models/Doctor/doctors.js");
const User = require("../../models/User/user.js");
const Appointment = require("../../models/All Doctors Models/appointment.js");
const PaymentToVendor = require("../../models/Admin/paymentToVendors");
const mongoose = require("mongoose");
const moment = require("moment");

async function getAppCountForWeek(docId, startDate, endDate) {
  const days = [];
  let currentDate = moment(startDate);

  while (currentDate.isSameOrBefore(endDate)) {
    const nextDate = moment(currentDate).endOf("day");
    // Modify this query based on your actual data structure
    const appointmentCount = await Appointment.find({
      createdAt: { $gte: currentDate, $lt: nextDate },
      doctorId: docId,
    }).countDocuments();

    days.push({
      date: currentDate.format("YYYY-MM-DD"),
      appointmentCount,
    });

    currentDate.add(1, "days");
  }

  return days;
}

const docDashController = {
  async dashDetails(req, res, next) {
    try {
      const doctorId = req.user._id;
      // Find the doctor by ID
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json([]);
      }

      const doctorName = doctor.name;
      const doctorImage = doctor.doctorImage;

      // Find the latest upcoming appointment
      const upcomingAppointment = await Appointment.findOne({
        doctorId,
        status: "pending",
      })
        .populate("patientId doctorId")
        .sort({ appointmentDateAndTime: 1 })
        .limit(1);

      let patientName = null;
      if (upcomingAppointment && upcomingAppointment.patientId) {
        const patientId =
          upcomingAppointment.patientId._id || upcomingAppointment.patientId; // handle populated or plain IDs
        const patient = await User.findById(patientId);
        if (patient) {
          patientName = patient.name;
        } else {
          patientName = "Unknown Patient"; // Handle case where patient is not found
        }
      }
      const currentDate = new Date();
      // Set the time to the beginning of the day
      currentDate.setHours(0, 0, 0, 0);
      console.log("currentDate", currentDate);
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
      const dayOfWeek = currentDate.getDay(); // tody (0-6, Sunday=0, Monday=1, etc.)
 
      const weekStartDate = new Date(currentDate);
      weekStartDate.setDate(currentDate.getDate() - dayOfWeek - 7); // 7 din peechay chalay jao aur haftay ka start dhoondo''

       // Calculate date ranges for the current week (including previous 7 days) and previous week
            const today = moment().startOf("day");
            // For the current week (today + next 7 days)
            const currentWeekStart = moment(today).startOf("day"); // Today
            const currentWeekEnd = moment(today).add(7, "days").endOf("day"); // 7 days ahead

      // Set the time to the beginning of the week
      weekStartDate.setHours(0, 0, 0, 0);

      const lastWeekStartDate = new Date(currentDate);
      lastWeekStartDate.setDate(currentDate.getDate() - 14);

      // Set the time to the beginning of the week
      lastWeekStartDate.setHours(0, 0, 0, 0);

      const duration = req.query.duration;
      if (!duration) {
        const error = {
          status: 400,
          message: "Duration Period Missing",
        };

        return next(error);
      }

      if (duration == "today") {
        const todayPatientCount = await Appointment.find({
          appointmentDateAndTime: { $gte: startOfDay, $lt: endOfDay },
          doctorId,
        })
          .distinct("patientId")
          .then((patientIds) => patientIds.length);

        const yesPatientCount = await Appointment.find({
          appointmentDateAndTime: { $gte: yesterdayDate, $lt: currentDate },
          doctorId,
        })
          .distinct("patientId")
          .then((patientIds) => patientIds.length);

        let patientPercentageChange;
        if (yesPatientCount === 0) {
          patientPercentageChange = todayPatientCount * 100; // If last week's orders are zero, the change is undefined
        } else {
          patientPercentageChange = (
            ((todayPatientCount - yesPatientCount) / yesPatientCount) *
            100
          ).toFixed(2);
        }

        if (patientPercentageChange > 0) {
          patientPercentageChange = "+" + patientPercentageChange + "%";
        } else {
          patientPercentageChange = patientPercentageChange + "%";
        }

        const todayAppointCount = await Appointment.countDocuments({
          appointmentDateAndTime: { $gte: startOfDay, $lt: endOfDay },
          doctorId,
          status: "pending",
        });

        const yesAppointCount = await Appointment.countDocuments({
          appointmentDateAndTime: { $gte: yesterdayDate, $lt: currentDate },
          doctorId,
        });

        let appointmentPercentageChange;
        if (yesAppointCount === 0) {
          appointmentPercentageChange = todayAppointCount * 100; // If last week's orders are zero, the change is undefined
        } else {
          appointmentPercentageChange = (
            ((todayAppointCount - yesAppointCount) / yesAppointCount) *
            100
          ).toFixed(2);
        }

        if (appointmentPercentageChange > 0) {
          appointmentPercentageChange = "+" + appointmentPercentageChange + "%";
        } else {
          appointmentPercentageChange = appointmentPercentageChange + "%";
        }

        const todayCuredPatientCount = await Appointment.distinct("patientId", {
          appointmentDateAndTime: { $gte: startOfDay, $lt: endOfDay },
          doctorId,
          status: "completed",
        }).countDocuments();

        const yesCuredPatientCount = await Appointment.countDocuments({
          appointmentDateAndTime: { $gte: yesterdayDate, $lt: currentDate },
          doctorId,
          status: "completed",
        }).countDocuments();

        let curedPercentageChange;
        if (yesCuredPatientCount === 0) {
          curedPercentageChange = todayCuredPatientCount * 100; // If last week's orders are zero, the change is undefined
        } else {
          curedPercentageChange = (
            ((todayCuredPatientCount - yesCuredPatientCount) /
              yesCuredPatientCount) *
            100
          ).toFixed(2);
        }

        if (curedPercentageChange > 0) {
          curedPercentageChange = "+" + curedPercentageChange + "%";
        } else {
          curedPercentageChange = curedPercentageChange + "%";
        }

        const todayWaitingPatients = await Appointment.distinct("patientId", {
          appointmentDateAndTime: { $gte: currentDate, $lt: new Date() },
          doctorId,
          status: "pending",
        }).countDocuments();

        const yesWaitingPatients = await Appointment.countDocuments({
          appointmentDateAndTime: { $gte: yesterdayDate, $lt: currentDate },
          doctorId,
          status: "pending",
        }).countDocuments();

        let waitingPercentageChange;
        if (yesWaitingPatients === 0) {
          waitingPercentageChange = todayWaitingPatients * 100; // If last week's orders are zero, the change is undefined
        } else {
          waitingPercentageChange = (
            ((todayWaitingPatients - yesWaitingPatients) / yesWaitingPatients) *
            100
          ).toFixed(2);
        }

        if (waitingPercentageChange > 0) {
          waitingPercentageChange = "+" + waitingPercentageChange + "%";
        } else {
          waitingPercentageChange = waitingPercentageChange + "%";
        }
        const result = await PaymentToVendor.aggregate([
          {
            $match: {
              vendorId: mongoose.Types.ObjectId(doctorId),
              createdAt: { $gte: currentDate, $lt: new Date() },
            },
          },
          {
            $group: {
              _id: "$vendorId",
              totalPayableAmount: { $sum: "$payableAmount" },
            },
          },
        ]);

        // Extract the totalPayableAmount from the result
        const totalPayableAmount =
          result.length > 0 ? result[0].totalPayableAmount : 0;

        return res.json({
          doctorName: doctorName,
          upcomingAppointment: upcomingAppointment,
          patientCount: todayPatientCount,
          patientPercentageChange: patientPercentageChange,
          appointmentCount: todayAppointCount,
          appointmentPercentageChange: appointmentPercentageChange,
          waitingPatients: todayWaitingPatients,
          waitingPercentageChange,
          curedPatientCount: todayCuredPatientCount,
          curedPercentageChange,
          totalPayableAmount,
        });
      } else if (duration == "week") {
        const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999); // Ensure we capture up to the end of the day
        const weekPatientCount = await Appointment.find({
          appointmentDateAndTime: { $gte: currentWeekStart, $lt: currentWeekEnd},
          doctorId,
        })
          .distinct("patientId")
          .then((patientIds) => patientIds.length);

        const lastWeekPatientCount = await Appointment.find({
          appointmentDateAndTime: {
            $gte: lastWeekStartDate,
            $lt: weekStartDate,
          },
          doctorId,
        })
          .distinct("patientId")
          .then((patientIds) => patientIds.length);

        let patientPercentageChange;
        if (lastWeekPatientCount === 0) {
          patientPercentageChange = weekPatientCount * 100; // If last week's orders are zero, the change is undefined
        } else {
          patientPercentageChange = (
            ((weekPatientCount - lastWeekPatientCount) / lastWeekPatientCount) *
            100
          ).toFixed(2);
        }
        if (patientPercentageChange > 0) {
          patientPercentageChange = "+" + patientPercentageChange + "%";
        } else {
          patientPercentageChange = patientPercentageChange + "%";
        }

        const weekAppointCount = await Appointment.countDocuments({
          appointmentDateAndTime: { $gte: currentWeekStart, $lt: currentWeekEnd},
          doctorId,
        });

        const lastWeekAppointCount = await Appointment.countDocuments({
          appointmentDateAndTime: {
            $gte: lastWeekStartDate,
            $lt: weekStartDate,
          },
          doctorId,
        });

        let appointmentPercentageChange;
        if (lastWeekAppointCount === 0) {
          appointmentPercentageChange = weekAppointCount * 100; // If last week's orders are zero, the change is undefined
        } else {
          appointmentPercentageChange = (
            ((weekAppointCount - lastWeekAppointCount) / lastWeekAppointCount) *
            100
          ).toFixed(2);
        }

        if (appointmentPercentageChange > 0) {
          appointmentPercentageChange = "+" + appointmentPercentageChange + "%";
        } else {
          appointmentPercentageChange = appointmentPercentageChange + "%";
        }

        const weekCuredPatientCount = await Appointment.distinct("patientId", {
          appointmentDateAndTime: { $gte: weekStartDate, $lt: endOfDay },
          doctorId,
          status: "completed",
        }).countDocuments();

        const lastWeekCuredPatientcount = await Appointment.countDocuments({
          appointmentDateAndTime: {
            $gte: lastWeekStartDate,
            $lt: weekStartDate,
          },
          doctorId,
          status: "completed",
        }).countDocuments();

        let curedPercentageChange;
        if (lastWeekCuredPatientcount === 0) {
          curedPercentageChange = weekCuredPatientCount * 100; // If last week's orders are zero, the change is undefined
        } else {
          curedPercentageChange = (
            ((weekCuredPatientCount - lastWeekCuredPatientcount) /
              lastWeekCuredPatientcount) *
            100
          ).toFixed(2);
        }

        if (curedPercentageChange > 0) {
          curedPercentageChange = "+" + curedPercentageChange + "%";
        } else {
          curedPercentageChange = curedPercentageChange + "%";
        }

        const weekWaitingPatients = await Appointment.distinct("patientId", {
          appointmentDateAndTime: { $gte: currentDate, $lt: new Date() },
          doctorId,
          status: "completed",
        }).countDocuments();

        const lastWeekWaitingPatients = await Appointment.countDocuments({
          appointmentDateAndTime: { $gte: yesterdayDate, $lt: currentDate },
          doctorId,
          status: "completed",
        }).countDocuments();

        let waitingPercentageChange;
        if (lastWeekWaitingPatients === 0) {
          waitingPercentageChange = weekWaitingPatients * 100; // If last week's orders are zero, the change is undefined
        } else {
          waitingPercentageChange = (
            ((weekWaitingPatients - lastWeekWaitingPatients) /
              lastWeekWaitingPatients) *
            100
          ).toFixed(2);
        }

        if (waitingPercentageChange > 0) {
          waitingPercentageChange = "+" + waitingPercentageChange + "%";
        } else {
          waitingPercentageChange = waitingPercentageChange + "%";
        }
        const result = await PaymentToVendor.aggregate([
          {
            $match: {
              vendorId: mongoose.Types.ObjectId(doctorId),
              createdAt: { $gte: weekStartDate, $lt: new Date() },
            },
          },
          {
            $group: {
              _id: "$vendorId",
              totalPayableAmount: { $sum: "$payableAmount" },
            },
          },
        ]);

        // Extract the totalPayableAmount from the result
        const totalPayableAmount =
          result.length > 0 ? result[0].totalPayableAmount : 0;
        return res.json({
          doctorName: doctorName,
          upcomingAppointment: upcomingAppointment,
          patientCount: weekPatientCount,
          patientPercentageChange: patientPercentageChange,
          appointmentCount: weekAppointCount,
          appointmentPercentageChange: appointmentPercentageChange,
          waitingPatients: weekWaitingPatients,
          waitingPercentageChange,
          curedPatientCount: weekCuredPatientCount,
          curedPercentageChange,
          totalPayableAmount,
        });
      }
    } catch (error) {
      next(error);
    }
  },

  async graph(req, res, next) {
    try {
      // Calculate date ranges for the current week (including previous 7 days) and previous week
      const today = moment().startOf("day");
      const currentWeekStart = moment(today).startOf("day");
      const currentWeekEnd = moment(today).add(7, "days").endOf("day"); // 7 days ahead
      // For the previous week (today - 7 days to yesterday)
      const previousWeekStart = moment(today)
        .subtract(7, "days")
        .startOf("day"); // 7 days before today
      const previousWeekEnd = moment(today).subtract(1, "days").endOf("day"); // Yesterday

      // Fetch data for the current week (including previous 7 days)
      const currentWeekData = await getAppCountForWeek(
        req.user._id,
        currentWeekStart,
        currentWeekEnd
      );

      // Fetch data for the previous week
      const previousWeekData = await getAppCountForWeek(
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

module.exports = docDashController;
