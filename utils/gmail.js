const nodemailer = require("nodemailer");
const {
    APPKEY_USERNAME,
    APPKEY_PASSWORD,
  } = require("../config/index");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: `${APPKEY_USERNAME}`,
    pass: `${APPKEY_PASSWORD}`,
  },
});

module.exports = transporter;
