const express = require("express");
const app = express();
const Pharmaceutical = require("../../models/Pharmaceutical/pharmaceutical.js");
const Joi = require("joi");
const bcrypt = require("bcryptjs");

const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

async function getNextVendorId() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestVendor = await Pharmaceutical.findOne({}).sort({
      createdAt: -1,
    });

    let nextVendorId = 1;
    if (latestVendor && latestVendor.vendorId) {
      // Extract the numeric part of the orderId and increment it
      const currentVendorId = parseInt(latestVendor.vendorId.substring(3));
      nextVendorId = currentVendorId + 1;
    }

    // Generate the next orderId
    const nextOrderId = `PHT${nextVendorId.toString().padStart(4, "0")}`;

    return nextOrderId;
  } catch (error) {
    console.error("Error in getNextVendorId:", error);
    throw new Error("Failed to generate order number");
  }
}

const insuranceAuthController = {
  async register(req, res, next) {
    const pharmaceuticalRegisterSchema = Joi.object({
      name: Joi.string().required(),
      logo: Joi.string().required(),
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      emergencyNo: Joi.string().required(),
      location: Joi.object().required(),
      // website: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      // twitter: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      // incomeTaxNo: Joi.string().allow(""),
      // salesTaxNo: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      country:Joi.string().optional().allow(""),
      // accountHolderName: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      taxFileImage: Joi.string().allow(""),
      fcmToken: Joi.string(),
      phoneNumber: Joi.string().optional(), // Phone number is optional
      email: Joi.string().email().optional(), // Email is optional
      password: Joi.string()
        .pattern(passwordPattern)
        .message("Must include 1 uppercase, 1 special character and 1 digit.")
        .when("email", {
          is: Joi.exist(),
          then: Joi.required(), // Required only if email is provided
          otherwise: Joi.optional(), // Optional otherwise
        }),
    });

    const { error } = pharmaceuticalRegisterSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const {
      name,
      logo,
      firstName,
      lastName,
      emergencyNo,
      location,
      // website,
      // twitter,
      facebook,
      country,
      instagram,
      youtube,
      linkedIn,
      accountTitle,
      ntn,
      // incomeTaxNo,
      // salesTaxNo,
      bankName,
      // accountHolderName,
      accountNumber,
      taxFileImage,
      email,
      password,
      phoneNumber,
      fcmToken,
    } = req.body;

    let accessToken;
    let refreshToken;
    let pharmaceutical;
    try {
      let isVerified = false; // Default to false

      // If email is provided, check if it exists in the database
      if (email) {
        const existingPharmaceutical = await Pharmaceutical.findOne({ email });

        if (existingPharmaceutical) {
          // Check if email already exists in the database and is verified
          if (existingPharmaceutical.isVerified) {
            return res.status(400).json({
              message: "Email is already registered and verified.",
            });
          } else {
            return res.status(400).json({
              message: "Email is already registered but not verified.",
            });
          }
        } else {
          isVerified = true; // Email is provided, so set isVerified to true
        }
      }
      // Hash the password if it exists
      const hashedPassword = password
        ? await bcrypt.hash(password, 10)
        : undefined;

      // Generate a new vendor ID
      const vendorId = await getNextVendorId();

      const pharmaceuticalToRegister = new Pharmaceutical({
        vendorId,
        name,
        logo,
        firstName,
        lastName,
        emergencyNo,
        country,
        location,
        // website,
        // twitter,
        facebook,
        instagram,
        youtube,
        linkedIn,
        accountTitle,
        ntn,
        // incomeTaxNo,
        // salesTaxNo,
        bankName,
        // accountHolderName,
        taxFileImage,
        accountNumber,
        fcmToken,
        email, // Optional field
        password: hashedPassword, // Optional field
        phoneNumber, // Optional field
        fcmToken,
        isVerified, // Default value is false
        activationRequest: "accepted",
        paidActivation: true,
      });

      pharmaceutical = await pharmaceuticalToRegister.save();

      // Generate and return tokens only if email is provided
      let accessToken = null;
      let refreshToken = null;
      if (email) {
        const userId = pharmaceutical._id;
        accessToken = JWTService.signAccessToken({ _id: userId }, "365d");
        refreshToken = JWTService.signRefreshToken({ _id: userId }, "365d");

        await JWTService.storeRefreshToken(refreshToken, userId);
        await JWTService.storeAccessToken(accessToken, userId);
      }

      // Define message based on isVerified status
      const message = isVerified
        ? "Registration successful."
        : "Registration successful. Please verify your email.";

      // Return the response
      // 6. response send

      return res.status(201).json({
        pharmacuetical: pharmaceutical,
        message: message,
        auth: !!email, // Authentication is true only if email exists
        token: accessToken || null, // Token is returned only if email exists
      });
    } catch (err) {
      next(err); // Pass any errors to the error handler
    }
  },

  async login(req, res, next) {
    const insuranceSchema = Joi.object({
      email: Joi.string().required(),
      password: Joi.string().required(),
      fcmToken: Joi.string(),
    });

    const { error } = insuranceSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const { email, password, fcmToken } = req.body;

    let pharmaceutical;

    try {
      // match username
      const emailRegex = new RegExp(email, "i");
      pharmaceutical = await Pharmaceutical.findOne({
        email: { $regex: emailRegex },
      });
      if (!pharmaceutical) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Check if the pharmaceutical user is blocked
      if (pharmaceutical.blocked === true) {
        return res.status(403).json({
          message: "User is Deleted",
        });
      }

      // Update fcmToken if necessary
      if (fcmToken && pharmaceutical.fcmToken !== fcmToken) {
        pharmaceutical.fcmToken = fcmToken;
        await pharmaceutical.save();
      }

      // Check if the user is verified
      if (pharmaceutical.isVerified == false) {
        return res.status(403).json({ message: "User not verified" });
      }

      // match password
      const match = await bcrypt.compare(password, pharmaceutical.password);
      if (!match) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Generate tokens
      const accessToken = JWTService.signAccessToken(
        { _id: pharmaceutical._id },
        "365d"
      );
      const refreshToken = JWTService.signRefreshToken(
        { _id: pharmaceutical._id },
        "365d"
      );

      // Update refresh token in database
      await RefreshToken.updateOne(
        { userId: pharmaceutical._id },
        { token: refreshToken },
        { upsert: true }
      );

      // Update access token in database
      await AccessToken.updateOne(
        { userId: pharmaceutical._id },
        { token: accessToken },
        { upsert: true }
      );

      // const insuranceDto = new insuranceDTO(insurance);

      return res.status(200).json({
        pharmacuetical: pharmaceutical,
        auth: true,
        token: accessToken,
      });
    } catch (error) {
      return next(error);
    }
  },

  async completeSignup(req, res, next) {
    const pharmaceuticalRegisterSchema = Joi.object({
      phoneNumber: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().pattern(passwordPattern).required(),
      confirmPassword: Joi.ref("password"),
    });

    const { error } = pharmaceuticalRegisterSchema.validate(req.body);

    // 2. if error in validation -> return error via middleware
    if (error) {
      return next(error);
    }

    const { password, email, phoneNumber } = req.body;
    const emailRegex = new RegExp(email, "i");
    const emailExists = await Insurance.findOne({
      email: { $regex: emailRegex },
    });
    if (emailExists) {
      const error = new Error("Email already exists!");
      error.status = 400;
      return next(error);
    }
    const userId = req.query.id;
    const existingUser = await Insurance.findById(userId);

    if (!existingUser) {
      return res.status(404).json([]);
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update only the provided fields
    existingUser.email = email;
    existingUser.password = hashedPassword;
    existingUser.phoneNumber = phoneNumber;
    existingUser.isVerified = true;

    // Save the updated test
    await existingUser.save();

    return res.status(200).json({
      message: "User updated successfully",
      pharmacuetical: existingUser,
    });
  },

  async updateProfile(req, res, next) {
    const insuranceSchema = Joi.object({
      name: Joi.string(),
      logo: Joi.string(),
      firstName: Joi.string(),
      lastName: Joi.string(),
      emergencyNo: Joi.string(),
      location: Joi.object(),
      // website: Joi.string().allow(""),
      // twitter: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      // incomeTaxNo: Joi.string().allow(""),
      // salesTaxNo: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      // accountHolderName: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      currentPassword: Joi.string().allow(""),
      taxFileImage: Joi.string().allow(""),
      password: Joi.string().pattern(passwordPattern).allow(""),
    });

    const { error } = insuranceSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      name,
      logo,
      firstName,
      lastName,
      emergencyNo,
      location,
      // website,
      // twitter,
      taxFileImage,
      facebook,
      youtube,
      linkedIn,
      accountTitle,
      ntn,
      instagram,
      // incomeTaxNo,
      // salesTaxNo,
      bankName,
      // accountHolderName,
      accountNumber,
      currentPassword,
      password,
    } = req.body;
    const insuranceId = req.user._id;

    const pharmaceutical = await Pharmaceutical.findById(insuranceId);

    if (!pharmaceutical) {
      return res.status(404).json([]);
    }

    if (currentPassword && password) {
      const match = await bcrypt.compare(
        currentPassword,
        pharmaceutical.password
      );

      if (!match) {
        const error = {
          status: 401,
          message: "Incorrect Current Password",
        };

        return next(error);
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      pharmaceutical.password = hashedPassword;
    }

    // Update only the provided fields
    if (name) pharmaceutical.name = name;
    if (logo) pharmaceutical.logo = logo;
    if (firstName) pharmaceutical.firstName = firstName;
    if (lastName) pharmaceutical.lastName = lastName;
    if (emergencyNo) pharmaceutical.emergencyNo = emergencyNo;
    // if (website) pharmaceutical.website = website;
    if (facebook) pharmaceutical.facebook = facebook;
    if (youtube) pharmaceutical.youtube = youtube;
    if (linkedIn) pharmaceutical.linkedIn = linkedIn;
    // if (twitter) pharmaceutical.twitter = twitter;
    if (instagram) pharmaceutical.instagram = instagram;
    // if (incomeTaxNo) pharmaceutical.incomeTaxNo = incomeTaxNo;
    // if (salesTaxNo) pharmaceutical.salesTaxNo = salesTaxNo;
    if (bankName) pharmaceutical.bankName = bankName;
    if (ntn) pharmaceutical.ntn = ntn;
    if (accountTitle) pharmaceutical.accountTitle = accountTitle;
    // if (accountHolderName) pharmaceutical.accountHolderName = accountHolderName;
    if (accountNumber) pharmaceutical.accountNumber = accountNumber;
    if (location) pharmaceutical.location = location;
    if (taxFileImage) pharmaceutical.taxFileImage = taxFileImage;

    // Save the updated test
    await pharmaceutical.save();

    return res.status(200).json({
      message: "Pharmacuetical updated successfully",
      pharmacuetical: pharmaceutical,
    });
  },

  async logout(req, res, next) {
    const userId = req.user._id;
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    try {
      await RefreshToken.deleteOne({ userId });
      await AccessToken.deleteOne({ token: accessToken });
      await Pharmaceutical.findByIdAndUpdate(userId, {
        $unset: { fcmToken: "" },
      });

      res.status(200).json({ pharmacuetical: null, auth: false });
    } catch (error) {
      return next(error);
    }
  },

  async refresh(req, res, next) {
    // 1. get refreshToken from cookies
    // 2. verify refreshToken
    // 3. generate new tokens
    // 4. update db, return response

    const authHeader = req.headers["authorization"];
    const originalRefreshToken = authHeader && authHeader.split(" ")[2];
    const accessToken = authHeader && authHeader.split(" ")[1];

    let id;

    try {
      id = JWTService.verifyRefreshToken(originalRefreshToken)._id;
    } catch (e) {
      const error = {
        status: 401,
        message: "Unauthorized",
      };

      return next(error);
    }

    try {
      const match = RefreshToken.findOne({
        userId: id,
        token: originalRefreshToken,
      });

      if (!match) {
        const error = {
          status: 401,
          message: "Unauthorized",
        };

        return next(error);
      }
    } catch (e) {
      return next(e);
    }

    let accessId;
    try {
      accessId = JWTService.verifyAccessToken(accessToken)._id;
    } catch (e) {
      const error = {
        status: 401,
        message: "Unauthorized",
      };

      return next(error);
    }

    try {
      const match = AccessToken.findOne({
        userId: accessId,
        token: accessToken,
      });

      if (!match) {
        const error = {
          status: 401,
          message: "Unauthorized",
        };

        return next(error);
      }
    } catch (e) {
      return next(e);
    }

    try {
      let accessToken = JWTService.signAccessToken({ _id: id }, "365d");

      let refreshToken = JWTService.signRefreshToken({ _id: id }, "365d");
      await RefreshToken.updateOne({ userId: id }, { token: refreshToken });
      await AccessToken.updateOne({ userId: accessId }, { token: accessToken });

      const insurance = await Insurance.findOne({ _id: id });

      const insuranceDto = new insuranceDTO(insurance);

      return res.status(200).json({
        pharmacuetical: insuranceDto,
        auth: true,
        accessToken: accessToken,
      });
    } catch (e) {
      return next(e);
    }
  },
};

module.exports = insuranceAuthController;
