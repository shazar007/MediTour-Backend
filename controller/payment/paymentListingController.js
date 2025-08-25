const express = require("express");
const paymentToVendors = require("../../models/Admin/paymentToVendors");

const app = express();

const paymentListingController = {
  async getAllVendorPayment(req, res, next) {
    try {
      const vendorId = req.query.vendorId;
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const paymentListingPerPage = 10;

      // Get the total number of apartments for the hotel
      const totalPayment = await paymentToVendors.count({ vendorId });

      // Calculate the total number of pages based on the number of apartments per page
      const totalPages = Math.ceil(totalPayment / paymentListingPerPage);

      const skip = (page - 1) * paymentListingPerPage; // Calculate the number of apartments to skip based on the current page

      // Fetch the apartments for the hotel

      const payments = await paymentToVendors
        .find({ vendorId })
        .populate("adminId", "name")
        .populate("items", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(paymentListingPerPage)
        .exec();

      // Calculate previous and next page numbers
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      if (!payments || payments.length === 0) {
        return res.status(404).json([]);
      }

      res.status(200).json({
        payments: payments,
        totalPayment: totalPayment,
        auth: true,
        previousPage: previousPage,
        nextPage: nextPage,
        totalPages: totalPages,
      });
    } catch (error) {
      console.error(error); // Log the error for debugging
      res.status(500).json({ message: "Error retrieving payments.", error });
    }
  },
};

module.exports = paymentListingController;
