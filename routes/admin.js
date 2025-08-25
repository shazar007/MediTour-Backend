const express = require("express");
const auth = require("../middlewares/auth");
const multer = require("multer");
const adminLabController = require("../controller/Admin/adminLabController");
const specalityCrudController = require("../controller/Admin/specialityCrudController");
const adminAuthController = require("../controller/Admin/adminAuthController");
const adminAppointmentReqController = require("../controller/Admin/appointmentRequestController");
const adminAppointmentController = require("../controller/Admin/appointmentController");
const adminPaymentController = require("../controller/Admin/paymentController");
const orderController = require("../controller/Admin/orderController");
const bookingsController = require("../controller/Admin/bookingController");
const donationController = require("../controller/Admin/donationController");
const vendorController = require("../controller/Admin/vendorController");
const paymentPercentageController = require("../controller/paymentPercentageController");
const activationController = require("../controller/Admin/activationController");
const router = express.Router();
//............auth.......................//
router.post("/admin/register", adminAuthController.register);
router.post("/admin/login", adminAuthController.login);
router.post("/admin/logout", auth, adminAuthController.logout);

//............Paramedic...............
router.get("/admin/getParamedicRequests", auth, adminAppointmentController.getParamedicRequests);
router.put("/admin/acceptParamedicRequest", auth, adminAppointmentController.acceptParamedicRequest);
router.get("/admin/searchParamedic", adminAppointmentController.searchParamedic);

//............Lab...............
router.post("/admin/addTestCategory", adminLabController.addTestCategory);
router.delete("/admin/deleteTestCategory", adminLabController.deleteTestCategory);
router.get(
  "/admin/getAllTestCategories",
  adminLabController.getAllTestCategory
);
//......specialities......//

router.post("/admin/addSpeciality", specalityCrudController.addSpeciality);
router.delete("/admin/deleteSpeciality", specalityCrudController.deleteSpeciality);
router.get("/admin/getAllSpecialities", specalityCrudController.getAllSpecialities);

//...........appointment requests.............//
router.get("/admin/getRequests", auth, adminAppointmentReqController.getRequests);
router.get("/admin/getRequest", auth, adminAppointmentReqController.getRequest);
router.post("/admin/acceptRequest", auth, adminAppointmentReqController.acceptRequest);
router.post("/admin/forwardAppointmentToHospital", auth, adminAppointmentReqController.forwardAppointmentToHospital);
router.get("/admin/getRescheduledAppointments", adminAppointmentReqController.getRescheduledAppointments);
router.get("/admin/getOpdRequests", adminAppointmentReqController.getOpdRequests);

//............appointments..................//
router.get("/admin/getAppointments", auth, adminAppointmentController.getAppointments);
router.get("/admin/getAppointment", auth, adminAppointmentController.getAppointment);
router.get("/admin/getMedicineRequests", adminAppointmentController.getMedicineRequests);
router.post("/admin/acceptBidRequest", auth, adminAppointmentController.acceptBidRequest);
router.post("/admin/rejectRequest", adminAppointmentController.rejectRequest);
router.get("/admin/getBids", adminAppointmentController.getBids);
router.get("/admin/changeStatus", adminAppointmentController.changeStatus);

//.................orders......................//
router.get("/admin/getOrders", auth, orderController.getOrders);
router.get("/admin/getAllOrders", auth, orderController.getAllOrders);

//.................bookings......................//
router.get("/admin/getBookingsRentCar", auth, bookingsController.getBookingsRentCar);
router.get("/admin/getBookingsFlight", auth, bookingsController.getBookingsFlight);
router.get("/admin/getFlightPaymentsBooking", auth, bookingsController.getFlightPaymentsBooking);
router.get("/admin/getBookedBid", auth, bookingsController.getBookedBid);
router.get("/admin/getBookingsTours", auth, bookingsController.getBookingsTours);
router.get("/admin/getBookingsInsurance", auth, bookingsController.getBookingsInsurance);
router.get("/admin/getBookingsRequests", bookingsController.getBookingsRequests);
router.post("/admin/acceptHotelRequest", auth, bookingsController.acceptHotelRequest);
router.get("/admin/getBookingsHotels", auth, bookingsController.getBookingsHotels);
router.get("/admin/getBookingsAmbulance", auth, bookingsController.getBookingsAmbulance);

//.................donation...............//
router.get("/admin/getDonors", auth, donationController.getDonors);
router.get("/admin/getDonorDet", auth, donationController.getDonorDet);
//...................vendor................//
router.get("/admin/getAllVendors", vendorController.getAllVendors);
router.post("/admin/blockVendor", auth, vendorController.blockVendor);
router.put("/admin/recommendVendor", vendorController.recommendVendor);


//.................payToVendor.................//
router.post("/admin/payToVendor", auth, adminPaymentController.payToVendor);
router.get("/admin/getpaymentToVendors", adminPaymentController.getpaymentToVendors);

//............payment percentage...............
router.post("/admin/addPaymentPercentage", paymentPercentageController.addPaymentPercentage);
router.get("/admin/getPaymentPercentage", paymentPercentageController.getPaymentPercentage);
router.put("/admin/updatePaymentPercentage", paymentPercentageController.updatePaymentPercentage);
router.delete("/admin/deletePaymentPercentage", paymentPercentageController.deletePaymentPercentage);

//............payment percentage...............
router.get("/admin/getActivationRequest", activationController.getActivationRequest);
router.put("/admin/activateVendor", activationController.activateVendor);

module.exports = router;