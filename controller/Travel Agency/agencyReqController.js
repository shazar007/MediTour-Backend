const AgencyRequest = require("../../models/Travel Agency/booking");

const agencyRequestController = {
  async getAllBookings(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      let requestType = req.query.requestType;
      const requestsPerPage = 10;
      const agencyId = req.user._id;
      let totalRequests;
      let totalPages;
      let skip;
      let requests;
      if (requestType == "flight") {
        totalRequests = await AgencyRequest.countDocuments({
          agencyId,
          requestType: "flight",
        }); // Get the total number of posts for the user
        totalPages = Math.ceil(totalRequests / requestsPerPage); // Calculate the total number of pages

        skip = (page - 1) * requestsPerPage; // Calculate the number of posts to skip based on the current page

        requests = await AgencyRequest.find({ agencyId, requestType })
          .populate("agencyId userId requestId bidRequestId")
          .skip(skip)

          .sort({ createdAt: -1 }) // Sort in descending order based on createdAt
          .limit(requestsPerPage);
      } else if (requestType == "tour") {
        totalRequests = await AgencyRequest.countDocuments({
          agencyId,
          requestType: "tour",
        }); // Get the total number of posts for the user
        totalPages = Math.ceil(totalRequests / requestsPerPage); // Calculate the total number of pages

        skip = (page - 1) * requestsPerPage; // Calculate the number of posts to skip based on the current page

        requests = await AgencyRequest.find({ agencyId, requestType })
          .populate("agencyId userId tourId")
          .skip(skip)

          .sort({ createdAt: -1 })
          .limit(requestsPerPage);
      }
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;
      return res.status(200).json({
        requests: requests,
        totalRequests,
        auth: true,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
  async getAllBookingDetails(req, res, next) {
    try {
      let requestType = req.query.requestType;
      let bookingId = req.query.bookingId;
      let booking;
      if (requestType == "flight") {
        booking = await AgencyRequest.findById(bookingId).populate(
          "agencyId userId requestId"
        );
      } else if (requestType == "tour") {
        booking = await AgencyRequest.findById(bookingId).populate(
          "agencyId userId tourId"
        );
      }
      return res.status(200).json({
        booking: booking,
        auth: true,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = agencyRequestController;
