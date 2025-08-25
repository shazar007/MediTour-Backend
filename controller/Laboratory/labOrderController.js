const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const Order = require("../../models/order.js");
const orderDto = require("../../dto/labOrder.js");
const moment = require("moment");
const Tests = require("../../models/Laboratory/tests.js");
const Laboratory = require("../../models/Laboratory/laboratory.js");
const { sendchatNotification } = require("../../firebase/service/index.js");
const Appointment = require("../../models/All Doctors Models/appointment");
// const Eprescription = require("../../models/All Doctors Models/ePrescription.js");
const Notification = require("../../models/notification.js");
const ePrescription = require("../../models/All Doctors Models/ePrescription.js");
const order = require("../../models/order.js");

async function getOrderCountsForWeek(labId, startDate, endDate) {
  const days = [];
  let currentDate = moment(startDate);

  while (currentDate.isSameOrBefore(endDate)) {
    const nextDate = moment(currentDate).endOf("day");
    // Modify this query based on your actual data structure
    const ordersCount = await Order.find({
      createdAt: { $gte: currentDate, $lt: nextDate },
      labId: labId,
    }).countDocuments();

    days.push({
      date: currentDate.format("YYYY-MM-DD"),
      ordersCount,
    });
    currentDate.add(1, "days");
  }

  return days;
}

