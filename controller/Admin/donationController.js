const Admin = require("../../models/Admin/Admin.js");
const DonorList = require("../../models/Donation/donations.js");

const donationController = {
  async getDonors(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = 10;
      const donationId = req.query.donationId; // Renamed variable for clarity
      const vendorId = req.query.vendorId;
      const paidToVendor = req.query.paidToVendor;
      const { startTime, endTime } = req.query;

      const query = {};

      // Add date range filter to the query
      if (startTime && endTime) {
        query.createdAt = {
          $gte: new Date(startTime),
          $lte: new Date(endTime),
        };
      }

      // Add paidToVendor filter to the query
      if (
        paidToVendor &&
        (paidToVendor === "true" || paidToVendor === "false")
      ) {
        query.paidToVendor = paidToVendor === "true";
      }

      // Add donationId filter to the query
      if (donationId) {
        query.donationId = donationId; // Assuming donationId is the field name in the DonorList collection
      }

      // Get the total number of documents that match the query
      let totalDonations = await DonorList.countDocuments(query);
      const totalPages = Math.ceil(totalDonations / requestsPerPage);
      const skip = (page - 1) * requestsPerPage;

      // Retrieve the list of donations based on the query
      let donations = await DonorList.find(query)
        .sort({ createdAt: -1 })
        .populate("userId companyId packageId")
        .skip(skip)
        .limit(requestsPerPage)
        .exec();

      // Filter by vendorId if provided
      if (vendorId) {
        donations = donations.filter(
          (donation) =>
            donation.companyId && donation.companyId.vendorId === vendorId
        );
        totalDonations = donations.length; // Update totalDonations after filtering
      }

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      // Respond with the paginated list of donations
      return res.status(200).json({
        donations: donations,
        donorsLength: totalDonations,
        totalPages: totalPages,
        previousPage: previousPage,
        nextPage: nextPage,
        auth: true,
      });
    } catch (error) {
      // Handle any errors
      return res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },
  async getDonorDet(req, res, next) {
    try {
      const donationId = req.query.donationId;
      const donor = await DonorList.findById(donationId)
        .populate("userId companyId")
        .populate({
          path: "packageId",
          select: "images", // Only include the 'images' field from packageId
        });
      if (!donor) {
        return res.status(404).json([]);
      }
      return res.status(200).json({ donor });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = donationController;
