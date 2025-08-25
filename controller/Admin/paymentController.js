const Admin = require("../../models/Admin/Admin.js");
const Order = require("../../models/order.js");
const AgencyBooking = require("../../models/Travel Agency/booking.js");
const HotelBooking = require("../../models/Hotel/bookhotel.js");
const AcceptedRequests = require("../../models/Rent A Car/acceptedRequests.js");
const InsuranceBooking = require("../../models/Insurance/insuranceBooking.js");
const ParamedicRequest = require("../../models/Paramedic/request.js");
const { sendchatNotification } = require("../../firebase/service/index.js");
const Notification = require("../../models/notification");
const Appointment = require("../../models/All Doctors Models/appointment.js");
const Donations = require("../../models/Donation/donations.js");
const PayToVendor = require("../../models/Admin/paymentToVendors.js");
const MedicineRequest = require("../../models/Pharmacy/medicineRequest.js");
const AmbulanceBooking = require("../../models/Ambulance/booking.js");
const Joi = require("joi");

async function getNextPaymentId() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestPayment = await PayToVendor.findOne({}).sort({ createdAt: -1 });

    let nextPaymentId = 1;
    if (latestPayment && latestPayment.paymentId) {
      // Extract the numeric part of the orderId and increment it
      const currentPaymentId = parseInt(latestPayment.paymentId.substring(3));
      nextPaymentId = currentPaymentId + 1;
    }
    // Generate the next orderId
    const nextId = `PAY${nextPaymentId.toString().padStart(4, "0")}`;
    return nextId;
  } catch (error) {
    console.error("Error in getnextPaymentId:", error);
    throw new Error("Failed to generate order number");
  }
}

