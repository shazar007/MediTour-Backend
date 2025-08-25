const express = require("express");
const router = express.Router();

const blinqController = require("../controller/blinqPayment");

router.post("/blinq/invoiceCallback", blinqController.invoiceCallback);
router.post("/blinq/paymentResponse", blinqController.paymentResponse);

module.exports = router;
