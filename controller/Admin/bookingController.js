const Admin = require("../../models/Admin/Admin.js");
const AcceptedRequests = require("../../models/Rent A Car/acceptedRequests.js");
const FlightRequest = require("../../models/Travel Agency/flightRequest.js");
const BidRequest = require("../../models/Travel Agency/bid.js");
const TourBooking = require("../../models/Travel Agency/booking.js");
const InsuranceRequest = require("../../models/Insurance/insuranceRequest.js");
const { sendchatNotification } = require("../../firebase/service/index.js");
const Notification = require("../../models/notification.js");
const HotelBookingRequests = require("../../models/Hotel/bookHotelRequest");
const BookHotel = require("../../models/Hotel/bookhotel.js");
const AmbulanceBooking = require("../../models/Ambulance/booking.js");
const stripePaymentTransaction = require("../../models/stripeTransactions.js");
const exchangeRateApi = require("../../utils/ExchangeRate.js");

async function getNextBookingNo() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestVendor = await BookHotel.findOne({}).sort({ createdAt: -1 });

    let nextVendorId = 1;
    if (latestVendor && latestVendor.bookingId) {
      // Extract the numeric part of the orderId and increment it
      const currentVendorId = parseInt(latestVendor.bookingId.substring(3));
      nextVendorId = currentVendorId + 1;
    }

    // Generate the next orderId
    const nextOrderId = `BKG${nextVendorId.toString().padStart(4, "0")}`;

    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}

