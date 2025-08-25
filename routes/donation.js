const express = require("express");
const donationAuthController = require("../controller/Donation/donationAuthController");
const donationpackageController = require("../controller/Donation/donationPackageController");
const donationDonationsController = require("../controller/Donation/donationDonationsController");
const donationDashController = require("../controller/Donation/donationDashController");
const donationCriteriaController = require("../controller/Donation/donationCriteriaController");
const VerificationController = require("../controller/verificationController");
const auth = require('../middlewares/auth');
const uploadFileController = require("../controller/uploadFileController");
const multer = require("multer");
const router = express.Router();
const upload = multer({ dest: "temp/" });



//............auth...............
router.post("/donation/register", donationAuthController.register);
router.post("/donation/login", donationAuthController.login);
router.post("/donation/uploadFile",upload.single("file"), uploadFileController.uploadFile);
router.post("/donation/completeSignup", donationAuthController.completeSignup);
router.put("/donation/updateProfile", auth, donationAuthController.updateProfile);
router.post("/donation/logout", auth, donationAuthController.logout);
router.post("/donation/refresh", auth, donationAuthController.refresh);

//............packages................//
router.post("/donation/addPackage", auth, donationpackageController.addPackage);
router.put("/donation/editPackage", auth, donationpackageController.editPackage);
router.delete("/donation/deletePackage", auth, donationpackageController.deletePackage);
router.get("/donation/getPackage", auth, donationpackageController.getPackage);
router.get("/donation/getAllPackages", auth, donationpackageController.getAllPackages);
router.get("/donation/getAllPackagesWithoutCriteria", auth, donationpackageController.getAllPackagesWithoutCriteria);
router.get("/donation/searchCriterion", auth, donationpackageController.searchCriterion);
// router.get("/donation/getCategoryPackages", auth, donationpackageController.getCategoryPackages);
// router.post("/donation/addDonation", auth, donationpackageController.addDonation);

//..........donations............///
router.get("/donation/getAllDonations", auth, donationDonationsController.getAllDonations);
router.get("/donation/getDonor", donationDonationsController.getDonor);

//..........criteria............///
router.post("/donation/addCriteria", auth, donationCriteriaController.addCriteria);
router.put("/donation/editCriteria", auth, donationCriteriaController.editCriteria);
router.delete("/donation/deleteCriteria", auth, donationCriteriaController.deleteCriteria);
router.get("/donation/getCriteria", auth, donationCriteriaController.getCriteria);
router.get("/donation/getAllCriterion", auth, donationCriteriaController.getAllCriterion);

//.............dashboard.............//
router.get("/donation/graph", auth, donationDashController.graph);
router.get("/donation/dashDetails", auth, donationDashController.dashDetails);
router.get("/donation/donorsList",auth, donationDashController.donorsList);
router.get("/donation/topDonors",auth,donationDashController.topDonors);
//..............verification.........
router.post("/donation/sendCodeToEmail", VerificationController.sendCodeToEmail);
router.post("/donation/confirmEmail", VerificationController.confirmEmail);
router.post("/donation/ResetLink", VerificationController.ResetLink);
router.post("/donation/resetPassword", VerificationController.resetPassword);

  //............Forgot Password Mobile...............//
  router.post("/ambulance/forgotPassword", VerificationController.forgotPassword);
  router.post("/ambulance/updatePassword", VerificationController.updatePassword);
  router.post("/ambulance/confirmEmail", VerificationController.confirmEmail);

module.exports = router;
