const DonorList = require("../../models/Donation/donations.js");
const User = require("../../models/User/user.js");

const donationCompanyDonationsController = {
  async getAllDonations(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const donationsPerPage = 10;
      const companyId = req.user._id;
      const totalDonations = await DonorList.countDocuments({ companyId }); // Get the total number of donations
      const totalPages = Math.ceil(totalDonations / donationsPerPage); // Calculate the total number of pages

      const skip = (page - 1) * donationsPerPage; // Calculate the number of donations to skip based on the current page

      const donations = await DonorList.find({ companyId })
        .sort({ createdAt: -1 }) // Sort by createdAt field in descending order (recent first)
        .populate("userId packageId") // Populate user details
        .skip(skip)
        .limit(donationsPerPage);

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        donations: donations,
        auth: true,
        previousPage: previousPage,
        nextPage: nextPage,
        totalDonations: totalDonations, // Include the total number of donations in the response
        totalPages: totalPages, // Optionally, you can also include the total number of pages
      });
    } catch (error) {
      return next(error);
    }
  },

  async getDonor(req, res, next) {
    try {
      const donationId = req.query.donationId;
      const donor = await DonorList.findById(donationId).populate("userId");

      if (!donor) {
        return res.status(404).json([]);
      }
      return res.status(200).json({ donor });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = donationCompanyDonationsController;
