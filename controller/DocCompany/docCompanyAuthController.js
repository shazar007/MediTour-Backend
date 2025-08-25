const express = require("express");
const mongoose = require("mongoose");
const app = express();
const DoctorCompany = require("../../models/DoctorCompany/docCompany.js");
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const docCompanyDto = require("../../dto/docCompany.js");
const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

async function getNextVendorId() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestVendor = await DoctorCompany.findOne({}).sort({
      createdAt: -1,
    });

    let nextVendorId = 1;
    if (latestVendor && latestVendor.vendorId) {
      // Extract the numeric part of the orderId and increment it
      const currentVendorId = parseInt(latestVendor.vendorId.substring(3));
      nextVendorId = currentVendorId + 1;
    }
    // Generate the next orderId
    const nextOrderId = `DCP${nextVendorId.toString().padStart(4, "0")}`;

    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}

const docCompanyAuthController = {
  async register(req, res, next) {
    try {
      const docCompanyregisterSchema = Joi.object({
        phoneNumber: Joi.string().required(), // Phone number is required
        email: Joi.string().email().required(), // Email is required
        password: Joi.string()
          .pattern(passwordPattern)
          .message("Must include 1 uppercase, 1 special character and 1 digit.")
          .when("email", {
            is: Joi.exist(),
            then: Joi.required(), // Required only if email is provided
            otherwise: Joi.required(), // required otherwise
          }),
        name: Joi.string().required(),
        bankName: Joi.string().allow(""),
        accountHolderName: Joi.string().allow(""),
        accountTitle: Joi.string().allow(""),
        ntn: Joi.string().allow(""),
        accountNumber: Joi.string().allow(""),
        fcmToken: Joi.string(),
      });

      // Validate the request body against the schema
      const { error } = docCompanyregisterSchema.validate(req.body);

      if (error) {
        return next(error); // Handle validation errors
      }

      // Destructure fields from request body
      const {
        phoneNumber,
        email,
        password,
        name,
        bankName,
        accountHolderName,
        accountTitle,
        ntn,
        accountNumber,
        fcmToken,
      } = req.body;

      const existingDocCompany = await DoctorCompany.findOne({ email });

      if (existingDocCompany) {
        // Check if email already exists in the database and is verified
        return res.status(400).json({
          auth: false,
          message: "Email is already registered.",
        });
      }
      const hashedPassword = password
        ? await bcrypt.hash(password, 10)
        : undefined;

      const vendorId = await getNextVendorId();

      const newDocCompany = new DoctorCompany({
        vendorId,
        phoneNumber,
        email,
        password: hashedPassword,
        name,
        bankName,
        accountHolderName,
        accountTitle,
        ntn,
        accountNumber,
        fcmToken,
        activationRequest: "accepted",
        paidActivation: true,
      });

      await newDocCompany.save();

      // Generate and return tokens only if email is provided
      let accessToken = null;
      let refreshToken = null;
      if (email) {
        const userId = newDocCompany._id;
        accessToken = JWTService.signAccessToken({ _id: userId }, "365d");
        refreshToken = JWTService.signRefreshToken({ _id: userId }, "365d");

        await JWTService.storeRefreshToken(refreshToken, userId);
        await JWTService.storeAccessToken(accessToken, userId);
      }

      return res.status(201).json({
        auth: true,
        doctor: newDocCompany,
      });
    } catch (err) {
      next(err); // Pass any errors to the error handler
    }
  },

  async login(req, res, next) {
    // Validate user input
    const docCompanyLoginSchema = Joi.object({
      email: Joi.string().required(),
      password: Joi.string().required(),
      fcmToken: Joi.string(),
    });

    const { error } = docCompanyLoginSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const { email, password, fcmToken } = req.body;

    let docCompany;

    try {
      // Match username using a case-insensitive regex
      const emailRegex = new RegExp(email, "i");
      docCompany = await DoctorCompany.findOne({
        email: { $regex: emailRegex },
      });

      if (!docCompany) {
        console.log("anything1");
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Check if the doctor is blocked
      if (docCompany.blocked === true) {
        return res.status(403).json({
          message: "User is Deleted",
        });
      }

      // Update fcmToken if necessary
      if (fcmToken && docCompany.fcmToken !== fcmToken) {
        docCompany.fcmToken = fcmToken;
        await docCompany.save();
      }

      // Match password
      const match = await bcrypt.compare(password, docCompany.password);
      if (!match) {
        console.log("anything3");
        return res.status(400).json({ message: "Incorrect email or password" });
      }
    } catch (error) {
      return next(error);
    }

    // Generate tokens
    const accessToken = JWTService.signAccessToken(
      { _id: docCompany._id },
      "365d"
    );
    const refreshToken = JWTService.signRefreshToken(
      { _id: docCompany._id },
      "365d"
    );

    // Update refresh token in database
    try {
      await RefreshToken.updateOne(
        { userId: docCompany._id },
        { token: refreshToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    // Update access token in database
    try {
      await AccessToken.updateOne(
        { userId: docCompany._id },
        { token: accessToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    // Return response
    const docCompanyDTO = new docCompanyDto(docCompany);
    return res
      .status(200)
      .json({ docCompany: docCompanyDTO, auth: true, token: accessToken });
  },

  async updateProfile(req, res, next) {
    const docSchema = Joi.object({
      phoneNumber: Joi.string().allow(""),
      name: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      accountHolderName: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      currentPassword: Joi.string().allow(""),
      password: Joi.string().allow(""),
    });

    const { error } = docSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      phoneNumber,
      name,
      bankName,
      accountHolderName,
      accountTitle,
      ntn,
      accountNumber,
      currentPassword,
      password,
    } = req.body;
    const docId = req.user._id;

    const docCompany = await DoctorCompany.findById(docId);

    if (!docCompany) {
      return res.status(404).json([]);
    }
    if (currentPassword && password) {
      const match = await bcrypt.compare(currentPassword, docCompany.password);

      if (!match) {
        const error = {
          status: 401,
          message: "Incorrect Current Password",
        };

        return next(error);
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      docCompany.password = hashedPassword;
    }

    // Update only the provided fields
    if (phoneNumber) docCompany.phoneNumber = phoneNumber;
    if (name) docCompany.name = name;
    if (bankName) docCompany.bankName = bankName;
    if (accountHolderName) docCompany.accountHolderName = accountHolderName;
    if (accountTitle) docCompany.accountTitle = accountTitle;
    if (ntn) docCompany.ntn = ntn;
    if (accountNumber) docCompany.accountNumber = accountNumber;

    await docCompany.save();

    return res
      .status(200)
      .json({ message: "Doctor updated successfully", docCompany: docCompany });
  },

  async logout(req, res, next) {
    const userId = req.user._id;
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    try {
      await RefreshToken.deleteOne({ userId });
      await AccessToken.deleteOne({ token: accessToken });
      await DoctorCompany.findByIdAndUpdate(userId, {
        $unset: { fcmToken: "" },
      });

      res.status(200).json({ doctorCompany: null, auth: false });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = docCompanyAuthController;
