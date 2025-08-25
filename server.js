const express = require("express");
const cron = require("node-cron");
const Appointment = require("./models/All Doctors Models/appointment");
const VehicleRequest = require("./models/Rent A Car/vehicleRequest");
const AcceptedRequest = require("./models/Rent A Car/acceptedRequests");
const FlightRequest = require("./models/Travel Agency/flightRequest");
const Vehicle = require("./models/Rent A Car/vehicle");
const Booking = require("./models/Travel Agency/booking");
const Tour = require("./models/Travel Agency/tour");
const AmbulanceBid = require("./models/Ambulance/bid");
const BidRequest = require("./models/Travel Agency/bid");
const HotelBookingRequest = require("./models/Hotel/bookHotelRequest");
const app = express();
const Laboratory = require("./models/Laboratory/laboratory");
const whitelist = ["http://localhost:3000", "https://meditour.global"];
require("dotenv").config();
const passport = require("passport");
const session = require("express-session");
app.use(
  session({ secret: "your-secret-key", resave: false, saveUninitialized: true })
);
require("./utils/passport");
app.use(passport.initialize());
app.use(passport.session());
// const cors = require("cors");

// const corsOptions = {
//   origin: function (origin, callback) {
//     if (whitelist.indexOf(origin) !== -1 || !origin) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
// };

// app.use(cors(corsOptions));
const cors = require("cors");

app.use(cors());

const cookieParser = require("cookie-parser");
app.use(cookieParser());
const dbConnect = require("./database/index");
const ErrorHandler = require("./middlewares/errorHandler");
const { PORT } = require("./config/index");
app.use(express.json({ limit: "50mb" }));
// Laboratory.ensureIndex({loc:"2d"})
cron.schedule("0 * * * *", async () => {
  // This will run every minute
  try {
    let currentTime = new Date();
    currentTime = new Date(currentTime.getTime() + 5 * 60 * 60 * 1000);
    // console.log("currentTime", currentTime);

    let currentDate = new Date();

    // Reset the time to the start of the day
    // currentDate.setHours(0, 0, 0, 0);

    // Add 5 hours to the start of the day
    let futureDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Convert futureDate to UTC using toISOString()
    futureDate = futureDate.toISOString();
    console.log("futureDate", futureDate);

    // Update Appointments with pending status where appointmentDateAndTime is less than currentTime
    const appointmentCondition = {
      status: "pending",
      appointmentDateAndTime: { $lt: futureDate },
    };
    const appointmentUpdate = { $set: { status: "cancelled" } };

    await Appointment.updateMany(appointmentCondition, appointmentUpdate);

    // Update VehicleRequests with pending status where pickupDateTime is less than currentTime
    const vehicleRequestCondition = {
      status: "pending",
      pickupDateTime: { $lt: currentTime },
    };
    const vehicleRequestUpdate = { $set: { status: "cancelled" } };

    await AcceptedRequest.updateMany(
      vehicleRequestCondition,
      vehicleRequestUpdate
    );

    // Update Bookings with unpaid status where departDate has arrived
    // const bookings = await Booking.find({
    //   isPaid: false,
    //   status: "pending",
    // }).populate("tourId", "departDate");

    // const bookingUpdates = bookings
    //   .filter((booking) => new Date(booking.tourId.departDate) <= currentTime)
    //   .map((booking) => {
    //     return Booking.updateOne(
    //       { _id: booking._id },
    //       { $set: { status: "cancelled" } }
    //     );
    //   });

    // await Promise.all(bookingUpdates);
  } catch (error) {
    console.error("Error updating documents:", error);
  }
});
cron.schedule("0 * * * *", async () => {
  // Runs at the start of every hour
  const now = new Date();
  const expirationTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

  try {
    await AmbulanceBid.deleteMany({
      status: { $in: ["pending", "rejected"] },
      createdAt: { $lt: expirationTime },
    });
  } catch (error) {
    console.error("Error deleting old bids:", error);
  }

  const expiredReservations = await HotelBookingRequest.find({
    isReservation: true,
    status: { $ne: "expired" },
    createdAt: { $lte: expirationTime },
  });

  for (const reservation of expiredReservations) {
    reservation.status = "expired";
    await reservation.save();
  }

  console.log(`Updated ${expiredReservations.length} reservations to expired.`);
});
cron.schedule("0 0 * * *", async () => {
  // This will run every hour
  try {
    const ongoingBookings = await AcceptedRequest.find({
      pickupDateTime: { $lte: currentTime },
      dropoffDateTime: { $gte: currentTime },
    });

    await Vehicle.updateMany({}, { $set: { isAvailable: true } });

    // Update the vehicles that are currently booked to not available
    const vehicleUpdates = ongoingBookings.map(async (request) => {
      const vehicle = await Vehicle.findById(request.vehicleId);
      if (vehicle) {
        vehicle.isAvailable = false;
        await vehicle.save();
      }
    });

    await Promise.all(vehicleUpdates);
  } catch (error) {
    console.error("Error updating documents:", error);
  }
});
// travel agency bids
// cron.schedule("0 * * * *", async () => {
//   // Runs at the start of every hour
//   const now = new Date();
//   // console.log("now", now)
//   const expirationTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

