const Order = require("../../models/order");
const moment = require("moment");
const Notification = require("../../models/notification");

const labDashController = {
  async getNotifications(req, res, next) {
    try {
      const receiverId = req.query.id;
      const page = parseInt(req.query.page) || 1;
      const notificationsPerPage = 10;

      // Get the total number of notifications for the receiver
      const totalNotification = await Notification.count({ receiverId });

      // Calculate the total number of pages based on the number of notifications per page
      const totalPages = Math.ceil(totalNotification / notificationsPerPage);

      const skip = (page - 1) * notificationsPerPage;

      // Fetch the notifications for the receiver
      const notifications = await Notification.find({ receiverId })
        .populate({
          path: "senderId",
          select: "name logo description", // Only populate the name field
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(notificationsPerPage);

      // Calculate previous and next page numbers
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        notifications,
        totalNotification,
        auth: true,
        previousPage,
        nextPage,
        totalPages,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = labDashController;
