const express = require("express");
const app = express();
const Joi = require("joi");
const BidRequest = require("../../models/Travel Agency/bid");
const FlightRequest = require("../../models/Travel Agency/flightRequest");
const TravelAgency = require("../../models/Travel Agency/travelAgency.js");
const Booking = require("../../models/Travel Agency/booking.js");
const { sendchatNotification } = require("../../firebase/service/index.js");
const moment = require("moment");
const JWTService = require("../../services/JWTService.js");
const Notification = require("../../models/notification.js");
const exchangeRateApi = require("../../utils/ExchangeRate.js");

const agencyFlightController = {
  async addBidRequest(req, res, next) {
    try {
      const agencyId = req.user._id; // Logged-in agency ID

      // Validate the request body
      const bidSchema = Joi.object({
        requestId: Joi.string().required(),
        flightDetails: Joi.array().required(),
        returnFlights: Joi.array(),
        flightPolicies: Joi.object().required(),
        ticketPrice: Joi.number().required(),
      });

      const { error } = bidSchema.validate(req.body);
      const agency = await TravelAgency.findById(agencyId);

      let travelCompanyId;
      if (agency && agency.travelCompanyId) {
        travelCompanyId = agency.travelCompanyId;
      }

      if (error) {
        throw new Error(error.details[0].message);
      }

      const {
        requestId,
        flightDetails,
        returnFlights,
        flightPolicies,
        ticketPrice,
      } = req.body;

      // Check if the agency has already bid on this request
      const alreadyBid = await BidRequest.findOne({ agencyId, requestId });
      if (alreadyBid) {
        throw new Error("You have already bid against the following request!");
      }

      // Find the flight request based on requestId
      const flightRequest = await FlightRequest.findById(requestId);
      if (!flightRequest) {
        throw new Error("Flight request not found!");
      }

      const userId = flightRequest.userId;
      const requestType = flightRequest.requestType; // Extract requestType from flightRequest

      // If flightType is not provided, use requestType
      const flightType = requestType;

      // Function to calculate flight duration and stay durations
      const calculateFlightDurations = (flights) => {
        let updatedFlights = [];
        let totalDuration = moment.duration();
        let stays = [];

        flights.forEach((flight, index) => {
          const departureDateTime = moment(
            flight.departureTime,
            "YYYY-MM-DDTHH:mm:ss"
          );
          const arrivalDateTime = moment(
            flight.arrivalTime,
            "YYYY-MM-DDTHH:mm:ss"
          );

          if (!departureDateTime.isValid() || !arrivalDateTime.isValid()) {
            throw new Error("Invalid date or time format");
          }

          // Calculate the duration of the flight leg
          const flightDuration = moment.duration(
            arrivalDateTime.diff(departureDateTime)
          );
          totalDuration.add(flightDuration);

          const flightHours = Math.floor(flightDuration.asHours());
          const flightMinutes = flightDuration.minutes();
          const flightTime = `${flightHours}h ${flightMinutes}m`;

          // Calculate stay duration for each leg except the last one
          if (index < flights.length - 1) {
            const nextFlight = flights[index + 1];
            const nextDepartureDateTime = moment(
              nextFlight.departureTime,
              "YYYY-MM-DDTHH:mm:ss"
            );

            const stayDurationTime = moment.duration(
              nextDepartureDateTime.diff(arrivalDateTime)
            );

            // Calculate total stay duration in days and hours
            const stayDays = stayDurationTime.days(); // Get number of days
            const stayHours = stayDurationTime.hours(); // Get number of hours
            const stayMinutes = stayDurationTime.minutes(); // Get remaining minutes

            // Convert days to hours (1 day = 24 hours) and add to the total stay hours
            const totalStayHours = stayDays * 24 + stayHours;

            stays.push(`${totalStayHours}h ${stayMinutes}m`);
          }

          updatedFlights.push({
            ...flight,
            flightTime,
          });
        });

        return {
          updatedFlights,
          totalDuration,
          stays,
        };
      };
      // Calculate durations for the outbound flight details
      const {
        updatedFlights: updatedFlightDetails,
        totalDuration: outboundDuration,
        stays: outboundStays,
      } = calculateFlightDurations(flightDetails);

      let totalFlightDuration = moment.duration(outboundDuration);
      let stayDurations = [...outboundStays];

      // Calculate durations for return flights if it's a round trip
      let updatedReturnFlights = [];
      let returnFlightTotalDuration = moment.duration();
      let returnStayDurations = [];

      if (requestType === "round" && returnFlights) {
        const {
          updatedFlights: updatedReturnFlightDetails,
          totalDuration: returnDuration,
          stays: returnStays,
        } = calculateFlightDurations(returnFlights);
        updatedReturnFlights = updatedReturnFlightDetails;
        returnFlightTotalDuration = returnDuration;
        returnStayDurations = returnStays;
      }

      // Convert the accumulated total flight duration to hours and minutes
      const totalFlightHours = Math.floor(totalFlightDuration.asHours());
      const totalFlightMinutes = totalFlightDuration.minutes();
      const totalFlightTime = `${totalFlightHours}h ${totalFlightMinutes}m`;

      // Convert return flight total duration to hours and minutes
      const returnFlightHours = Math.floor(returnFlightTotalDuration.asHours());
      const returnFlightMinutes = returnFlightTotalDuration.minutes();
      const returnFlightTime = `${returnFlightHours}h ${returnFlightMinutes}m`;

      // Create new BidRequest object based on schema
      const dollarAmount = await exchangeRateApi(ticketPrice);
      const bidToRegister = new BidRequest({
        requestId,
        agencyId,
        userId,
        flightType,
        flightDetails: updatedFlightDetails,
        ...(returnFlights && { returnFlights: updatedReturnFlights }),
        flightPolicies,
        ticketPrice,
        dollarAmount,
        requestType,
        totalFlightTime,
        stayDurations,
        returnFlightTime,
        returnStayDurations, // Include separate stay durations for return flights
        isCompany: agency.entityType === "company" ? true : false,
        ...(travelCompanyId && { travelCompanyId }),
      });

      // Save the bid request to the database
      const bid = await bidToRegister.save();
      // Add the bid ID to the flight request and update its status
      flightRequest.bidIds.push(bid._id);
      flightRequest.status = "bidSent"; // Update status
      await flightRequest.save();

      // Send notification to user
      sendchatNotification(
        userId,
        {
          title: "MediTour Global",
          message: `You have received a new bid request!`,
        },
        "user"
      );

      // Create a notification record
      const notification = new Notification({
        senderId: agencyId,
        senderModelType: "Travel Agency",
        receiverModelType: "Users",
        receiverId: userId,
        title: "MediTour Global",
        message: "You have received a new bid request!",
      });

      await notification.save();

      // Return success response
      return res.status(201).json({ bidRequest: bid, auth: true });
    } catch (error) {
      // Pass any errors to the error handler middleware
      next(error);
    }
  },

  async getAllBids(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = 10;
      const agencyId = req.user._id;
      const totalBids = await BidRequest.countDocuments({ agencyId });
      const totalPages = Math.ceil(totalBids / requestsPerPage);
      const skip = (page - 1) * requestsPerPage;
      const bidRequests = await BidRequest.find({ agencyId })
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(requestsPerPage);
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;
      res.json({
        auth: true,
        bidRequests: bidRequests,
        totalPages,
        previousPage,
        nextPage,
        totalBids: totalBids,
      });
    } catch (error) {
      next(error);
    }
  },

  async getBid(req, res, next) {
    try {
      const bidId = req.query.id;
      const bidRequest = await BidRequest.findById(bidId);
      res.json({
        auth: true,
        bidRequest,
      });
    } catch (error) {
      next(error);
    }
  },

  async getBookedBids(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = 10;
      const agencyId = req.user._id;
      const totalBids = await BidRequest.countDocuments({
        agencyId,
        status: "booked",
      });
      const totalPages = Math.ceil(totalBids / requestsPerPage);
      const skip = (page - 1) * requestsPerPage;
      const bidRequests = await BidRequest.find({
        agencyId,
        status: "booked",
      })
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(requestsPerPage);

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;
      res.json({
        auth: true,
        bidRequests: bidRequests,
        totalPages: totalPages,
        totalBids: totalBids,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      next(error);
    }
  },

  async getUserRequests(req, res, next) {
    try {
      const agencyId = req.user._id; // Logged-in agency ID
      const page = parseInt(req.query.page) || 1; // Page number
      const requestsPerPage = 10; // Requests per page
      const agency = await TravelAgency.findById(agencyId);
      if (agency.activationRequest == "inProgress") {
        const error = {
          status: 403,
          message: "Your account will be activated within the next hour",
        };
        return next(error);
      } else if (agency.activationRequest == "pending") {
        const error = {
          status: 403,
          message: "Please pay the activation fee to activate your account",
        };
        return next(error);
      }

      // Fetch all the flight requests and bookings to check the eTicket status
      const requests = await FlightRequest.find({})
        .sort({ createdAt: -1 }) // Sort by creation date
        .populate("userId")
        .populate({
          path: "bidIds", // Populate bidIds array
          model: "Bid Request", // Reference to the Bid Request model
          populate: {
            path: "agencyId", // Populate agencyId inside each Bid Request
            model: "Travel Agency", // Reference Travel Agency model
          },
        });

      // Log populated requests for debugging
      console.log("Populated Requests:", JSON.stringify(requests, null, 2));

      // Fetch bookings to check if eTicket exists for the request
      const bookings = await Booking.find({
        requestId: { $in: requests.map((request) => request._id) },
        eTicket: { $ne: null }, // Only get bookings that have an eTicket
      });

      // Convert bookings array into a set of requestId values to easily check later
      const bookedRequestIds = new Set(
        bookings.map((booking) => booking.requestId.toString())
      );

      // Filter out requests that already have an eTicket or a "booked" bid from other agencies
      const requestsWithStatus = requests
        .filter((request) => {
          // Exclude the request if a ticket has already been issued for it
          if (bookedRequestIds.has(request._id.toString())) {
            return false; // Skip this request
          }

          const bookedBid = request.bidIds.find(
            (bid) => bid.status === "booked"
          );

          // Only show this request if no booked bid or if booked bid is from the logged-in agency
          return (
            !bookedBid ||
            bookedBid.agencyId._id.toString() === agencyId.toString()
          );
        })
        .map((request) => {
          let requestStatus = "pending"; // Default status for all other agencies
          let filteredBids = request.bidIds; // Start with all bid IDs

          const bookedBid = request.bidIds.find(
            (bid) => bid.status === "booked"
          );

          if (
            bookedBid &&
            bookedBid.agencyId._id.toString() === agencyId.toString()
          ) {
            requestStatus = "approved";

            // If approved, show only the logged-in agency's bid
            filteredBids = request.bidIds.filter(
              (bid) => bid.agencyId._id.toString() === agencyId.toString()
            );
          } else {
            const matchingBid = request.bidIds.find(
              (bid) =>
                bid.agencyId &&
                bid.agencyId._id &&
                bid.agencyId._id.toString() === agencyId.toString()
            );

            if (matchingBid) {
              requestStatus = "bidSent";
            }
          }

          return {
            ...request.toObject(),
            status: requestStatus,
            bidIds: filteredBids, // Only include bids as per the above filtering
          };
        });

      // Calculate the total number of filtered requests
      const filteredTotalRequests = requestsWithStatus.length;

      // Calculate the total pages based on the filtered requests
      const totalPages = Math.ceil(filteredTotalRequests / requestsPerPage);

      // Calculate pagination details
      const skip = (page - 1) * requestsPerPage; // Requests to skip
      const paginatedRequests = requestsWithStatus.slice(
        skip,
        skip + requestsPerPage
      );

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      // Return the paginated requests along with pagination info
      res.json({
        auth: true,
        requests: paginatedRequests,
        totalRequests: filteredTotalRequests, // Use filtered requests count for pagination
        totalPages: totalPages,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      next(error); // Handle errors
    }
  },

  async getUserRequest(req, res, next) {
    try {
      const requestId = req.query.requestId; // Get the requestId from the query parameters
      const agencyId = req.user._id; // Logged-in agency ID
      if (!requestId) {
        return res.status(400).json({ message: "Request ID is required" });
      }

      // Find the specific FlightRequest by ID and populate the necessary fields
      const request = await FlightRequest.findById(requestId)
        .populate("userId") // Populate userId
        .populate({
          path: "bidIds", // Populate bidIds array
          model: "Bid Request", // Reference to the Bid Request model
          populate: {
            path: "agencyId", // Populate agencyId inside each Bid Request
            model: "Travel Agency", // Reference Travel Agency model
          },
        });

      if (!request) {
        return res.status(404).json([]); // Send empty response
      }

      // Check if there's an accepted (booked) bid
      const bookedBid = request.bidIds.find((bid) => bid.status === "booked");

      // If a booked bid exists, check if it belongs to the logged-in agency
      if (
        bookedBid &&
        bookedBid.agencyId._id.toString() !== agencyId.toString()
      ) {
        // If the booked bid belongs to another agency, deny access
        return res.status(403).json({
          message:
            "The bid against this request has been accepted for another vendor.",
        });
      }

      // Determine request status for the logged-in agency
      let requestStatus = "pending"; // Default status if no bid is accepted

      if (bookedBid) {
        requestStatus = "approved"; // Set status as approved if booked bid is from this agency

        // If approved, filter bidIds to include only the logged-in agency's bid
        request.bidIds = request.bidIds.filter(
          (bid) => bid.agencyId._id.toString() === agencyId.toString()
        );
      } else {
        // Check if the logged-in agency has sent a bid on this request
        const matchingBid = request.bidIds.find(
          (bid) =>
            bid.agencyId &&
            bid.agencyId._id &&
            bid.agencyId._id.toString() === agencyId.toString()
        );

        if (matchingBid) {
          requestStatus = "bidSent"; // Update status if bid is found for logged-in agency
        }
      }

      // Send back the request with the calculated status
      res.json({
        auth: true,
        request: {
          ...request.toObject(),
          status: requestStatus, // Set the request status
        },
      });
    } catch (error) {
      console.error("Error fetching user request:", error); // Log the error
      next(error); // Handle errors
    }
  },
  async getTravellers(req, res, next) {
    try {
      const agencyId = req.user._id;
      const bidRequestId = req.query.bidRequestId;
      if (!bidRequestId) {
        const error = {
          status: 400,
          message: "Missing Parameters!",
        };
        return next(error);
      }
      // Fetch the booking
      const booking = await Booking.findOne({ agencyId, bidRequestId });

      // Handle case where booking is null or undefined
      if (!booking) {
        return res.status(404).json({ travellers: [], auth: true });
      }

      // Safely extract travellers
      const travellers = booking?.travellers || [];
      return res.status(201).json({ travellers: travellers, auth: true });
    } catch (error) {
      next(error);
    }
  },
  async addTicket(req, res, next) {
    try {
      const agencyId = req.user._id;
      const bidRequestId = req.query.bidRequestId;
      const eTicket = req.body.eTicket;

      if (!bidRequestId || !eTicket) {
        const error = {
          status: 400,
          message: "Missing Parameters!",
        };
        return next(error);
      }
      const booking = await Booking.findOne({ agencyId, bidRequestId });
      booking.eTicket = eTicket;
      await booking.save();
      const userId = booking.userId;
      // Send notification to user
      sendchatNotification(
        userId,
        {
          title: "MediTour Global",
          message: `Your Ticket has been shared!`,
        },
        "user"
      );

      // Create a notification record
      const notification = new Notification({
        senderId: agencyId,
        senderModelType: "Travel Agency",
        receiverModelType: "Users",
        receiverId: userId,
        title: "MediTour Global",
        message: "Your Ticket has been shared!",
      });

      await notification.save();
      return res
        .status(201)
        .json({ message: "Ticket added successfully", auth: true });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = agencyFlightController;
