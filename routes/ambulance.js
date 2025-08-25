const express = require("express");
const ambulanceAuthController = require("../controller/Ambulance/ambulanceAuthController");
const ambulanceDashController = require("../controller/Ambulance/ambulanceDashController");
const RequestController = require("../controller/Ambulance/requestController");
const VerificationController = require("../controller/verificationController");
const auth = require('../middlewares/auth');
const uploadFileController = require("../controller/uploadFileController");
const multer = require("multer");
const router = express.Router();
const upload = multer({ dest: "temp/" });


//..............auth...............
router.post("/ambulance/register", ambulanceAuthController.register);
router.post("/ambulance/login", ambulanceAuthController.login);
router.post("/ambulance/uploadFile", upload.single("file"), uploadFileController.uploadFile);
router.post("/ambulance/completeSignup", ambulanceAuthController.completeSignup);
router.put("/ambulance/updateProfile", auth, ambulanceAuthController.updateProfile);
router.post("/ambulance/logout", auth, ambulanceAuthController.logout);
router.post("/ambulance/refresh", auth, ambulanceAuthController.refresh);

//..............verification.........
router.post("/ambulance/sendCodeToEmail", VerificationController.sendCodeToEmail);
router.post("/ambulance/confirmEmail", VerificationController.confirmEmail);
router.post("/ambulance/ResetLink", VerificationController.ResetLink);
router.post("/ambulance/resetPassword", VerificationController.resetPassword);

//...............dashboard...............
// router.get("/ambulance/dashDetails",auth, ambulanceDashController.dashDetails)
// router.get("/ambulance/graph",auth, ambulanceDashController.graph)
// router.post("/ambulance/addBooking", auth, ambulanceDashController.addBooking);
// router.get("/ambulance/getAllRecentRequests", auth, ambulanceDashController.getAllRecentRequests);
router.get("/ambulance/dashboard", auth, ambulanceDashController.dashboard);


//.............ambulance CRUD...............
// router.post("/ambulance/addAmbulance", auth, ambulanceCrudController.addAmbulance);
// router.put("/ambulance/editAmbulance", auth, ambulanceCrudController.editAmbulance);
// router.delete("/ambulance/deleteAmbulance", auth, ambulanceCrudController.deleteAmbulance);
// router.get("/ambulance/getAmbulance", auth, ambulanceCrudController.getAmbulance);
// router.get("/ambulance/getAllAmbulances", auth, ambulanceCrudController.getAllAmbulances);

//...............booking.......................
router.get("/ambulance/getAllRequests", auth, RequestController.getAllRequests);
router.get("/ambulance/getRequest", auth, RequestController.getRequest);
router.post("/ambulance/addBidRequest", auth, RequestController.addBidRequest);
// router.post("/ambulance/acceptRequest", auth, ambulanceRequestController.acceptRequest);
// router.post("/ambulance/rejectRequest", auth, ambulanceRequestController.rejectRequest);
// router.get("/ambulance/getOnRoutes", auth, ambulanceRequestController.getOnRoutes);
// router.post("/ambulance/bookRequest", auth, ambulanceRequestController.bookRequest);
// router.post("/ambulance/addRoute", auth, ambulanceRequestController.addRoute);
// router.put("/ambulance/changeOnRouteStatus",auth,ambulanceRequestController.changeOnRouteStatus);

///////new apis//////////
router.get("/ambulance/getAmbulanceBookings",auth,RequestController.getAmbulanceBookings);
router.put("/ambulance/changeBookingStatus",auth,RequestController.changeBookingStatus);

  //............Forgot Password Mobile...............//
  router.post("/ambulance/forgotPassword", VerificationController.forgotPassword);
  router.post("/ambulance/updatePassword", VerificationController.updatePassword);
  router.post("/ambulance/confirmEmail", VerificationController.confirmEmail);

module.exports = router;