const labOrderController = {
  async getLabOrders(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const ordersPerPage = 10;
      const vendorId = req.user._id;

      const totalOrders = await Order.countDocuments({
        vendorId,
        status: { $ne: "completed" },
      });
      const totalPages = Math.ceil(totalOrders / ordersPerPage);
      const skip = (page - 1) * ordersPerPage;

      const allOrders = await Order.find({
        vendorId,
        status: { $ne: "completed" },
      })
        .populate({
          path: "items.itemId", // Populate the itemId in items array
          populate: {
            path: "testNameId", // Populate the testNameId in the populated itemId (Tests model)
            select: "name categoryName", // Select the name and categoryName fields from TestName
          },
        })
        .populate({
          path: "userId",
          select: "phone email",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(ordersPerPage)
        .lean(); // Convert to plain JavaScript objects
      
      // Add items count field
      const ordersWithItemCount = allOrders.map(order => ({
        ...order,
        itemsCount: order.items.length, // Count the number of items in the array
      }));
      
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        orders: ordersWithItemCount,
        auth: true,
        totalOrders,
        previousPage,
        nextPage,
        totalPages,
      });
    } catch (error) {
      return res.status(500).json([]);
    }
  },
  async getLabOrder(req, res, next) {
    try {
      const orderId = req.query.orderId;
      const order = await Order.findById(orderId)
        .populate({
          path: "items.itemId", // Populate the itemId in items array
          populate: {
            path: "testNameId", // Populate the testNameId in the populated itemId (Tests model)
            select: "name categoryName", // Select the name and categoryName fields from TestName
          },
        })
        .populate({
          path: "userId",
          select: "gender bloodGroup dateOfBirth phone userImage",
        })
        .populate("vendorId");

      if (!order) {
        return res.status(404).json([]);
      }

      return res.status(200).json({ order });
    } catch (error) {
      return next(error);
    }
  },
  async changeStatus(req, res, next) {
    try {
      const newStatus = req.body.status;
      const labId = req.user._id;
      const id = req.query.id;

      if (!newStatus) {
        return res.status(400).json({
          status: 400,
          message: "Status not found",
        });
      }

      const order = await Order.findById(id);

      if (!order) {
        return res.status(404).json([]);
      }

      // If the status is being changed to "completed", check if results are uploaded
      if (newStatus === "completed") {
          if (!order.results) {
            return res.status(400).json({
              status: 400,
              message: `Please upload the result first.`,
            });
          }
        }

      // Update the order status
      const updatedOrder = await Order.findByIdAndUpdate(
        id,
        { $set: { status: newStatus } },
        { new: true }
      );

      if (newStatus === "completed") {
        // Log the notification action
        sendchatNotification(
          order.userId,
          {
            title: "MediTour Global",
            message: "Your order has been completed!",
          },
          "user"
        );

        const notification = new Notification({
          senderId: labId,
          senderModelType: "Laboratory",
          receiverId: order.userId,
          receiverModelType: "Users",
          title: "MediTour Global",
          message: "Your order has been completed!",
        });
        await notification.save();
      } else if (newStatus === "inProcess") {
        sendchatNotification(
          order.userId,
          {
            title: "MediTour Global",
            message: 'Your order status changed to "inProcess"',
          },
          "user"
        );

        const notification = new Notification({
          senderId: labId,
          senderModelType: "Laboratory",
          receiverId: order.userId,
          receiverModelType: "Users",
          title: "MediTour Global",
          message: 'Your order status changed to "inProcess"',
        });
        await notification.save();
      }

      return res.status(200).json({
        auth: true,
        message: "Status changed successfully",
        order: updatedOrder,
      });
    } catch (error) {
      return next(error);
    }
  },
  async saveResult(req, res, next) {
    try {
      const { resultUrl } = req.body;
      const { orderId } = req.query;
      const labId = req.user._id;

      // Fetch the order
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json([]);
      }

      // Add result URL to the results field in the Order document
      order.results = resultUrl;
      // Optionally, you might want to clear the items array if it's no longer needed
      // order.items = [];
      await order.save();

      // Find the lab details
      const lab = await Laboratory.findById(labId);
      if (!lab) {
        return res.status(404).json([]);
      }

      // Send notification to the user
      sendchatNotification(
        order.userId,
        {
          title: "MediTour Global",
          message: `${lab.name} has uploaded the result for your test`,
        },
        "user"
      );
      const notification = new Notification({
        senderId: labId,
        senderModelType: "Laboratory",
        receiverId: order.userId,
        receiverModelType: "Users",
        title: "MediTour Global",
        message: `${lab.name} has uploaded the result for your test`,
      });
      await notification.save();

      return res.status(200).json({
        auth: true,
        message: "Result uploaded successfully!",
      });
    } catch (error) {
      return next(error);
    }
  },
  async saveUserLabResult(req, res, next) {
    try {
      const { resultUrl } = req.body;
      const { appointmentId, testName } = req.query;
      const labId = req.user._id;

      // Fetch the appointment
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json([]);
      }

      const ePrescriptionId = appointment.ePrescription;

      // Update the specific test result in the ePrescription using $push and arrayFilters
      const updatedPrescription = await ePrescription.findByIdAndUpdate(
        ePrescriptionId,
        {
          $push: {
            "test.$[elem].results": resultUrl,
          },
        },
        {
          arrayFilters: [
            { "elem.testName": testName, "elem.orderId": orderId }, // Ensure the correct test is updated using both testName and orderId
          ],
          new: true, // to return the updated document
        }
      );

      if (!updatedPrescription) {
        return res.status(404).json([]);
      }

      // Return a successful response
      return res.status(200).json({
        auth: true,
        message: "Result uploaded successfully!",
      });
    } catch (error) {
      return next(error);
    }
  },      
  async getCompletedOrders(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const ordersPerPage = 10;
      const vendorId = req.user._id;

      const totalOrders = await Order.countDocuments({
        vendorId,
        status: "completed",
      });

      const totalPages = Math.ceil(totalOrders / ordersPerPage);
      const skip = (page - 1) * ordersPerPage;

      const completedOrders = await Order.find({
        vendorId,
        status: "completed",
      })
        .sort({ createdAt: -1 })
        .populate("items.itemId")
        .populate("vendorId")
        .skip(skip)
        .limit(ordersPerPage);

      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        orders: completedOrders,
        auth: true,
        totalOrders,
        previousPage,
        nextPage,
        totalPages,
      });
    } catch (error) {
      return res.status(500).json([]);
    }
  },
};

module.exports = labOrderController;
