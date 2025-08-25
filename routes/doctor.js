const express = require("express");
const docAuthController = require("../controller/Doctor/doctorAuthController");
const VerificationController = require("../controller/verificationController");
const docAvailabilityController = require("../controller/All Doctors Controllers/generalAvailabilityController")
const docAppointController = require("../controller/All Doctors Controllers/generalAppointmentController")
const generalDashController = require("../controller/All Doctors Controllers/generalDashController")
const generalRequestController = require("../controller/All Doctors Controllers/generalRequestController")
const docParamedicController = require('../controller/Doctor/doctorParamedicController')
const auth = require('../middlewares/auth');
const uploadFileController = require("../controller/uploadFileController");
const multer = require("multer");
const hospDocController = require("../controller/Hospital/hospDocController");
const router = express.Router();
const upload = multer({ dest: "temp/" });


//............auth...............
router.post("/doc/register", docAuthController.register);
router.post("/doc/login", docAuthController.login);
router.post("/doc/uploadFile", upload.single("file"), uploadFileController.uploadFile);
router.post("/doc/completeSignup", docAuthController.completeSignup);
router.put("/doc/updateProfile", auth, docAuthController.updateProfile);
router.post("/doc/logout", auth, docAuthController.logout);
router.post("/doc/refresh", auth, docAuthController.refresh);
router.post("/doc/acceptInvitation", auth, docAuthController.acceptInvitation);

//............Dashboard.................
router.get("/doc/dashDetails", auth, generalDashController.dashDetails);
router.get("/doc/graph", auth, generalDashController.graph);

//............availability............
router.post("/doc/addAvailability", auth, docAvailabilityController.addAvailability);
router.patch("/doc/addAvailabilityPrice", auth, docAvailabilityController.addAvailabilityPrice);
router.delete("/doc/deleteAvailability", auth, docAvailabilityController.deleteAvailability);
router.get("/doc/getAvailability", auth, docAvailabilityController.getAvailability);
router.get("/doc/getAvailabilityHospitals", auth, docAvailabilityController.getAvailabilityHospitals);
router.get("/doc/getSingleHospAvailability", auth, docAvailabilityController.getSingleHospAvailability);
router.get("/doc/getDocHospitals", auth, docAvailabilityController.getDocHospitals);

//............appointments..............
router.get("/doc/getAllAppointments", auth, docAppointController.getAllAppointments);
router.get("/doc/getAllPatients", auth, docAppointController.getAllPatients);
router.get("/doc/patientHistory", auth, docAppointController.patientHistory);
router.get("/doc/getAppointment", auth, docAppointController.getAppointment);
router.post("/doc/appointmentLink", auth, docAppointController.appointmentLink);
router.get("/doc/searchProduct", docAppointController.searchProduct);
router.post("/doc/addTreatment", auth, docAppointController.addTreatment);
router.get("/doc/getTreatmentCategories", docAppointController.getTreatmentCategories);
router.get("/doc/getAllTreatment", auth, docAppointController.getAllTreatment);
router.delete("/doc/deleteTreatment", docAppointController.deleteTreatment);
router.put("/doc/updateTreatment", docAppointController.updateTreatment);
router.get("/doc/getTreatmentMainCategories", docAppointController.getTreatmentMainCategories);
router.get("/doc/getTreatmentList",hospDocController.getTreatmentList);


//.............Appointment Requests........................
router.get("/doc/getRequests", auth, generalRequestController.getRequests);
router.post("/doc/acceptRequest", auth, generalRequestController.acceptRequest);
router.delete("/doc/rejectRequest", auth, generalRequestController.rejectRequest);

//.............Appointment......................//
router.post("/doc/addHistory", auth, generalRequestController.addHistory);
router.post("/doc/addPrescription", auth, generalRequestController.addPrescription);
router.get("/doc/getPrescription", generalRequestController.getPrescription);
router.get("/doc/searchDoctor", auth, generalRequestController.searchDoctor);
router.post("/doc/referDoctor", auth, generalRequestController.referDoctor);
router.post("/doc/closeAppointment", auth, generalRequestController.closeAppointment);
router.get("/doc/searchHospital", auth, generalRequestController.searchHospital);

//..............verification.........
router.post("/doc/sendCodeToEmail", VerificationController.sendCodeToEmail);
router.post("/doc/confirmEmail", VerificationController.confirmEmail);
router.post("/doc/ResetLink", VerificationController.ResetLink);
router.post("/doc/resetPassword", VerificationController.resetPassword);

//............Forgot Password Mobile...............//
router.post("/doc/forgotPassword", VerificationController.forgotPassword);
router.post("/doc/updatePassword", VerificationController.updatePassword);

//............Forgot Password Mobile...............//
router.get("/doc/getParamedicRequests", auth, docParamedicController.getParamedicRequests);
router.put("/doc/changeRequestStatus", auth, docParamedicController.changeRequestStatus);

router.get("/doc/getTreatmentList", auth, hospDocController.getTreatmentList);
router.get(
    "/doc/treatmentsByCategory",
    docAppointController.treatmentsByCategory
  );
router.get(
    "/doc/getHospitals", auth,
    hospDocController.getHospitals
  );

module.exports = router;
