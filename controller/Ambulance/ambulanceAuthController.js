const express = require("express");
const app = express();
const Ambulance = require("../../models/Ambulance/ambulanceCompany.js");
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const ambulanceDto = require("../../dto/ambulanceCompany.js");
const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");
const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

async function getNextVendorId() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestVendor = await Ambulance.findOne({}).sort({ createdAt: -1 });
    let nextVendorId = 1;
    if (latestVendor && latestVendor.vendorId) {
      // Extract the numeric part of the orderId and increment it
      const currentVendorId = parseInt(latestVendor.vendorId.substring(3));
      nextVendorId = currentVendorId + 1;
    }
    // Generate the next orderId
    const nextOrderId = `AMB${nextVendorId.toString().padStart(4, "0")}`;
    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}

const ambulanceAuthController = {
  async register(req, res, next) {
    const ambulanceRegisterSchema = Joi.object({
      name: Joi.string().required(),
      registrationNumber: Joi.string().optional().allow(""),
      registrationExpiry: Joi.string().allow(""),
      ownerFirstName: Joi.string().required(),
      ownerLastName: Joi.string().required(),
      emergencyNo: Joi.string().required(),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      location: Joi.object().required(),
       country: Joi.string().allow(""),
      // website: Joi.string().allow(""),
      // twitter: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      // incomeTaxNo: Joi.string().allow(""),
      // salesTaxNo: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      // accountHolderName: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      logo: Joi.string().required(),
      registrationImage: Joi.string().allow(""),
      cnicOrPassportImage: Joi.string().allow(""),
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
    const { error } = ambulanceRegisterSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const {
      name,
      registrationNumber,
      registrationExpiry,
      ownerFirstName,
      ownerLastName,
      emergencyNo,
      country,
      youtube,
      linkedIn,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      location,
      // website,
      // twitter,
      facebook,
      instagram,
      // incomeTaxNo,
      // salesTaxNo,
      bankName,
      // accountHolderName,
      accountNumber,
      accountTitle,
      ntn,
      logo,
      registrationImage,
      cnicOrPassportImage,
      taxFileImage,
      fcmToken,
      email,
      password,
      phoneNumber,
    } = req.body;

    let accessToken;
    let refreshToken;
    const vendorId = await getNextVendorId();
    let ambulance;
    try {
      let isVerified = false; // Default to false

      // If email is provided, check if it exists in the database
      if (email) {
        const emailRegex = new RegExp(email, "i");

        const existingAmbulance = await Ambulance.findOne({
          email: { $regex: emailRegex },
        });

        if (existingAmbulance) {
          // Check if email already exists in the database and is verified
          if (existingAmbulance.isVerified) {
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

      const ambulanceToRegister = new Ambulance({
        vendorId,
        name,
        registrationNumber,
        registrationExpiry,
        ownerFirstName,
        country,
        ownerLastName,
        emergencyNo,
        cnicOrPassportNo,
        cnicOrPassportExpiry,
        location,
        // website,
        linkedIn,
        // twitter,
        facebook,
        instagram,
        // incomeTaxNo,
        // salesTaxNo,
        youtube,
        bankName,
        // accountHolderName,
        accountNumber,
        logo,
        registrationImage,
        accountTitle,
        ntn,
        cnicOrPassportImage,
        taxFileImage,
        email, // Optional field
        password: hashedPassword, // Optional field
        phoneNumber, // Optional field
        fcmToken,
        isVerified, // Default value is false
        activationRequest: "accepted",
        paidActivation: true,
      });

      ambulance = await ambulanceToRegister.save();

      // Generate and return tokens only if email is provided
      let accessToken = null;
      let refreshToken = null;
      if (email) {
        const userId = ambulance._id;
        accessToken = JWTService.signAccessToken({ _id: userId }, "365d");
        refreshToken = JWTService.signRefreshToken({ _id: userId }, "365d");

        await JWTService.storeRefreshToken(refreshToken, userId);
        await JWTService.storeAccessToken(accessToken, userId);
      }

      // Define message based on isVerified status
      const message = isVerified
        ? "Registration successful."
        : "Registration successful. Please verify your email.";

      // 6. response send

      return res.status(201).json({
        ambulance: ambulance,
        message: message,
        auth: !!email, // Authentication is true only if email exists
        token: accessToken || null, // Token is returned only if email exists token: accessToken });
      });
    } catch (err) {
      next(err); // Pass any errors to the error handler
    }
  },

  async login(req, res, next) {
    const ambulanceLoginSchema = Joi.object({
      email: Joi.string().required(),
      password: Joi.string().required(),
      fcmToken: Joi.string(),
    });

    const { error } = ambulanceLoginSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const { email, password, fcmToken } = req.body;

    let ambulance;

    try {
      // match username
      const emailRegex = new RegExp(email, "i");

      ambulance = await Ambulance.findOne({ email: { $regex: emailRegex } });
      if (!ambulance) {
        const error = {
          status: 400,
          message: "Incorrect email or password.",
        };

        return next(error);
      } // Check if the donation user is blocked
      else {
        //update fcmToken
        if (fcmToken && ambulance?.fcmToken !== fcmToken) {
          Object.keys(ambulance).map(
            (key) => (ambulance["fcmToken"] = fcmToken)
          );

          let update = await ambulance.save();
        } else {
          console.log("same Token");
        }
      }
      if (ambulance.blocked === true) {
        return res.status(403).json({
          message: "User is Deleted",
        });
      }
      if (ambulance.isVerified == false) {
        const error = {
          status: 403,
          message: "User not verified",
        };

        return next(error);
      }

      // match password

      const match = await bcrypt.compare(password, ambulance.password);

      if (!match) {
        const error = {
          status: 400,
          message: "Incorrect email or password.",
        };

        return next(error);
      }
    } catch (error) {
      return next(error);
    }

    const accessToken = JWTService.signAccessToken(
      { _id: ambulance._id },
      "365d"
    );
    const refreshToken = JWTService.signRefreshToken(
      { _id: ambulance._id },
      "365d"
    );
    // update refresh token in database
    try {
      await RefreshToken.updateOne(
        {
          userId: ambulance._id,
        },
        { token: refreshToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    try {
      await AccessToken.updateOne(
        {
          userId: ambulance._id,
        },
        { token: accessToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    const ambulanceDTO = new ambulanceDto(ambulance);

    return res
      .status(200)
      .json({ ambulance: ambulanceDTO, auth: true, token: accessToken });
  },

  async completeSignup(req, res, next) {
    const ambulanceRegisterSchema = Joi.object({
      phoneNumber: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().pattern(passwordPattern).required(),
      confirmPassword: Joi.ref("password"),
    });

    const { error } = ambulanceRegisterSchema.validate(req.body);

    // 2. if error in validation -> return error via middleware
    if (error) {
      return next(error);
    }

    const { password, email, phoneNumber } = req.body;
    const emailRegex = new RegExp(email, "i");
    const emailExists = await Ambulance.findOne({
      email: { $regex: emailRegex },
    });
    if (emailExists) {
      const error = new Error("Email already exists!");
      error.status = 400;
      return next(error);
    }
    const userId = req.query.id;
    const existingUser = await Ambulance.findById(userId);

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

    return res
      .status(200)
      .json({ message: "User updated successfully", Ambulance: existingUser });
  },

  async updateProfile(req, res, next) {
    const ambulanceSchema = Joi.object({
      name: Joi.string().allow(""),
      registrationNumber: Joi.string().allow(""),
      registrationExpiry: Joi.string().allow(""),
      ownerFirstName: Joi.string().allow(""),
      ownerLastName: Joi.string().allow(""),
      emergencyNo: Joi.string().allow(""),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      location: Joi.object().allow(""),
      // website: Joi.string().allow(""),
      // twitter: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      // incomeTaxNo: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      // salesTaxNo: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      // accountHolderName: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      logo: Joi.string().allow(""),
      registrationImage: Joi.string().allow(""),
      cnicOrPassportImage: Joi.string().allow(""),
      currentPassword: Joi.string().allow(""),
      password: Joi.string().allow(""),
    });

    const { error } = ambulanceSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      name,
      registrationNumber,
      registrationExpiry,
      ownerFirstName,
      ownerLastName,
      emergencyNo,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      location,
      // website,
      // twitter,
      youtube,
      facebook,
      instagram,
      // incomeTaxNo,
      // salesTaxNo,
      bankName,
      // accountHolderName,
      accountTitle,
      ntn,
      accountNumber,
      logo,
      linkedIn,
      registrationImage,
      cnicOrPassportImage,
      taxFileImage,
      currentPassword,
      password,
    } = req.body;
    const ambulanceId = req.user._id;

    const ambulance = await Ambulance.findById(ambulanceId);

    if (!ambulance) {
      return res.status(404).json([]);
    }

    if (currentPassword && password) {
      const match = await bcrypt.compare(currentPassword, ambulance.password);

      if (!match) {
        const error = {
          status: 400,
          message: "Incorrect Current Password",
        };

        return next(error);
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      ambulance.password = hashedPassword;
    }

    // Update only the provided fields
    if (name) ambulance.name = name;
    if (registrationNumber) ambulance.registrationNumber = registrationNumber;
    if (registrationExpiry) ambulance.registrationExpiry = registrationExpiry;
    if (ownerFirstName) ambulance.ownerFirstName = ownerFirstName;
    if (ownerLastName) ambulance.ownerLastName = ownerLastName;
    if (emergencyNo) ambulance.emergencyNo = emergencyNo;
    if (cnicOrPassportNo) ambulance.cnicOrPassportNo = cnicOrPassportNo;
    if (cnicOrPassportExpiry)
      ambulance.cnicOrPassportExpiry = cnicOrPassportExpiry;
    if (location) ambulance.location = location;
    // if (website) ambulance.website = website;
    if (linkedIn) ambulance.linkedIn = linkedIn;
    if (facebook) ambulance.facebook = facebook;
    // if (twitter) ambulance.twitter = twitter;
    if (ntn) ambulance.ntn = ntn;
    if (accountTitle) ambulance.accountTitle = accountTitle;
    if (instagram) ambulance.instagram = instagram;
    if (youtube) ambulance.youtube = youtube;
    // if (incomeTaxNo) ambulance.incomeTaxNo = incomeTaxNo;
    // if (salesTaxNo) ambulance.salesTaxNo = salesTaxNo;
    if (bankName) ambulance.bankName = bankName;
    // if (accountHolderName) ambulance.accountHolderName = accountHolderName;
    if (accountNumber) ambulance.accountNumber = accountNumber;
    if (logo) ambulance.logo = logo;
    if (registrationImage) ambulance.registrationImage = registrationImage;
    if (cnicOrPassportImage)
      ambulance.cnicOrPassportImage = cnicOrPassportImage;
    if (taxFileImage) ambulance.taxFileImage = taxFileImage;

    // Save the updated test
    await ambulance.save();

    return res.status(200).json({
      message: "Ambulance updated successfully",
      ambulance: ambulance,
    });
  },

  async logout(req, res, next) {
    const userId = req.user._id;
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    try {
      await RefreshToken.deleteOne({ userId });
      await AccessToken.deleteOne({ token: accessToken });
      await Ambulance.findByIdAndUpdate(userId, { $unset: { fcmToken: "" } });

      res.status(200).json({ ambulance: null, auth: false });
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

      const ambulance = await Ambulance.findOne({ _id: id });

      const ambulanceDTO = new ambulanceDto(ambulance);

      return res.status(200).json({
        Ambulance: ambulanceDTO,
        auth: true,
        accessToken: accessToken,
      });
    } catch (e) {
      return next(e);
    }
  },
};

module.exports = ambulanceAuthController;
