const Booking = require("../../models/Travel Agency/booking");
const FlightRequest = require("../../models/Travel Agency/flightRequest.js");
const travels = require("../../models/Travel Agency/travelAgency.js");
const BidRequest = require("../../models/Travel Agency/bid");
const Tour = require("../../models/Travel Agency/tour");
const User = require("../../models/User/user");
const Joi = require("joi");
const Rating = require("../../models/rating");
const Admin = require("../../models/Admin/Admin"); // Import the Admin model
const { sendchatNotification } = require("../../firebase/service/index.js");
const Notification = require("../../models/notification.js");
const flightRequest = require("../../models/Travel Agency/flightRequest");
const stripePaymentTransaction = require("../../models/stripeTransactions");
const exchangeRateApi = require("../../utils/ExchangeRate");

function calculateTotalPrice(flightResult, totalTravelers) {
  let totalPrice = 0;
  for (const flight of flightResult) {
    totalPrice += parseInt(flight.totalAmount);
  }
  return totalPrice * totalTravelers;
}
const formatTotalFlightTime = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} hours ${minutes} minutes`;
};
async function getNextBookingNo() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestOrder = await Booking.findOne({}).sort({ createdAt: -1 });

    let nextOrderIdNumber = 1;
    if (latestOrder && latestOrder.bookingId) {
      // Extract the numeric part of the orderId and increment it
      const currentOrderIdNumber = parseInt(latestOrder.bookingId.substring(3));
      nextOrderIdNumber = currentOrderIdNumber + 1;
    }

    // Generate the next orderId
    const nextOrderId = `ORD${nextOrderIdNumber.toString().padStart(4, "0")}`;

    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}

const travelAgencyController = {
  ///...Tour...//
  async getAllTourPackages(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const toursPerPage = 10;

      const skip = (page - 1) * toursPerPage; // Calculate the number of posts to skip based on the current page

      // Fetch tours with pagination and populate agencyId
      let tours = await Tour.find({})
        .populate("agencyId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(toursPerPage);

      // Filter out tours where agencyId.blocked is true
      tours = tours.filter(
        (tour) =>
          tour.agencyId &&
          tour.agencyId.paidActivation == true &&
          !tour.agencyId.blocked
      );

      // Recalculate total tours after filtering
      const totalTours = tours.length;

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalTours / toursPerPage);

      // Calculate remaining seats for each tour and include it in the response
      const toursWithRemainingSeats = tours.map((tour) => {
        const bookedSeats = tour.bookedSeats || 0; // Ensure bookedSeats is 0 if null or undefined
        const remainingSeats = tour.limitedSeats - bookedSeats; // Calculate remaining seats

        return {
          ...tour.toObject(), // Convert MongoDB document to plain object
          remainingSeats, // Add the calculated remaining seats
        };
      });

      // Determine previous and next pages
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        tours: toursWithRemainingSeats, // Use the modified array with remaining seats
        auth: true,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
  async getAllUpcomingSchedules(req, res, next) {
    try {
      const currentDateTime = new Date(); // Get current date and time
      const city = req.query.city; // Filter by city
      const country = req.query.country; // Filter by country
      const filterTypes = req.query.filter
        ? req.query.filter.split(",")
        : ["all"]; // Allow multiple filters
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const toursPerPage = 20; // Default to 20 tours per page

      // Initialize the base query object for tours
      let tourQuery = {
        $or: [
          { departDate: { $gt: currentDateTime } }, // Future dates
          {
            departDate: { $eq: currentDateTime.toISOString().slice(0, 10) }, // Today's date
            departTime: { $gte: currentDateTime.toISOString().slice(11, 16) }, // Later times today
          },
        ],
      };

      // Handle multiple filters
      if (filterTypes.includes("city") && city) {
        tourQuery.from = city; // Filter by city (assuming 'from' is the field in Tour model)
      }

      // Query to fetch upcoming tours linked to unblocked agencies
      const upcomingToursQuery = Tour.find(tourQuery)
        .populate({
          path: "agencyId", // Populate agency details
          match: { 
            blocked: false, // Exclude blocked agencies
            ...(filterTypes.includes("recommended") && { isRecommended: true }), // Filter by recommended status in agency
            ...(filterTypes.includes("country") && country && { country: country.trim() }), // Filter by country in agency
          },
        })
        .skip((page - 1) * toursPerPage)
        .limit(toursPerPage);

      // Sorting logic based on the filter type
      if (filterTypes.includes("all") || filterTypes.includes("city")) {
        upcomingToursQuery.sort({
          isRecommended: -1, // Recommended first (assuming 'isRecommended' is in Tour model)
          departDate: 1, // Sort by departure date in ascending order
          departTime: 1, // Sort by departure time in ascending order
        });
      } else if (filterTypes.includes("recommended")) {
        upcomingToursQuery.sort({ isRecommended: -1 }); // Sort only by recommended status
      }

      const [upcomingSchedules, totalTours] = await Promise.all([
        upcomingToursQuery.exec(), // Fetch paginated tours
        Tour.countDocuments(tourQuery).populate({
          path: "agencyId", // Ensure only unblocked agencies are counted
          match: { 
            blocked: false,
            ...(filterTypes.includes("recommended") && { isRecommended: true }), // Filter by recommended status in agency
            ...(filterTypes.includes("country") && country && { country: country.trim() }), // Filter by country in agency
          },
        }),
      ]);

      // Filter out tours with no matching agency (populated agencyId will be null for blocked agencies)
      const filteredSchedules = upcomingSchedules.filter(
        (tour) => tour.agencyId && tour.agencyId.paidActivation === true
      );

      // Calculate remaining seats for each tour
      const toursWithRemainingSeats = filteredSchedules.map((tour) => {
        const bookedSeats = tour.bookedSeats || 0;
        const remainingSeats = tour.limitedSeats - bookedSeats;

        return {
          ...tour.toObject(), // Convert MongoDB document to plain object
          remainingSeats, // Add the calculated remaining seats
        };
      });

      const totalPages = Math.ceil(totalTours / toursPerPage);
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      res.status(200).json({
        upcomingSchedules: toursWithRemainingSeats,
        auth: true,
        previousPage: previousPage,
        totalPages: totalPages,
        totalTours: totalTours,
        nextPage: nextPage,
      });
    } catch (error) {
      next(error);
    }
  },
  async getTourDetails(req, res, next) {
    try {
      const tourId = req.query.tourId;

      // Find the tour details
      const tour = await Tour.findById(tourId);
      if (!tour) {
        return res.status(404).json([]); // Send empty response
      }

      const bookings = await Booking.find({ tourId });

      const bookedUser = bookings.reduce(
        (sum, booking) => sum + booking.totalUser,
        0
      );

      tour.bookedSeats = bookedUser;
      await tour.save();

      const remainingSeats = tour.limitedSeats - bookedUser;

      return res.status(200).json({
        tour,
        bookedUser,
        remainingSeats,
      });
    } catch (error) {
      return next(error);
    }
  },
  async addBookingsTour(req, res, next) {
    try {
      const agencyBookingSchema = Joi.object({
        remainingAmount: Joi.number().required(),
        paymentId: Joi.string(),
        agencyId: Joi.string(),
        paidByUserAmount: Joi.number(),
        from: Joi.string(),
        to: Joi.string(),
        age: Joi.string(),
        name: Joi.string(),
        email: Joi.string(),
        address: Joi.string(),
        totalAmount: Joi.number(),
        packageName: Joi.string(),
        totalUser: Joi.number(),
        processingFee: Joi.number(),
        isPaidFull: Joi.boolean(),
        gatewayName: Joi.string().required(),
      }); // Allow other fields in the request body

      const { error } = agencyBookingSchema.validate(req.body);

      if (error) {
        return res.status(400).json({ message: error.details[0].message });
      }
      // Destructure and get necessary fields from the request body
      const {
        paymentId,
        paidByUserAmount,
        agencyId,
        from,
        to,
        age,
        name,
        email,
        address,
        totalAmount,
        packageName,
        totalUser,
        processingFee,
        isPaidFull,
        gatewayName,
        remainingAmount,
      } = req.body;
      const tourId = req.query.tourId; // Tour ID from the query parameters
      const userId = req.user._id; // User ID making the booking
      // Check if the tour exists and fetch it
      const tour = await Tour.findById(tourId);
      const agency = await travels.findById(agencyId);

      // If the tour is not found, return an error
      if (!tour) {
        return res.status(404).json([]); // Send empty response
      }

      // Access the limitedSeats from the tour object
      const { limitedSeats, bookedSeats } = tour;

      // Check if the requested users exceed the tour's limited seats
      if (totalUser > limitedSeats) {
        console.error(
          `Not enough available seats. Requested: ${totalUser}, limitedSeats: ${limitedSeats}`
        );
        return res.status(400).json({
          message: "Not enough available seats. Seats are fully booked.",
        });
      }

      // Check if there are enough available seats
      const availableSeats = limitedSeats - bookedSeats;
      if (totalUser > availableSeats) {
        console.error(
          `Not enough available seats. Requested: ${totalUser}, Available: ${availableSeats}`
        );
        return res.status(400).json({
          message: "Not enough available seats. Seats are fully booked.",
        });
      }
      const bookingId = await getNextBookingNo();
      // Create a new booking request object
      let paymentIdArray = [];

      if (gatewayName === "stripe") {
        paymentIdArray.push({
          id: paymentId,
          status: "completed",
          createdAt: new Date(),
        });
      } else if (gatewayName === "blinq") {
        paymentIdArray.push({
          id: paymentId,
          status: "pending",
          createdAt: new Date(),
        });
      }
      let travelCompanyId;
      if (agency.travelCompanyId) {
        travelCompanyId = agency.travelCompanyId;
      }
      const dollarAmount = await exchangeRateApi(totalAmount);
      const request = new Booking({
        userId,
        paymentId: paymentIdArray,
        paidByUserAmount,
        agencyId,
        bookingId,
        from,
        to,
        email,
        name,
        age,
        address,
        totalAmount,
        dollarAmount,
        packageName,
        totalUser,
        tourId,
        requestType: "tour",
        isPaidFull,
        processingFee,
        gatewayName,
        remainingAmount,
        isCompany: agency.entityType === "company" ? true : false,
        ...(travelCompanyId && { travelCompanyId }),
      });

      // Save the booking request to the database
      await request.save();
      if (gatewayName !== "blinq") {
        const stripePaymentToRegister = new stripePaymentTransaction({
          id: request._id,
          idModelType: "Agency Booking",
          paymentId,
          gatewayName,
          paidByUserAmount,
          isPaidFull,
        });
        stripeController = await stripePaymentToRegister.save();

        // Notification logic after booking is successfully saved
        const receiverId = agencyId; // The agency ID to receive the notification

        // Send chat notification to the agency
        sendchatNotification(
          receiverId,
          {
            title: "MediTour Global",
            message: `A new tour booking request has been submitted for package ${tour.packageName} with ${agency.name}.`,
          },
          "agency"
        );

        // Create and save a notification document in the database
        const notification = new Notification({
          senderId: userId,
          senderModelType: "Users",
          receiverId: receiverId,
          receiverModelType: "Travel Agency",
          title: "MediTour Global",
          message: `${name} paid ${paidByUserAmount} for ${tour.packageName} with ${agency.name}. `,
        });
        await notification.save();

        if (agency.travelCompanyId) {
          sendchatNotification(
            travelCompanyId,
            {
              title: "MediTour Global",
              message: `A new tour booking request has been submitted for package ${tour.packageName} with ${agency.name}.`,
            },
            "Travel Company"
          );

          // Create and save a notification document in the database
          const companyNotification = new Notification({
            senderId: userId,
            senderModelType: "Users",
            receiverId: travelCompanyId,
            receiverModelType: "Travel Company",
            title: "MediTour Global",
            message: `${name} paid ${paidByUserAmount} for ${tour.packageName} with ${agency.name}. `,
          });
          await companyNotification.save();
        }

        // Notify admins
        const admins = await Admin.find(); // Adjust this to match your admin retrieval logic

        const adminNotifications = admins.map((admin) => ({
          senderId: userId,
          senderModelType: "Users",
          receiverId: admin._id,
          receiverModelType: "Admin",
          title: "MediTour Global",
          message: `${name} paid ${paidByUserAmount} for ${tour.packageName} with ${agency.name}. `,
        }));

        await Notification.insertMany(adminNotifications);

        admins.forEach((admin) => {
          sendchatNotification(
            admin._id,
            {
              title: "MediTour Global",
              message: `${name} paid ${paidByUserAmount} for ${tour.packageName} with ${agency.name}. `,
            },
            "admin"
          );
        });
      }

      const updatedTour = await Tour.findByIdAndUpdate(
        tourId,
        { $inc: { bookedSeats: totalUser } }, // Increment bookedSeats by the number of users
        { new: true } // Return the updated document
      );

      // Send response indicating successful booking request submission
      res.status(200).json({
        message: "Tour booking request submitted successfully",
        request: request,
        auth: true,
      });
    } catch (error) {
      // Pass any errors to the error handling middleware
      return next(error);
    }
  },

  async payRemainingTourAmount(req, res, next) {
    try {
      let {
        bookingId,
        paidByUserAmount,
        processingFee,
        paymentId,
        gatewayName,
      } = req.query;
      const userId = req.user._id;
      let paymentIdArray = [];
      paidByUserAmount = parseFloat(paidByUserAmount);
      processingFee = parseFloat(processingFee);
      processingFee.toFixed(2);

      if (gatewayName === "stripe") {
        paymentIdArray.push({
          id: paymentId,
          status: "completed",
          createdAt: new Date(),
        });
      } else if (gatewayName === "blinq") {
        paymentIdArray.push({
          id: paymentId,
          status: "pending",
          createdAt: new Date(),
        });
      }
      const booking = await Booking.findById(bookingId);
      booking.paymentId.push(paymentIdArray[0]);
      booking.isPaidFull = true;
      const agencyId = booking.agencyId; // Replace with actual field name
      const tourId = booking.tourId;
      const user = await User.findById(userId);
      const agency = await travels.findById(agencyId);
      const tour = await Tour.findById(tourId);
      await booking.save();
      if (gatewayName !== "blinq") {
        const userAmount = booking.paidByUserAmount;
        paidByUserAmount = userAmount + paidByUserAmount;
        booking.paidByUserAmount = paidByUserAmount;
        const userFee = booking.processingFee;
        processingFee = userFee + processingFee;
        booking.processingFee = processingFee;

        // Replace with actual field name

        await booking.save();
        const idModelType = "Agency Booking";
        const stripePaymentToRegister = new stripePaymentTransaction({
          id: bookingId,
          idModelType,
          paymentId,
          gatewayName,
          paidByUserAmount,
          isPaidFull: false,
        });
        const stripeController = await stripePaymentToRegister.save();
        const admins = await Admin.find(); // Adjust this to match your admin retrieval logic

        const adminNotifications = admins.map((admin) => ({
          senderId: req.user._id,
          senderModelType: "Users",
          receiverId: admin._id,
          receiverModelType: "Admin",
          title: "MediTour Global",
          message: `${user.name} paid ${paidByUserAmount} for ${tour.packageName} with ${agency.name}. `,
        }));

        await Notification.insertMany(adminNotifications);

        admins.forEach((admin) => {
          sendchatNotification(
            admin._id,
            {
              title: "MediTour Global",
              message: `${user.name} paid ${paidByUserAmount} for ${tour.packageName} with ${agency.name} .`,
            },
            "admin"
          );
        });
      }

      res.json({ booking, auth: true });
    } catch (error) {
      next(error);
    }
  },

  ///............Flights...............//
  async addFlightRequest(req, res, next) {
    try {
      const userId = req.user._id;

      const {
        flights,
        returnFlight,
        flightClass,
        adult,
        children,
        infant,
        requestType,
      } = req.body;

      // Validate required fields
      if (
        !flights ||
        !flightClass ||
        adult == null ||
        children == null ||
        infant == null ||
        !requestType
      ) {
        return res.status(400).json({ message: "Missing required fields." });
      }

      // Create a new flight request instance
      const flightRequest = new FlightRequest({
        userId,
        flights,
        returnFlight,
        flightClass,
        adult,
        children,
        infant,
        requestType,
        bidIds: [],
      });

      // Save the flight request to the database
      const savedFlightRequest = await flightRequest.save();

      // Check if the request is saved successfully
      if (savedFlightRequest) {
        // Retrieve all travel agencies
        const travelAgencies = await travels.find({}); // Replace `travels` with the correct model name if needed

        // Prepare notification data
        const notifications = travelAgencies.map((agency) => ({
          senderId: userId,
          senderModelType: "Users",
          receiverId: agency._id,
          receiverModelType: "Travel Agency",
          title: "MediTour Global",
          message: "You have a new flight booking request.",
          createdAt: new Date(), // Set the creation date for notifications
        }));

        // Insert notifications into the database in bulk for efficiency
        await Notification.insertMany(notifications);

        // Send chat notifications to all travel agencies asynchronously
        travelAgencies.forEach((agency) => {
          sendchatNotification(
            agency._id,
            {
              title: "MediTour Global",
              message: "You have a new flight booking request.",
            },
            "agency" // Assuming "admin" type for travel agencies; adjust as needed
          );
        });
      }

      // Return the created flight request in the response
      res.status(201).json({
        success: true,
        booking: savedFlightRequest, // Updated to reflect the saved flight request
      });
    } catch (error) {
      // Pass any errors to the error handling middleware
      return next(error);
    }
  },
  async getBidRequests(req, res, next) {
    try {
      const requestId = req.query.requestId;

      // Fetch bids for the given requestId and populate agency details
      let bids = await BidRequest.find({ requestId })
        .populate({ path: "agencyId", select: "name logo blocked" }) // Include `blocked` field
        .sort({ createdAt: -1 });

      // Filter out bids where agencyId.blocked is true
      bids = bids.filter((bid) => bid.agencyId && !bid.agencyId.blocked);

      // Return the filtered bid requests
      res.json({
        auth: true,
        bidRequests: bids,
      });
    } catch (error) {
      next(error);
    }
  },

  async getBidRequest(req, res, next) {
    try {
      const bidId = req.query.bidId;
      const bid = await BidRequest.findById(bidId);
      res.json({
        auth: true,
        bidRequest: bid,
      });
    } catch (error) {
      next(error);
    }
  },
  async rejectBidRequest(req, res, next) {
    try {
      const requestId = req.query.requestId;
      const bid = await BidRequest.findById(requestId);
      if (!bid) {
        return res.status(404).json([]); // Send empty response
      }

      // Step 3: Update the bid request status to 'rejected' and delete it
      bid.status = "rejected";
      await bid.save();
      await BidRequest.findByIdAndDelete(requestId);

      // Step 4: Send a chat notification to the agency (ensure sendchatNotification is defined)
      sendchatNotification(
        bid.agencyId._id, // Use the populated agency ID
        {
          title: "MediTour Global",
          message: "Your bid request has been rejected.",
        },
        "agency"
      );

      // Step 5: Create a new notification record for the agency
      const notification = new Notification({
        senderId: req.user._id, // The user who rejected the bid
        senderModelType: "Users",
        receiverId: bid.agencyId._id, // The agency receiving the notification
        receiverModelType: "Travel Agency",
        title: "MediTour Global",
        message: "Your bid request has been rejected.",
        createdAt: new Date(), // Timestamp for when the notification is created
      });
      await notification.save();

      // Step 6: Return a success response
      res.json({
        auth: true,
        message: "Bid Request has been rejected successfully!",
      });
    } catch (error) {
      next(error); // Pass the error to the next middleware
    }
  },

  async acceptBidRequest(req, res, next) {
    try {
      const bidRequestId = req.query.bidRequestId;
      const userId = req.user._id;
      const bid = await BidRequest.findById(bidRequestId);
      if (!bid) {
        return res.status(404).json([]); // Send empty response
      }

      const agencyId = bid.agencyId;
      const requestId = bid.requestId;
      const totalAmount = bid.ticketPrice;
      const dollarAmount = bid.dollarAmount;
      const isCompany = bid.isCompany;
      const travelCompanyId = bid.travelCompanyId;
      const {
        paymentId,
        paidByUserAmount,
        name,
        email,
        age,
        address,
        phone,
        travellers,
        processingFee,
        gatewayName,
      } = req.body;
      bid.gatewayName = gatewayName;
      await bid.save();
      const userRequestId = bid.requestId;
      const flightRequest = await FlightRequest.findById(userRequestId);
      flightRequest.status = "approved";
      await flightRequest.save();
      const isPaidFull = true;
      const agency = await travels.findById(agencyId);
      const bookingId = await getNextBookingNo();
      let paymentIdArray = [];

      if (gatewayName === "stripe") {
        paymentIdArray.push({
          id: paymentId,
          status: "completed",
          createdAt: new Date(),
        });
      } else if (gatewayName === "blinq") {
        paymentIdArray.push({
          id: paymentId,
          status: "pending",
          createdAt: new Date(),
        });
      }
      const saveBooking = new Booking({
        bookingId,
        paymentId: paymentIdArray,
        paidByUserAmount,
        agencyId,
        userId,
        name,
        email,
        age,
        address,
        requestId,
        bidRequestId,
        phone,
        travellers,
        requestType: "flight",
        totalAmount,
        dollarAmount,
        isPaidFull,
        eTicket: null,
        processingFee,
        gatewayName,
        isCompany,
        ...(travelCompanyId && { travelCompanyId }),
      });
      await saveBooking.save();
      if (gatewayName !== "blinq") {
        const stripePaymentToRegister = new stripePaymentTransaction({
          id: saveBooking._id,
          idModelType: "Agency Booking",
          paymentId,
          gatewayName,
          paidByUserAmount,
          isPaidFull,
        });
        stripeController = await stripePaymentToRegister.save();

        // Step 11: Update the bid request status to 'booked'

        // Step 12: Send a chat notification to the agency (ensure sendchatNotification is defined)
        sendchatNotification(
          agencyId._id, // Use the populated agency ID
          {
            title: "MediTour Global",
            message: "Your bid request has been accepted!",
          },
          "agency"
        );

        // Step 13: Create a new notification record for the agency
        const notification = new Notification({
          senderId: userId, // The user who accepted the bid
          senderModelType: "Users",
          receiverId: agencyId._id, // The agency receiving the notification
          receiverModelType: "Travel Agency",
          title: "MediTour Global",
          message: "Your bid request has been accepted!",
          createdAt: new Date(), // Timestamp for when the notification is created
        });
        await notification.save();

        if (travelCompanyId) {
          sendchatNotification(
            travelCompanyId, // Use the populated agency ID
            {
              title: "MediTour Global",
              message: `A Bid Request has been accepted against the travel agency named ${agency.name} and booking has been accepted!`,
            },
            "Travel Company"
          );

          // Step 13: Create a new notification record for the agency
          const notification = new Notification({
            senderId: userId, // The user who accepted the bid
            senderModelType: "Users",
            receiverId: travelCompanyId, // The agency receiving the notification
            receiverModelType: "Travel Company",
            title: "MediTour Global",
            message: `A Bid Request has been accepted against the travel agency named ${agency.name} and booking has been accepted`,
            createdAt: new Date(), // Timestamp for when the notification is created
          });
          await notification.save();
        }

        // Notify admins
        const admins = await Admin.find(); // Adjust this to match your admin retrieval logic

        const adminNotifications = admins.map((admin) => ({
          senderId: userId,
          senderModelType: "Users",
          receiverId: admin._id,
          receiverModelType: "Admin",
          title: "MediTour Global",
          message: `${name} paid ${paidByUserAmount} for ${flightRequest.flightClass} ${flightRequest.requestType} flight with ${agency.name} `,
        }));

        await Notification.insertMany(adminNotifications);

        admins.forEach((admin) => {
          sendchatNotification(
            admin._id,
            {
              title: "MediTour Global",
              message: `${name} paid ${paidByUserAmount} for ${flightRequest.flightClass} ${flightRequest.requestType} flight ith ${agency.name} `,
            },
            "admin"
          );
        });
      }
      bid.status = "booked";
      await bid.save();

      // Step 14: Return a success response
      res.json({
        auth: true,
        saveBooking,
        message: "Bid Request has been accepted successfully!",
      });
    } catch (error) {
      next(error); // Pass the error to the next middleware
    }
  },
  async getAllFlightRequests(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const flightReqPerPage = 10;

      // Get the total number of flight requests for the user
      const totalFlightReq = await FlightRequest.countDocuments({
        userId: req.user._id,
        status: { $ne: "approved" },
      });

      const totalPages = Math.ceil(totalFlightReq / flightReqPerPage); // Calculate the total number of pages

      const skip = (page - 1) * flightReqPerPage; // Calculate the number of bookings to skip based on the current page

      // Fetch flight requests for the current user, sorted by createdAt descending
      const flightRequests = await FlightRequest.find({
        userId: req.user._id,
        status: { $ne: "approved" },
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(flightReqPerPage);

      // Determine previous and next page numbers
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      // Return the flight requests with pagination metadata
      res.json({
        flightRequests,
        totalFlightReq,
        totalPages,
        previousPage: previousPage,
        nextPage: nextPage,
        auth: true,
      });
    } catch (error) {
      next(error); // Pass the error to the next error-handling middleware
    }
  },

  async deleteFlightRequest(req, res, next) {
    const flightRequestsId = req.query.flightRequestsId;
    const flightRequest = await FlightRequest.findById(flightRequestsId);

    if (!flightRequest) {
      return res.status(404).json([]); // Send empty response
    }
    await FlightRequest.deleteOne({ _id: flightRequestsId });
    return res
      .status(200)
      .json({ message: "Flight request deleted successfully" });
  },
};
module.exports = travelAgencyController;