const adminOrdersController = {
  //..............rentCar................//
  async getBookingsRentCar(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const bookingsPerPage = 10;
      const mrNo = req.query.mrNo;
      const vendorId = req.query.vendorId;
      const paidToVendor = req.query.paidToVendor;
      const { startTime, endTime } = req.query;

      const query = {};
      if (startTime && endTime) {
        query.createdAt = {
          $gte: new Date(startTime),
          $lte: new Date(endTime),
        };
      }
      if (paidToVendor && paidToVendor === "true") {
        query.paidToVendor = true;
      } else if (paidToVendor && paidToVendor === "false") {
        query.paidToVendor = false;
      }

      let totalBookings = await AcceptedRequests.countDocuments(query);

      const totalPages = Math.ceil(totalBookings / bookingsPerPage);

      const skip = (page - 1) * bookingsPerPage;

      let allBookings = await AcceptedRequests.find(query)
        .sort({ createdAt: -1 })
        .populate({
          path: "vehicleId rentACarId userId",
          select: "-favourites", // Exclude the 'favourites' field from userId
        })
        .exec();
      if (mrNo) {
        const filteredRequests = allBookings.filter((booking) => {
          return booking.userId && booking.userId.mrNo === mrNo;
        });
        allBookings = filteredRequests;
        totalBookings = filteredRequests.length;
      }
      if (vendorId) {
        const filteredRequests = allBookings.filter((booking) => {
          return booking.rentACarId.vendorId === vendorId;
        });
        allBookings = filteredRequests;
        totalBookings = filteredRequests.length;
      }
      allBookings = allBookings.slice(skip, skip + bookingsPerPage);
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        bookings: allBookings,
        bookingsLength: totalBookings,
        previousPage: previousPage,
        nextPage: nextPage,
        totalPages: totalPages,
        auth: true,
      });
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },
  //..............flights................//
  async getBookingsFlight(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const bookingsPerPage = 10;
      const mrNo = req.query.mrNo;
      const { startTime, endTime } = req.query;

      const query = {};
      if (startTime && endTime) {
        query.createdAt = {
          $gte: new Date(startTime),
          $lte: new Date(endTime),
        };
      }

      let totalBookings = await FlightRequest.countDocuments(query);
      const totalPages = Math.ceil(totalBookings / bookingsPerPage);
      const skip = (page - 1) * bookingsPerPage;

      let allBookings = await FlightRequest.find(query)
        .sort({ createdAt: -1 })
        .populate({
          path: "userId",
          select: "-favourites", // Exclude the 'favourites' field from userId
        })
        .populate("bidIds")
        .exec();

      if (mrNo) {
        const filteredRequests = allBookings.filter((booking) => {
          return booking.userId && booking.userId.mrNo === mrNo;
        });
        allBookings = filteredRequests;
        totalBookings = filteredRequests.length;
      }

      allBookings = await Promise.all(
        allBookings.map(async (booking) => {
          const bidCount = await BidRequest.countDocuments({
            requestId: booking._id,
          });
          return {
            ...booking.toObject(), // Convert Mongoose document to plain object
            bidCount,
          };
        })
      );
      allBookings = allBookings.slice(skip, skip + bookingsPerPage);
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        bookings: allBookings,
        bookingsLength: totalBookings,
        auth: true,
        previousPage: previousPage,
        nextPage: nextPage,
        totalPages: totalPages,
      });
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },
  async getBookedBid(req, res, next) {
    try {
      const requestId = req.query.requestId;
      const page = parseInt(req.query.page) || 1;
      const bookingsPerPage = 10;

      let totalBookedBids = await BidRequest.countDocuments({
        requestId,
        status: "booked",
      });

      const totalPages = Math.ceil(totalBookedBids / bookingsPerPage);

      const skip = (page - 1) * bookingsPerPage;

      const bookedBid = await BidRequest.find({ requestId, status: "booked" });
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        bookedBid: bookedBid,
        auth: true,
        totalBookedBids,
        previousPage,
        nextPage,
        totalPages,
      });
    } catch (error) {
      next(error);
    }
  },
  async getFlightPaymentsBooking(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const bookingsPerPage = 10;
      const vendorId = req.query.vendorId;
      const paidToVendor = req.query.paidToVendor;
      const { startTime, endTime } = req.query;

      const query = {
        requestType: "flight",
      };
      if (startTime && endTime) {
        query.createdAt = {
          $gte: new Date(startTime),
          $lte: new Date(endTime),
        };
      }
      if (paidToVendor && paidToVendor === "true") {
        query.paidToVendor = true;
      } else if (paidToVendor && paidToVendor === "false") {
        query.paidToVendor = false;
      }

      let totalBookings = await TourBooking.countDocuments(query);
      const totalPages = Math.ceil(totalBookings / bookingsPerPage);
      const skip = (page - 1) * bookingsPerPage;

      let allBookings = await TourBooking.find(query)
        .sort({ createdAt: -1 })
        .populate("userId")
        .populate("requestId agencyId")
        .exec();

      if (vendorId) {
        const filteredRequests = allBookings.filter((booking) => {
          return booking.agencyId.vendorId === vendorId;
        });
        allBookings = filteredRequests;
        totalBookings = filteredRequests.length;
      }
      allBookings = allBookings.slice(skip, skip + bookingsPerPage);
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        bookings: allBookings,
        bookingsLength: totalBookings,
        totalPages,
        previousPage,
        nextPage,
        auth: true,
      });
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },
  //..............tours................//
  async getBookingsTours(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const bookingsPerPage = 10;
      const mrNo = req.query.mrNo;
      const vendorId = req.query.vendorId;
      const paidToVendor = req.query.paidToVendor;
      const { startTime, endTime } = req.query;

      const query = {
        requestType: "tour",
      };
      if (startTime && endTime) {
        query.createdAt = {
          $gte: new Date(startTime),
          $lte: new Date(endTime),
        };
      }
      if (paidToVendor && paidToVendor === "true") {
        query.paidToVendor = true;
      } else if (paidToVendor && paidToVendor === "false") {
        query.paidToVendor = false;
      }

      let totalBookings = await TourBooking.countDocuments(query);
      const totalPages = Math.ceil(totalBookings / bookingsPerPage);
      const skip = (page - 1) * bookingsPerPage;

      let allBookings = await TourBooking.find(query)
        .sort({ createdAt: -1 })
        .populate({
          path: "userId",
          select: "-favourites", // Exclude the 'favourites' field
        })
        .populate("tourId agencyId")
        .exec();

      if (mrNo) {
        const filteredRequests = allBookings.filter((booking) => {
          return booking.userId && booking.userId.mrNo === mrNo;
        });
        allBookings = filteredRequests;
        totalBookings = filteredRequests.length;
      }
      if (vendorId) {
        const filteredRequests = allBookings.filter((booking) => {
          return booking.agencyId.vendorId === vendorId;
        });
        allBookings = filteredRequests;
        totalBookings = filteredRequests.length;
      }
      allBookings = allBookings.slice(skip, skip + bookingsPerPage);
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        bookings: allBookings,
        bookingsLength: totalBookings,
        previousPage: previousPage,
        nextPage: nextPage,
        totalPages: totalPages,
        auth: true,
      });
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },
  //..............insurance................//
  async getBookingsInsurance(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const requestsPerPage = 10;
      const mrNo = req.query.mrNo;
      const vendorId = req.query.vendorId;
      const paidToVendor = req.query.paidToVendor;
      const { startTime, endTime } = req.query;

      const query = {};
      if (startTime && endTime) {
        query.createdAt = {
          $gte: new Date(startTime),
          $lte: new Date(endTime),
        };
      }
      if (paidToVendor && paidToVendor === "true") {
        query.paidToVendor = true;
      } else if (paidToVendor && paidToVendor === "false") {
        query.paidToVendor = false;
      }

      let totalRequests = await InsuranceRequest.countDocuments(query);
      const totalPages = Math.ceil(totalRequests / requestsPerPage);
      const skip = (page - 1) * requestsPerPage;

      let allBookings = await InsuranceRequest.find(query)
        .sort({ createdAt: -1 })
        .populate({
          path: "userId",
          select: "-favourites", // Exclude the 'favourites' field
        })
        .populate("insuranceCompanyId insuranceId")
        .exec();

      if (mrNo) {
        const filteredRequests = allBookings.filter((booking) => {
          return booking.userId && booking.userId.mrNo === mrNo;
        });
        allBookings = filteredRequests;
        totalRequests = filteredRequests.length;
      }
      if (vendorId) {
        const filteredRequests = allBookings.filter((booking) => {
          return (
            booking.insuranceCompanyId &&
            booking.insuranceCompanyId.vendorId === vendorId
          );
        });
        allBookings = filteredRequests;
        totalRequests = filteredRequests.length;
      }
      allBookings = allBookings.slice(skip, skip + requestsPerPage);
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;
      return res.status(200).json({
        bookings: allBookings,
        bookingsLength: totalRequests,
        previousPage: previousPage,
        nextPage: nextPage,
        totalPages: totalPages,
        auth: true,
      });
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },
  //..............hotel................//
  async getBookingsRequests(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const requestsPerPage = 10;

      // Get the total number of pending bookings for the hotel
      const totalBookings = await HotelBookingRequests.countDocuments({
        status: "pending",
      });

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalBookings / requestsPerPage);

      // Calculate the number of bookings to skip based on the current page
      const skip = (page - 1) * requestsPerPage;

      // Retrieve pending bookings with pagination and populate userId
      const bookings = await HotelBookingRequests.find({
        status: "pending",
      })
        .sort({ createdAt: -1 }) // Sort by createdAt field in descending order
        .skip(skip)
        .limit(requestsPerPage)
        .populate({
          path: "userId",
          select: "-favourites", // Exclude the 'favourites' field
        })
        .populate("hotelId", "name vendorId");

      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        requests: bookings,
        totalBookings: totalBookings,
        auth: true,
        previousPage: previousPage,
        nextPage: nextPage,
        totalPages: totalPages,
      });
    } catch (error) {
      return next(error);
    }
  },
  async acceptHotelRequest(req, res, next) {
    try {
      const requestId = req.query.requestId;
      const adminId = req.user._id;
      const {
        hotelId: newHotelId,
        serviceId: newServiceId,
        rooms: newRooms,
        apartments: newApartments,
        name: newName,
        age: newAge,
        address: newAddress,
        purpose: newPurpose,
        totalAmount: newTotalAmount,
        arrivalDate: newArrivalDate,
        noOfGuest: newNoOfGuest,
        remainingAmount: newremainingAmount,
      } = req.body;

      // Fetch the booking request based on the requestId
      const request = await HotelBookingRequests.findById(requestId).populate(
        "hotelId serviceId userId"
      );

      // Check if request is found
      if (!request) {
        return res.status(404).json([]);
      }

      // Check if the request is already accepted
      if (request.status === "accepted") {
        return res.status(200).json({
          auth: false,
          message: "Request already accepted!",
        });
      }

      // Log the current status to debug
      console.log("Before update:", request.status);

      // Update request details with new values provided by the admin
      request.hotelId = newHotelId || request.hotelId;
      request.serviceId = newServiceId || request.serviceId;
      request.rooms = newRooms || request.rooms;
      request.apartments = newApartments || request.apartments;
      request.name = newName || request.name;
      request.age = newAge || request.age;
      request.address = newAddress || request.address;
      request.purpose = newPurpose || request.purpose;
      request.totalAmount = newTotalAmount || request.totalAmount;
      request.arrivalDate = newArrivalDate || request.arrivalDate;
      request.noOfGuest = newNoOfGuest || request.noOfGuest;
      request.remainingAmount = newremainingAmount || request.remainingAmount;

      // Change the status to "accepted"
      request.status = "accepted";
      request.markModified("status");

      // Save the updated request
      await request.save();

      // Log the updated status to verify it has changed
      console.log("After update:", request.status);

      // If everything looks good, proceed with creating the booking
      const {
        paymentId,
        paidByUserAmount,
        serviceModelType,
        userId,
        name,
        email,
        age,
        address,
        purpose,
        totalAmount,
        arrivalDate,
        processingFee,
        isPaidFull,
        gatewayName,
        remainingAmount,
        isCompany,
        travelCompanyId,
      } = request;

      const bookingId = await getNextBookingNo();
      const dollarAmount = await exchangeRateApi(totalAmount);

      const booking = new BookHotel({
        bookingId,
        paymentId,
        paidByUserAmount,
        hotelId: request.hotelId,
        serviceId: request.serviceId,
        serviceModelType,
        rooms: request.rooms,
        apartments: request.apartments,
        noOfGuest: request.noOfGuest,
        userId: userId._id,
        name: request.name,
        email: userId.email,
        age: request.age,
        address: request.address,
        purpose: request.purpose,
        totalAmount: request.totalAmount,
        dollarAmount,
        arrivalDate: request.arrivalDate,
        processingFee,
        isPaidFull,
        gatewayName,
        remainingAmount,
        ...(travelCompanyId && { travelCompanyId }),
        isCompany,
      });

      await booking.save();

      // Update the stripe transaction ID
      const stripeTransaction = await stripePaymentTransaction.findOne({
        id: requestId,
      });
      stripeTransaction.id = booking._id;
      stripeTransaction.idModelType = "Hotel Booking";
      await stripeTransaction.save();

      // Send notifications to user and hotel
      sendchatNotification(
        userId._id,
        {
          title: "MediTour Global",
          message: `Your booking request has been accepted.`,
        },
        "user"
      );

      sendchatNotification(
        request.hotelId._id,
        {
          title: "MediTour Global",
          message: `You have received a new booking`,
        },
        "travel"
      );

      // Create a notification for the user
      const notification = new Notification({
        senderId: adminId,
        senderModelType: "Admin",
        receiverId: userId._id,
        receiverModelType: "Users",
        title: "MediTour Global",
        message: "Your booking request has been accepted",
      });
      await notification.save();

      // Create a notification for the hotel
      const hotelNotification = new Notification({
        senderId: adminId,
        senderModelType: "Admin",
        receiverId: request.hotelId._id,
        receiverModelType: "Hotel",
        title: "MediTour Global",
        message: `You have received a new booking`,
      });
      await hotelNotification.save();

      // Send the response with the booking details
      res.status(200).json({
        auth: true,
        booking,
        message: "Booking Accepted successfully",
      });
    } catch (error) {
      // Log any errors to understand where the issue is
      console.error("Error occurred:", error);
      next(error);
    }
  },


  //.........new api.........//
  async acceptHotelRequest(req, res, next) {
    try {
      const requestId = req.query.requestId;
      const adminId = req.user._id;

      const request = await HotelBookingRequests.findById(requestId).populate(
        "hotelId propertyId userId"
      );

      if (!request) {
        return res.status(404).json({ message: "Booking request not found." });
      }
      if (request.isReservation) {
        return res.status(404).json({ message: "The Hotel has not paid for the reservation yet!" });
      }
      if (request.status == "expired") {
        return res.status(404).json({ message: "The reservation has expired!" });
      }

      if (request.status === "accepted") {
        return res.status(200).json({
          auth: false,
          message: "Request already accepted!",
        });
      }

      request.status = "accepted";
      request.markModified("status");
      await request.save();

      const {
        paymentId,
        paidByUserAmount,
        propertyId,
        hotelId,
        userId,
        name,
        email,
        age,
        address,
        totalAmount,
        arrivalDate,
        processingFee,
        isPaidFull,
        gatewayName,
        remainingAmount,
        isCompany,
        travelCompanyId,
        noOfGuest,
        spaceNumbers,
        spaceType
      } = request;

      const bookingId = await getNextBookingNo();

      const dollarAmount = await exchangeRateApi(totalAmount);

      const booking = new BookHotel({
        bookingId,
        paymentId,
        paidByUserAmount,
        hotelId,
        propertyId,
        noOfGuest,
        userId: userId._id,
        name,
        email,
        age,
        address,
        totalAmount,
        dollarAmount,
        arrivalDate,
        processingFee,
        isPaidFull,
        gatewayName,
        remainingAmount,
        isCompany,
        ...(travelCompanyId && { travelCompanyId }),
        spaceNumbers,
        spaceType
      });

      await booking.save();

      const stripeTransaction = await stripePaymentTransaction.findOne({
        id: requestId,
      });
      if (stripeTransaction) {
        stripeTransaction.id = booking._id;
        stripeTransaction.idModelType = "Hotel Booking";
        await stripeTransaction.save();
      }

      sendchatNotification(
        userId._id,
        {
          title: "MediTour Global",
          message: `Your booking request has been accepted.`,
        },
        "user"
      );

      sendchatNotification(
        request.hotelId._id,
        {
          title: "MediTour Global",
          message: `You have received a new booking.`,
        },
        "travel"
      );

      const userNotification = new Notification({
        senderId: adminId,
        senderModelType: "Admin",
        receiverId: userId._id,
        receiverModelType: "Users",
        title: "MediTour Global",
        message: "Your booking request has been accepted.",
      });
      await userNotification.save();

      const hotelNotification = new Notification({
        senderId: adminId,
        senderModelType: "Admin",
        receiverId: request.hotelId._id,
        receiverModelType: "Hotel",
        title: "MediTour Global",
        message: `You have received a new booking.`,
      });
      await hotelNotification.save();

      res.status(200).json({
        auth: true,
        booking,
        message: "Booking accepted successfully.",
      });
    } catch (error) {
      return next(error);
    }
  },

  async getBookingsHotels(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const bookingsPerPage = 10;
      const mrNo = req.query.mrNo;
      const vendorId = req.query.vendorId;
      const paidToVendor = req.query.paidToVendor;
      const { startTime, endTime } = req.query;

      const query = {};
      if (startTime && endTime) {
        query.createdAt = {
          $gte: new Date(startTime),
          $lte: new Date(endTime),
        };
      }
      if (paidToVendor && paidToVendor === "true") {
        query.paidToVendor = true;
      } else if (paidToVendor && paidToVendor === "false") {
        query.paidToVendor = false;
      }
      let totalBookings = await BookHotel.countDocuments(query);
      const totalPages = Math.ceil(totalBookings / bookingsPerPage);
      const skip = (page - 1) * bookingsPerPage;

      let allBookings = await BookHotel.find(query)
        .sort({ createdAt: -1 })
        .populate("hotelId")
        .populate({
          path: "userId",
          select: "-favourites", // Exclude the 'favourites' field
        })
        .skip(skip)
        .limit(bookingsPerPage)
        .exec();

      if (mrNo) {
        const filteredRequests = allBookings.filter((booking) => {
          return booking.userId && booking.userId.mrNo == mrNo;
        });
        allBookings = filteredRequests;
        totalBookings = filteredRequests.length;
      }
      if (vendorId) {
        const filteredRequests = allBookings.filter((booking) => {
          return booking.hotelId.vendorId === vendorId;
        });
        allBookings = filteredRequests;
        totalBookings = filteredRequests.length;
      }
      allBookings = allBookings.slice(skip, skip + bookingsPerPage);
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        bookings: allBookings,
        bookingsLength: totalBookings,
        auth: true,
        totalBookings,
        totalPages,
        previousPage,
        nextPage,
      });
    } catch (error) {
      res.status(500).json({
        status: "Failure",
        error: error.message,
      });
    }
  },
  async getBookingsAmbulance(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const bookingsPerPage = 10;
      const mrNo = req.query.mrNo;
      const vendorId = req.query.vendorId;
      const paidToVendor = req.query.paidToVendor;
      const { startTime, endTime } = req.query;

      const query = {};
      if (startTime && endTime) {
        query.createdAt = {
          $gte: new Date(startTime),
          $lte: new Date(endTime),
        };
      }
      if (paidToVendor && paidToVendor === "true") {
        query.paidToVendor = true;
      } else if (paidToVendor && paidToVendor === "false") {
        query.paidToVendor = false;
      }

      let allBookings = await AmbulanceBooking.find(query)
        .sort({ createdAt: -1 })
        .populate("bidRequestId requestId ambulanceId")
        .populate({
          path: "userId",
          select: "-favourites", // Exclude the 'favourites' field
        })
        .exec();

      if (mrNo) {
        allBookings = allBookings.filter((booking) => {
          return booking.userId && booking.userId.mrNo == mrNo;
        });
      }
      if (vendorId) {
        allBookings = allBookings.filter((booking) => {
          return booking.ambulanceId.vendorId === vendorId; // Assuming you meant ambulanceId here
        });
      }

      const totalBookings = allBookings.length;
      const totalPages = Math.ceil(totalBookings / bookingsPerPage);
      const skip = (page - 1) * bookingsPerPage;
      allBookings = allBookings.slice(skip, skip + bookingsPerPage);
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        bookings: allBookings,
        bookingsLength: totalBookings,
        totalPages,
        currentPage: page,
        previousPage,
        nextPage,
        auth: true,
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
