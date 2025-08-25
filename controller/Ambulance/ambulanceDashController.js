const mongoose = require("mongoose");
const AmbRequest = require("../../models/Ambulance/ambRequest.js");
const BidRequest = require("../../models/Ambulance/bid.js");
const Booking = require("../../models/Ambulance/booking.js");
const moment = require("moment");

const ambulanceDashController = {
  async dashboard(req, res, next) {
    try {
      const ambulanceId = req.user._id;
      const totalRequests = await AmbRequest.countDocuments({
        status: "pending",
      });
      const totalBids = await BidRequest.countDocuments({  status: "pending",ambulanceId });
      const servedPatients = await Booking.aggregate([
        {
          $match: {
            ambulanceId: mongoose.Types.ObjectId(ambulanceId),
            status: "completed", // Added filter for completed bookings
          },
        },
        {
          $group: {
            _id: "$userId", // Group by userId to count unique served patients
          },
        },
        {
          $count: "distinctUserIds", // Count distinct userIds
        },
      ]);
      const recentRequests = await AmbRequest.find({ status: "pending" })
        .populate({ path: "userId", select: "name userImage" })
        .sort({ createdAt: -1 })
        .limit(10);
      return res.status(200).json({
        auth: true,
        totalRequests: totalRequests,
        totalBids: totalBids,
        servedPatients: servedPatients,
        recentRequests: recentRequests,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = ambulanceDashController;
