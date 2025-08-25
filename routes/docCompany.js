const express = require("express");
const docCompanyAuthController = require("../controller/DocCompany/docCompanyAuthController");
const docController = require("../controller/DocCompany/doctorController");
const verificationController = require("../controller/verificationController");
const auth = require("../middlewares/auth");
const uploadFileController = require("../controller/uploadFileController");
const multer = require("multer");
const router = express.Router();
const upload = multer({ dest: "temp/" });

//............auth...............
router.post("/docCompany/register", docCompanyAuthController.register);
router.post("/docCompany/login", docCompanyAuthController.login);
router.post(
  "/docCompany/uploadFile",
  upload.single("file"),
  uploadFileController.uploadFile
);
router.put(
  "/docCompany/updateProfile",
  auth,
  docCompanyAuthController.updateProfile
);
router.post("/docCompany/logout", auth, docCompanyAuthController.logout);
router.post("/docCompany/ResetLink", verificationController.ResetLink);
router.post("/docCompany/resetPassword", verificationController.resetPassword);

//...................doctor...............
router.post(
  "/docCompany/sendCodeToDocEmail",
  auth,
  docController.sendCodeToDocEmail
);
router.post("/docCompany/confirmEmail", auth, docController.confirmEmail);
router.get("/docCompany/getCompanyDocs", auth, docController.getCompanyDocs);
router.get("/docCompany/getCompanyPatients", auth, docController.getCompanyPatients);
router.get("/docCompany/addDoctorCheck", auth, docController.addDoctorCheck);
router.put("/docCompany/increaseLimit", auth, docController.increaseLimit);
router.get(
  "/docCompany/getCompanyPatientList",
  auth,
  docController.getCompanyPatientList
);
module.exports = router;