const adminPaymentController = {
  async payToVendor(req, res, next) {
    try {
      const paymentToVendorsSchema = Joi.object({
        vendorId: Joi.string().required(),
        vendorModelType: Joi.string().required(),
        items: Joi.array().required(),
        itemModelType: Joi.string().required(),
        noOfitems: Joi.number().required(),
        totalAmount: Joi.number().required(),
        totalTax: Joi.number().required(),
        payableAmount: Joi.number().required(),
        receiptImage: Joi.string().required(),
      });

      const { error } = paymentToVendorsSchema.validate(req.body);

      if (error) {
        return next(error);
      }

      const adminId = req.user._id;
      const {
        vendorId,
        vendorModelType,
        items,
        itemModelType,
        noOfitems,
        totalAmount,
        totalTax,
        payableAmount,
        receiptImage,
      } = req.body;
      // Define valid combinations for itemModelType and vendorModelType
      const validCombinations = [
        { itemModelType: "Order", vendorModelType: "Laboratory" },
        { itemModelType: "MedicineRequest", vendorModelType: "Pharmacy" },
        { itemModelType: "Hotel Booking", vendorModelType: "Hotel" },
        { itemModelType: "Insurance Booking", vendorModelType: "Insurance" },
        {
          itemModelType: "Accepted Vehicle Request",
          vendorModelType: "Rent A Car",
        },
        { itemModelType: "Agency Booking", vendorModelType: "Travel Agency" },
        { itemModelType: "Appointment", vendorModelType: "Doctor" },
        { itemModelType: "Appointment", vendorModelType: "Hospital" },
        { itemModelType: "Appointment", vendorModelType: "Doctor Company" },
        {
          itemModelType: "Ambulance Booking",
          vendorModelType: "Ambulance Company",
        },
        { itemModelType: "Donations", vendorModelType: "Donation Company" },
        { itemModelType: "ParamedicRequest", vendorModelType: "Doctor" },
      ];

      // Check if the combination of itemModelType and vendorModelType is valid
      const isValidCombination = validCombinations.some(
        (pair) =>
          pair.itemModelType === itemModelType &&
          pair.vendorModelType === vendorModelType
      );

      if (!isValidCombination) {
        return res.status(400).json({
          error: `Invalid item model type.`,
        });
      }
      let payment;

      try {
        // Check the status of each order
        if (itemModelType === "Order") {
          const orders = await Order.find({ _id: { $in: items } });
          const allCompleted = orders.every(
            (order) => order.status === "completed"
          );
          const anyPaidToVendor = orders.some(
            (order) => order.paidToVendor === true
          );

          if (!allCompleted) {
            return res.status(400).json({
              error: "Payment can only be made if all orders are completed.",
            });
          }

          if (anyPaidToVendor) {
            return res.status(400).json({
              error:
                "Payment cannot be made if any order has already been paid to the vendor.",
            });
          }
        } else if (itemModelType === "Agency Booking") {
          const agencyBookings = await AgencyBooking.find({
            _id: { $in: items },
          });
          const anyPaidToVendor = agencyBookings.some(
            (order) => order.paidToVendor === true
          );

          if (anyPaidToVendor) {
            return res.status(400).json({
              error:
                "Payment cannot be made if any booking has already been paid to the vendor.",
            });
          }
        } else if (itemModelType === "Hotel Booking") {
          const bookings = await HotelBooking.find({ _id: { $in: items } });
          const allCompleted = bookings.every(
            (order) => order.isPaidFull === true
          );
          const anyPaidToVendor = bookings.some(
            (order) => order.paidToVendor === true
          );

          if (!allCompleted) {
            return res.status(400).json({
              error:
                "Payment can only be made if all bookings are paid by the user.",
            });
          }

          if (anyPaidToVendor) {
            return res.status(400).json({
              error:
                "Payment cannot be made if any booking has already been paid to the vendor.",
            });
          }
        } else if (itemModelType === "Accepted Vehicle Request") {
          const bookings = await AcceptedRequests.find({ _id: { $in: items } });
          const allCompleted = bookings.every(
            (order) => order.status === "completed"
          );
          const anyPaidToVendor = bookings.some(
            (order) => order.paidToVendor === true
          );

          if (!allCompleted) {
            return res.status(400).json({
              error: "Payment can only be made if all bookings are completed.",
            });
          }

          if (anyPaidToVendor) {
            return res.status(400).json({
              error:
                "Payment cannot be made if any booking has already been paid to the vendor.",
            });
          }
        } else if (itemModelType === "Insurance Booking") {
          const bookings = await InsuranceBooking.find({ _id: { $in: items } });
          const anyPaidToVendor = bookings.some(
            (order) => order.paidToVendor === true
          );

          if (anyPaidToVendor) {
            return res.status(400).json({
              error:
                "Payment cannot be made if any booking has already been paid to the vendor.",
            });
          }
        } else if (
          itemModelType === "Appointment" &&
          (vendorModelType === "Doctor" ||
            vendorModelType === "Hospital" ||
            vendorModelType === "Doctor Company")
        ) {
          const appointments = await Appointment.find({ _id: { $in: items } });
          const anyPaidToVendor = appointments.some(
            (appointment) => appointment.paidToVendor === true
          );
          const completedAppointment = appointments.every(
            (order) => order.status === "completed"
          );
          if (!completedAppointment) {
            return res.status(400).json({
              error:
                "Payment can only be made if all appointments are completed.",
            });
          }

          if (anyPaidToVendor) {
            return res.status(400).json({
              error:
                "Payment cannot be made if any booking has already been paid to the vendor.",
            });
          }
        } else if (itemModelType === "Donations") {
          const donations = await Donations.find({ _id: { $in: items } });
          const anyPaidToVendor = donations.some(
            (donation) => donation.paidToVendor === true
          );

          if (anyPaidToVendor) {
            return res.status(400).json({
              error:
                "Payment cannot be made if any booking has already been paid to the vendor.",
            });
          }
        } else if (itemModelType === "ParamedicRequest") {
          const paramedicRequests = await ParamedicRequest.find({
            _id: { $in: items },
          });
          const anyPaidToVendor = paramedicRequests.some(
            (request) => request.paidToVendor === true
          );

          if (anyPaidToVendor) {
            return res.status(400).json({
              error:
                "Payment cannot be made if any booking has already been paid to the vendor.",
            });
          }
        } else if (itemModelType === "MedicineRequest") {
          const medicineRequests = await MedicineRequest.find({
            _id: { $in: items },
          });
          const anyPaidToVendor = medicineRequests.some(
            (request) => request.paidToVendor === true
          );
          const completedMedReq = medicineRequests.every(
            (order) => order.status === "completed"
          );
          if (!completedMedReq) {
            return res.status(400).json({
              error:
                "Payment can only be made if all appointments are completed.",
            });
          }
          if (anyPaidToVendor) {
            return res.status(400).json({
              error:
                "Payment cannot be made if any booking has already been paid to the vendor.",
            });
          }
        } else if (itemModelType === "Ambulance Booking") {
          const ambulanceBookings = await AmbulanceBooking.find({
            _id: { $in: items },
          });
          const anyPaidToVendor = ambulanceBookings.some(
            (request) => request.paidToVendor === true
          );
          const completedAmbulanceBooking = ambulanceBookings.every(
            (order) => order.status === "completed"
          );
          if (!completedAmbulanceBooking) {
            return res.status(400).json({
              error:
                "Payment can only be made if all ambulance booking are completed.",
            });
          }
          if (anyPaidToVendor) {
            return res.status(400).json({
              error:
                "Payment cannot be made if any booking has already been paid to the vendor.",
            });
          }
        }
        const paymentId = await getNextPaymentId();
        const paymentToRegister = new PayToVendor({
          paymentId,
          adminId,
          vendorId,
          vendorModelType,
          items,
          itemModelType,
          noOfitems,
          totalAmount,
          totalTax,
          payableAmount,
          receiptImage,
        });

        payment = await paymentToRegister.save();

        if (itemModelType === "Order") {
          await Promise.all(
            items.map(async (itemId) => {
              await Order.findByIdAndUpdate(itemId, { paidToVendor: true });
            })
          );
        } else if (itemModelType === "Agency Booking") {
          await Promise.all(
            items.map(async (itemId) => {
              await AgencyBooking.findByIdAndUpdate(itemId, {
                paidToVendor: true,
              });
            })
          );
        } else if (itemModelType === "Hotel Booking") {
          await Promise.all(
            items.map(async (itemId) => {
              await HotelBooking.findByIdAndUpdate(itemId, {
                paidToVendor: true,
              });
            })
          );
        } else if (itemModelType === "Accepted Vehicle Request") {
          await Promise.all(
            items.map(async (itemId) => {
              await AcceptedRequests.findByIdAndUpdate(itemId, {
                paidToVendor: true,
              });
            })
          );
        } else if (itemModelType === "Insurance Booking") {
          await Promise.all(
            items.map(async (itemId) => {
              await InsuranceBooking.findByIdAndUpdate(itemId, {
                paidToVendor: true,
              });
            })
          );
        } else if (itemModelType === "Appointment") {
          await Promise.all(
            items.map(async (itemId) => {
              await Appointment.findByIdAndUpdate(itemId, {
                paidToVendor: true,
              });
            })
          );
        } else if (itemModelType === "ParamedicRequest") {
          await Promise.all(
            items.map(async (itemId) => {
              await ParamedicRequest.findByIdAndUpdate(itemId, {
                paidToVendor: true,
              });
            })
          );
        } else if (itemModelType === "MedicineRequest") {
          await Promise.all(
            items.map(async (itemId) => {
              await MedicineRequest.findByIdAndUpdate(itemId, {
                paidToVendor: true,
              });
            })
          );
        } else if (itemModelType === "Ambulance Booking") {
          await Promise.all(
            items.map(async (itemId) => {
              await AmbulanceBooking.findByIdAndUpdate(itemId, {
                paidToVendor: true,
              });
            })
          );
        }

        let notificationMessage = `You have received payment of ${payableAmount} against ${itemModelType}.`;

        if (itemModelType === "Order") {
          const orders = await Order.find({ _id: { $in: items } });
          notificationMessage = `You have received payment of ${payableAmount}.`;
        } else if (itemModelType === "Donations") {
          notificationMessage = `You have received donation of ${payableAmount}.`;
        } else if (itemModelType === "Insurance Booking") {
          notificationMessage = `You have received payment of ${payableAmount} against Insurance Booking.`;
        } else if (itemModelType === "Hotel Booking") {
          notificationMessage = `You have received payment of ${payableAmount}.`;
        } else if (itemModelType === "Ambulance Booking") {
          notificationMessage = `You have received payment of ${payableAmount}.`;
        } else {
          notificationMessage = `You have received payment of ${payableAmount} against ${itemModelType}.`;
        }

        sendchatNotification(
          vendorId,
          {
            title: "MediTour Global",
            message: notificationMessage,
          },
          "vendorModelType"
        );
        const patientNotification = new Notification({
          senderId: adminId,
          senderModelType: "Admin",
          receiverId: vendorId,
          receiverModelType: "vendorModelType",
          title: "MediTour Global",
          message: notificationMessage,
        });
        await patientNotification.save();
      } catch (error) {
        return next(error);
      }

      return res.status(201).json({ paymentToVendor: payment, auth: true });
    } catch (error) {
      next(error);
    }
  },
  async getpaymentToVendors(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const paymentsPerPage = 10;
      const requestType = req.query.requestType;
      const vendorModelType = req.query.vendorModelType;
      const id = req.query.id;
      const keyword = req.query.keyword?.trim(); // Keyword for searching vendor name, email, or paymentId

      let query = {};
      query.vendorModelType = vendorModelType;

      if (id) {
        query.vendorId = id;
      }

      console.log("query before population:", query);

      // Dynamically determine the vendor model based on vendorModelType
      let VendorModel;
      switch (vendorModelType) {
        case "Users":
          VendorModel = require("../../models/User/user.js"); // Replace with actual model
          break;
        case "Laboratory":
          VendorModel = require("../../models/Laboratory/laboratory.js"); // Replace with actual model
          break;
        case "Pharmacy":
          VendorModel = require("../../models/Pharmacy/pharmacy.js"); // Replace with actual model
          break;
        case "Doctor":
          VendorModel = require("../../models/Doctor/doctors.js"); // Replace with actual model
          break;
        case "Hospital":
          VendorModel = require("../../models/Hospital/hospital.js"); // Replace with actual model
          break;
        case "Ambulance Company":
          VendorModel = require("../../models/Ambulance/ambulanceCompany.js"); // Replace with actual model
          break;
        case "Donation Company":
          VendorModel = require("../../models/Donation/donationCompany.js"); // Replace with actual model
          break;
        case "Hotel":
          VendorModel = require("../../models/Hotel/hotel.js"); // Replace with actual model
          break;
        case "Rent A Car":
          VendorModel = require("../../models/Rent A Car/rentCar.js"); // Replace with actual model
          break;
        case "Travel Agency":
          VendorModel = require("../../models/Travel Agency/travelAgency.js"); // Replace with actual model
          break;
        case "Insurance":
          VendorModel = require("../../models/Insurance/insurance.js"); // Replace with actual model
          break;
        case "Doctor Company":
          VendorModel = require("../../models/DoctorCompany/docCompany.js"); // Replace with actual model
          break;
        // Add more cases as needed
        default:
          throw new Error("Invalid vendor model type");
      }

      // Add keyword search to the query if keyword is provided
      if (keyword) {
        const regex = new RegExp(keyword, "i"); // Case-insensitive regex for keyword search

        // Search for matching vendor IDs based on name or email
        const vendorIds = await VendorModel.find({
          $or: [
            { name: { $regex: regex } }, // Search by name
            { email: { $regex: regex } }, // Search by email
          ],
        }).distinct("_id"); // Get all vendor IDs that match the keyword

        // Add paymentId search to the query
        query.$or = [
          { vendorId: { $in: vendorIds } }, // Match vendor IDs
          { paymentId: { $regex: regex } }, // Match paymentId
        ];
      }

      const totalPayments = await PayToVendor.countDocuments(query);
      const totalPages = Math.ceil(totalPayments / paymentsPerPage);
      const skip = (page - 1) * paymentsPerPage;

      let payments = await PayToVendor.find(query)
        .populate({
          path: "vendorId",
          model: VendorModel, // Use the dynamically determined vendor model
        })
        .populate({
          path: "items",
          match: requestType ? { requestType: requestType } : {},
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(paymentsPerPage);

      // Filter out payments where items are null (due to population match)
      payments = payments.filter(
        (payment) => payment.items && payment.items.length > 0
      );

      console.log(payments);

      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        payments: payments,
        paymentsLength: totalPayments,
        previousPage: previousPage,
        nextPage: nextPage,
        totalPages: totalPages,
        auth: true,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = adminPaymentController;
