const Admin = require("../../models/Admin/Admin.js");
const Order = require("../../models/order.js");
const Booking = require("../../models/Pharmacy/booking.js");
const MedicineRequest = require("../../models/Pharmacy/medicineRequest.js");

const adminOrdersController = {
  async getOrders(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const ordersPerPage = 10;
      const type = req.query.type;
      const mrNo = req.query.mrNo;
      const vendorId = req.query.vendorId;
      const paidToVendor = req.query.paidToVendor;
      const completedOrders = req.query.completedOrders;
  
      let query = {};
  
      // Handle paidToVendor filter
      if (paidToVendor === "true") {
        query.paidToVendor = true;
      } else if (paidToVendor === "false") {
        query.paidToVendor = false;
      }
  
      // Handle completedOrders filter
      if (completedOrders === "true") {
        query.status = "completed";
      } else if (completedOrders === "false") {
        query.status = { $ne: "completed" };
      }
  
      // Handle specific queries for Laboratory and Pharmacy
      let totalOrders, totalPages, allOrders;
      const skip = (page - 1) * ordersPerPage;
  
      if (type === "Laboratory") {
        // Additional filtering for Laboratory
        if (mrNo) query["userId.mrNo"] = mrNo;
        if (vendorId) query["vendorId"] = vendorId;
  
        totalOrders = await Order.countDocuments(query);
        totalPages = Math.ceil(totalOrders / ordersPerPage);
  
        allOrders = await Order.find(query)
          .sort({ createdAt: -1 })
          .populate("userId vendorId items.itemId")
          .skip(skip)
          .limit(ordersPerPage);
      } else if (type === "Pharmacy") {
        query.pharmacyId = { $exists: true };
  
        // Additional filtering for Pharmacy
        if (mrNo) query["patientId.mrNo"] = mrNo;
        if (vendorId) query["pharmacyId"] = vendorId;
  
        totalOrders = await MedicineRequest.countDocuments(query);
        totalPages = Math.ceil(totalOrders / ordersPerPage);
  
        allOrders = await MedicineRequest.find(query)
          .sort({ createdAt: -1 })
          .populate("patientId pharmacyId medicineIds.id")
          .skip(skip)
          .limit(ordersPerPage);
      } else {
        return res.status(400).json({
          status: false,
          message: "Invalid type specified.",
        });
      }
  
      // Format orders and paginate results
      const orders = allOrders.map((order) => ({
        ...order.toObject(), // Ensure it's a plain object
        noOfItems: order.items?.length || 0,
      }));
  
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;
  
      return res.status(200).json({
        orders,
        ordersLength: totalOrders,
        totalPages,
        previousPage,
        nextPage,
        auth: true,
      });
    } catch (error) {
      return res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },  

  async getAllOrders(req, res) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const vendorType = req.query.vendorType;
      const pharmPerPage = 10;
      let allOrders;
      let totalPages;
      let totalOrders;
      let totalPharms;
      let skip;

      // Determine the vendor's receiverModelType and activation logic based on vendorType
      switch (vendorType) {
        case "pharmacy":
          allOrders = await Booking.find({})
            .populate("userId")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pharmPerPage);
          // Get the total number of pharmacy orders for the vendor
          totalPharms = await Booking.countDocuments({});

          // Calculate the total number of pages
          totalPages = Math.ceil(totalPharms / pharmPerPage);

          // Calculate the number of orders to skip based on the current page
          skip = (page - 1) * pharmPerPage;
          break;
        case "laboratory":
          allOrders = await Order.find({})
            .sort({ createdAt: -1 })
            .populate("userId items.itemId")
            .skip(skip)
            .limit(pharmPerPage);
          totalOrders = await Order.countDocuments({});

          totalPages = Math.ceil(totalOrders / pharmPerPage);

          skip = (page - 1) * pharmPerPage;
          break;
      }

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        orders: allOrders,
        auth: true,
        totalPharms,
        totalOrders,
        totalPages,
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

module.exports = adminOrdersController;
