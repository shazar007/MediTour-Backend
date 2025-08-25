const Joi = require("joi");
const VerificationCode = require("../models/verificationCode");
const bcrypt = require("bcryptjs");
var randomBytes = require("randombytes");
const UserDTO = require("../dto/user");
const JWTService = require("../services/JWTService");
const RefreshToken = require("../models/token");
const nodemailer = require("nodemailer");
var moment = require("moment");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

const authController = {
 
  async getUsersBasedOnDistance(req, res, next) {
    try {
      const latitude = req.query.lat;
      const longitude = req.query.long;
      const users = await User.find({
        loc: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude], // Replace with the desired coordinates
            },
            $maxDistance: 1000000, // 1 km radius
          },
        },
      });

      return res.status(200).json({ users, auth: true });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = authController;
