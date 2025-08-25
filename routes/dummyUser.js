const express = require("express");
const userAuthController = require("../controller/authController");
const router = express.Router();
// const upload = multer({ dest: "temp/" });


//............auth...............
router.get("/userss/getUsersBasedOnDistance", userAuthController.getUsersBasedOnDistance);

module.exports = router;
 