//   try {
//     await BidRequest.deleteMany({
//       status: { $in: ["pending", "rejected"] },
//       createdAt: { $lt: expirationTime },
//     });
//     console.log("runninggn");
//        // Get all flight requests where bidIds exist and related bids are expired
//     const flightRequests = await FlightRequest.find({
//       bidIds: { $exists: true, $ne: [] }, // Only consider flight requests with bids
//     });

//     // Loop through each flight request and check related bids' status
//     for (let flightRequest of flightRequests) {
//       // Fetch the bids associated with the flight request
//       const bids = await BidRequest.find({ _id: { $in: flightRequest.bidIds } });

//       // Filter out only the "pending" bids and check if all have expired
//       const pendingBids = bids.filter(bid => bid.status === "pending");

//       // Check if all "pending" bids have expired (i.e., their createdAt is older than expirationTime)
//       const allPendingBidsExpired = pendingBids.every(bid => bid.createdAt < expirationTime);

//       // If all pending bids have expired, update the flight request status to "pending"
//       if (allPendingBidsExpired) {
//         await FlightRequest.updateOne(
//           { _id: flightRequest._id },
//           { $set: { status: "pending", bidIds: [] } } // Clear the bidIds as well
//         );
//         console.log(`Flight request ${flightRequest._id} updated to 'pending'`);
//       } else {
//         // If any pending bids are still valid, keep the status as "bid sent"
//         await FlightRequest.updateOne(
//           { _id: flightRequest._id },
//           { $set: { status: "bid sent" } }
//         );
//         console.log(`Flight request ${flightRequest._id} kept as 'bid sent'`);
//       }
//     }
//     console.log("All relevant flight requests updated.");
//   } catch (error) {
//     console.error("Error deleting old bids and updating flight requests:", error);
//   }
// });

const labRouter = require("./routes/laboratory");
const pharmRouter = require("./routes/pharmacy");
const docRouter = require("./routes/doctor");
const hospRouter = require("./routes/hospital");
const ambulanceRouter = require("./routes/ambulance");
const agencyRouter = require("./routes/travelAgency");
const rentCarRouter = require("./routes/rentCar");
const donationRouter = require("./routes/donation");
const hotelRouter = require("./routes/hotel");
const insuranceRouter = require("./routes/insurance");
const userRouter = require("./routes/user");
const dummyUserRouter = require("./routes/dummyUser");
const paymentRouter = require("./routes/payment");
const adminRouter = require("./routes/admin");
const stripeRouter = require("./routes/stripe");
const pharmaceuticalRouter = require("./routes/pharmaceutical");
const blinqRouter = require("./routes/blinq");
const genRouter = require("./routes/general");
const docCompanyRouter = require("./routes/docCompany");
const travCompanyRouter = require("./routes/travelCompany");

app.use(labRouter);
app.use(pharmRouter);
app.use(docRouter);
app.use(hospRouter);
app.use(ambulanceRouter);
app.use(agencyRouter);
app.use(rentCarRouter);
app.use(donationRouter);
app.use(hotelRouter);
app.use(insuranceRouter);
app.use(userRouter);
app.use(dummyUserRouter);
app.use(adminRouter);
app.use(paymentRouter);
app.use(stripeRouter);
app.use(pharmaceuticalRouter);
app.use(blinqRouter);
app.use(genRouter);
app.use(docCompanyRouter);
app.use(travCompanyRouter);

const now = new Date();
// console.log("now", now);
const expirationTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
console.log("expirationTime", expirationTime);
// console.log("expirationTime", expirationTime);
// console.log("currentTime", currentTime);
app.get("/", (req, res) => {
  res.json("server is running in main!");
});
dbConnect();
app.use(ErrorHandler);
app.listen(PORT, () => {
  console.log("server running", PORT);
});
