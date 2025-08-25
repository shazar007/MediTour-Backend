const ParamedicRequest = require("../../models/Paramedic/request.js");
const { changeStatus } = require("../Admin/appointmentController.js");

const paramedicRequestController = {
  async getParamedicRequests(req, res, next) {
    try {
      const paramedicId = req.user._id;
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = 10;
      const status = req.query.status;

      const totalRequests = await ParamedicRequest.countDocuments({
        status,
        paramedicId,
      });

      const totalPages = Math.ceil(totalRequests / requestsPerPage);

      const skip = (page - 1) * requestsPerPage;
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      const allRequests = await ParamedicRequest.find({ status, paramedicId })
        .sort({ appointmentDateAndTime: -1 })
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
      return res
      .status(500)
      .json([]);
    }
  },

  async changeRequestStatus(req, res, next) {
    try {
      const requestId = req.query.requestId;
      const paramedicRequest = await ParamedicRequest.findById(requestId)
      console.log(paramedicRequest)
      paramedicRequest.status = "completed";
      await paramedicRequest.save();
      res.json({
        auth: true,
        message: `Order status changed to completed`,
      });
    } catch (error) {
      return res
      .status(500)
      .json([]);
    }
  },
};

module.exports = paramedicRequestController;
