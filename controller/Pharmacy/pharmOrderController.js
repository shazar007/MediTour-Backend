const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const Order = require("../../models/Pharmacy/booking.js");
const Booking = require("../../models/Pharmacy/booking.js");
const MedicineRequest = require("../../models/Pharmacy/medicineRequest.js");
const moment = require("moment");
const Tests = require("../../models/Laboratory/tests.js");
const Pharmacy = require("../../models/Pharmacy/pharmacy.js");
const { sendchatNotification } = require("../../firebase/service/index.js");
const Notification = require("../../models/notification.js");

async function getOrderCountsForWeek(labId, startDate, endDate) {
  const days = [];
  let currentDate = moment(startDate);

  while (currentDate.isSameOrBefore(endDate)) {
    const nextDate = moment(currentDate).endOf("day");
    // Modify this query based on your actual data structure
    const ordersCount = await pharmOrder
      .find({
        createdAt: { $gte: currentDate, $lt: nextDate },
        labId: labId,
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

const pharmOrderController = {

  async changeStatus(req, res, next) {
    try {
      const allowedStatuses = ["pending", "OnRoute", "completed"]; // Allowed statuses
      const newStatus = req.body.status;
      const pharmacyId = req.user._id;
      if (!newStatus || !allowedStatuses.includes(newStatus)){
        return res.status(404).json([]);
      }
      const id = req.query.id;
      console.log("id", id)
      console.log("newStatus", newStatus)
      const order = await MedicineRequest.findById(id);
      const result = await MedicineRequest.findOneAndUpdate(
        { _id: ObjectId(id) },
        { $set: { status: newStatus } },
        { returnDocument: "after" } // Optional: Specify 'after' to return the updated document
      );
      console.log("asdfghjklasdfghjkl")
      if (!result) {
        const error = {
          status: 404,
          message: "Order not found",
        };

        return next(error);
      }
      const userId = order.patientId;
      console.log("userId", userId)
      console.log("pharmacyId", pharmacyId)

      if (newStatus == "completed") {
        sendchatNotification(
          userId,
          {
            title: "MediTour Global",
            message: "Your order has been completed!",
          },
          "user"
        );
        const notification = new Notification({
          senderId: pharmacyId,
          senderModelType: "Pharmacy",
          receiverId: userId,
          title: "MediTour Global",
          message: "Your order has been completed!",
        });
        await notification.save();
      } else if (newStatus == "OnRoute") {
        sendchatNotification(
          userId,
          {
            title: "MediTour Global",
            message: "Your order status changed to OnRoute",
          },
          "user"
        );
        const notification = new Notification({
          senderId: pharmacyId,
          senderModelType: "Pharmacy",
          receiverId: order.userId,
          title: "MediTour Global",
          message: "Your order status changed to OnRoute",
        });
        await notification.save();
      }
      res.status(200).json({
        auth: true,
        message: "status changed successfully",
      });
    } catch (error) {
      return next(error);
    }
  },

  async getOrder(req, res, next) {
    try {
      const medicineRequestId=req.query.medicineRequestId;
      console.log(medicineRequestId)
      const order = await MedicineRequest.findById(medicineRequestId) .populate({
        path: "bidIds", // Populate the array of PharmacyBid references within MedicineRequest
        model: "PharmacyBid",
        match: { status: "completed" }, // Only include PharmacyBid documents with status "completed"
        populate: {
          path: "availableMedIds", // Populate the availableMedIds field in each PharmacyBid
          model: "Medicines", // Specify the Medicines model to fetch data for availableMedIds
        },
      })
        .populate("patientId")
        .populate({
          path: "medicineIds.id", // Populate the "id" in the medicineIds array
          model: "Medicines", // Specify Medicines model for population
        });

      return res.status(200).json({
       order
      });
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },

  async testing(req, res, next) { 
    try {
      const { orderId, customerName, MR_NO, date, status, totalAmount } =
        req.body;
      const pharmId = req.user._id;

      let test;

      let medCode = Math.floor(Math.random() * 1000000); // Generate a random number between 0 and 99999999

      const testToRegister = new pharmOrder({
        pharmId,
        medCode,
        orderId,
        customerName,
        MR_NO,
        date,
        status,
        totalAmount,
      });

      test = await testToRegister.save();
      res.json("order added successfully!");
    } catch (error) {
      return next(error);
    }
  },

  async getOrders(req, res) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const pharmPerPage = 10;
      const pharmacyId = req.user._id;
      console.log("pharmacyId", pharmacyId)

      // Get the total number of pharmacy orders for the vendor
      const totalPharms = await MedicineRequest.countDocuments({ pharmacyId });

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalPharms / pharmPerPage);

      // Calculate the number of orders to skip based on the current page
      const skip = (page - 1) * pharmPerPage;

      // Find all pharmacy orders for the vendor, sorted by createdAt field in descending order
      const allOrders = await MedicineRequest.find({ pharmacyId })
      .populate({
        path: "bidIds", // Populate the array of PharmacyBid references within MedicineRequest
        model: "PharmacyBid",
        match: { status: "completed" }, // Only include PharmacyBid documents with status "completed"
        populate: {
          path: "availableMedIds", // Populate the availableMedIds field in each PharmacyBid
          model: "Medicines", // Specify the Medicines model to fetch data for availableMedIds
        },
      })
        .populate("patientId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pharmPerPage);

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        orders: allOrders,
        auth: true,
        totalPharms,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },
};

module.exports = pharmOrderController;
