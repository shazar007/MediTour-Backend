const Doctor = require("../../models/Doctor/doctors");
const ParamedicRequest = require("../../models/Paramedic/request");
const Admin = require("../../models/Admin/Admin");
const Notification = require("../../models/notification");
const { sendchatNotification } = require("../../firebase/service/index.js");

const userParamedicController = {
  async addParamedicRequest(req, res, next) {
    try {
      const {
        name,
        email,
        contact,
        address,
        gender,
        preferredDate,
        preferredTime,
        userArea,
        schedule,
        customSchedule,
        remarks,
      } = req.body;
      const userId = req.user._id;
      const paramedicRequest = new ParamedicRequest({
        userId,
        name,
        email,
        contact,
        address,
        gender,
        preferredDate,
        preferredTime,
        userArea,
        schedule,
        customSchedule,
        remarks,
      });

      // Save the new appointment to the database
      const savedRequest = await paramedicRequest.save();
      const notificationMessage = `We have a new paramedic reservation.`;
      const admins = await Admin.find({});
      const notifications = admins.map((admin) => ({
        senderId: userId,
        senderModelType: "Users",
        receiverId: admin._id,
        receiverModelType: "Admin",
        title: "MediTour Global",
        message: notificationMessage,
        createdAt: new Date(),
      }));

      await Notification.insertMany(notifications);

      admins.forEach((admin) => {
        sendchatNotification(
          admin._id,
          {
            title: "MediTour Global",
            message: notificationMessage,
          },
          "admin"
        );
      });

      res.status(201).json({
        auth: true,
        paramedicReservation: savedRequest,
      });
    } catch (error) {
      return next(error);
    }
  },

  async getParamedicRequests(req, res, next) {
    try {
      const userId = req.user._id;
      const page = parseInt(req.query.page) || 1;
      const requestsPerPage = 10;
      const status = req.query.status;

      const totalRequests = await ParamedicRequest.countDocuments({
        status,
        userId
      });

      const totalPages = Math.ceil(totalRequests / requestsPerPage);

      const skip = (page - 1) * requestsPerPage;
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      const allRequests = await ParamedicRequest.find({ status, userId })
        .sort({ createdAt: -1 })
        .populate({
          path: "userId",
          select: "name email gender mrNo phone dateOfBirth"
        })
        .skip(skip)
        .limit(requestsPerPage);

      return res.status(200).json({
        paramedicRequests: allRequests,
        requestsLength: allRequests.length,
        previousPage: previousPage,
        totalPages: totalPages,
        nextPage: nextPage,
        auth: true,
      });
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },
};

module.exports = userParamedicController;
