const express = require("express");
const app = express();
const Pharmacy = require("../../models/Pharmacy/pharmacy.js");
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const PharmDTO = require("../../dto/pharm.js");
const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");
const LabDTO = require("../../dto/lab.js");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

async function getNextVendorId() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestVendor = await Pharmacy.findOne({}).sort({ createdAt: -1 });

    let nextVendorId = 1;
    if (latestVendor && latestVendor.vendorId) {
      // Extract the numeric part of the orderId and increment it
      const currentVendorId = parseInt(latestVendor.vendorId.substring(3));
      nextVendorId = currentVendorId + 1;
    }

    // Generate the next orderId
    const nextOrderId = `PHR${nextVendorId.toString().padStart(4, "0")}`;

    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}

const pharmAuthController = {
  async register(req, res, next) {
    const pharmRegisterSchema = Joi.object({
      name: Joi.string().required(),
      pharmacyLicenseNumber: Joi.string().optional().allow(""),
      licenseExpiry: Joi.string().optional().allow(""),
      ownerFirstName: Joi.string().required(),
      ownerLastName: Joi.string().required(),
      emergencyNo: Joi.string().required(),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      openTime: Joi.string(),
      closeTime: Joi.string(),
      description: Joi.string(),
      // website: Joi.string().allow(""),
      country: Joi.string().optional().allow(""),
      location: Joi.object().allow(""),
      // twitter: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      // incomeTaxNo: Joi.string().allow(""),
      // salesTaxNo: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      // accountHolderName: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      availability: Joi.boolean(),
      averageRating: Joi.number(),
      logo: Joi.string().required(),
      pharmacyLicenseImage: Joi.string().allow(""),
      cnicImage: Joi.string().allow(""),
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
      hospitalId: Joi.string().optional(),
    });

    const { error } = pharmRegisterSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const {
      name,
      pharmacyLicenseNumber,
      licenseExpiry,
      ownerFirstName,
      ownerLastName,
      emergencyNo,
      email,
      password,
      phoneNumber,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      openTime,
      closeTime,
      description,
      accountTitle,
      ntn,
      country,
      location,
      // website,
      // twitter,
      facebook,
      instagram,
      // incomeTaxNo,
      linkedIn,
      youtube,
      // salesTaxNo,
      bankName,
      // accountHolderName,
      accountNumber,
      availability,
      averageRating,
      logo,
      pharmacyLicenseImage,
      cnicImage,
      taxFileImage,
      hospitalId,
      fcmToken,
    } = req.body;
    // const hospitalId = req.query.hospitalId;

    let accessToken;
    let refreshToken;
    let pharm;
    try {
      let isVerified = false; // Default to false

      // If email is provided, check if it exists in the database
      if (email) {
        const existingPharm = await Pharmacy.findOne({ email });

        if (existingPharm) {
          // Check if email already exists in the database and is verified
          if (existingPharm.isVerified) {
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

      const vendorId = await getNextVendorId();
      const pharmToRegister = new Pharmacy({
        name,
        vendorId,
        pharmacyLicenseNumber,
        licenseExpiry,
        ownerFirstName,
        ownerLastName,
        emergencyNo,
        cnicOrPassportNo,
        cnicOrPassportExpiry,
        openTime,
        closeTime,
        description,
        country,
        location,
        // website,
        // twitter,
        facebook,
        linkedIn,
        youtube,
        instagram,
        // incomeTaxNo,
        // salesTaxNo,
        bankName,
        // accountHolderName,
        accountNumber,
        availability,
        averageRating,
        logo,
        pharmacyLicenseImage,
        accountTitle,
        ntn,
        cnicImage,
        taxFileImage,
        email, // Optional field
        password: hashedPassword, // Optional field
        phoneNumber, // Optional field
        fcmToken,
        isVerified, // Default value is false
        activationRequest: "accepted",
        paidActivation: true,
      });

      pharm = await pharmToRegister.save();
      if (hospitalId) {
        pharm.hospitalIds.push(hospitalId);
        // Set additional properties related to hospitalId
        pharm.paidActivation = true; // Set paidActivation to true if hospitalId exists
        pharm.activationRequest = "accepted"; // Set activationRequestAccepted to true if hospitalId exist
      }
      pharm = await pharmToRegister.save();

      // Generate and return tokens only if email is provided
      let accessToken = null;
      let refreshToken = null;
      if (email) {
        const userId = pharm._id;
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
        pharmacy: pharm,
        message: message,
        auth: !!email, // Authentication is true only if email exists
        token: accessToken || null, // Token is returned only if email exists
      });
    } catch (err) {
      next(err); // Pass any errors to the error handler
    }
  },
  async login(req, res, next) {
    const pharmLoginSchema = Joi.object({
      email: Joi.string().required(),
      password: Joi.string().required(),
      fcmToken: Joi.string(),
    });

    const { error } = pharmLoginSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const { email, password, fcmToken } = req.body;

    try {
      // match username
      const emailRegex = new RegExp(email, "i");
      let pharm = await Pharmacy.findOne({ email: { $regex: emailRegex } });
      if (!pharm) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Check if the vendor is blocked
      if (pharm.blocked === true) {
        return res.status(403).json({
          message: "User is Deleted",
        });
      }

      // Update fcmToken if necessary
      if (fcmToken && pharm.fcmToken !== fcmToken) {
        pharm.fcmToken = fcmToken;
        await pharm.save();
      }

      // Check if the user is verified
      if (pharm.isVerified == false) {
        return res.status(403).json({ message: "User not verified" });
      }

      // match password
      const match = await bcrypt.compare(password, pharm.password);
      if (!match) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Generate tokens
      const accessToken = JWTService.signAccessToken(
        { _id: pharm._id },
        "365d"
      );
      const refreshToken = JWTService.signRefreshToken(
        { _id: pharm._id },
        "365d"
      );

      // Update refresh token in database
      await RefreshToken.updateOne(
        { userId: pharm._id },
        { token: refreshToken },
        { upsert: true }
      );

      // Update access token in database
      await AccessToken.updateOne(
        { userId: pharm._id },
        { token: accessToken },
        { upsert: true }
      );

      const pharmDTO = new PharmDTO(pharm);

      return res
        .status(200)
        .json({ pharm: pharmDTO, auth: true, token: accessToken });
    } catch (error) {
      return next(error);
    }
  },

  async completeSignup(req, res, next) {
    const pharmRegisterSchema = Joi.object({
      phoneNumber: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().pattern(passwordPattern).required(),
      confirmPassword: Joi.ref("password"),
    });

    const { error } = pharmRegisterSchema.validate(req.body);

    // 2. if error in validation -> return error via middleware
    if (error) {
      return next(error);
    }

    const { password, email, phoneNumber } = req.body;
    const emailRegex = new RegExp(email, "i");
    const emailExists = await Pharmacy.findOne({
      email: { $regex: emailRegex },
    });
    if (emailExists) {
      const error = new Error("Email already exists!");
      error.status = 400;
      return next(error);
    }
    const userId = req.query.id;
    const existingUser = await Pharmacy.findById(userId);

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
      .json({ message: "User updated successfully", pharmacy: existingUser });
  },

  async updateProfile(req, res, next) {
    const pharmSchema = Joi.object({
      name: Joi.string().allow(""),
      pharmacyLicenseNumber: Joi.string().allow(""),
      licenseExpiry: Joi.string().allow(""),
      ownerFirstName: Joi.string().allow(""),
      ownerLastName: Joi.string().allow(""),
      emergencyNo: Joi.string().allow(""),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      openTime: Joi.string().allow(""),
      closeTime: Joi.string().allow(""),
      description: Joi.string().allow(""),
      currentPassword: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      // linkedIn: Joi.string().allow(""),
      password: Joi.string().pattern(passwordPattern).allow(""),
      location: Joi.object().allow(null),
      website: Joi.string().allow(""),
      // twitter: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      // incomeTaxNo: Joi.string().allow(""),
      // salesTaxNo: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      // accountHolderName: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      availability: Joi.boolean().allow(null),
      averageRating: Joi.number().allow(null),
      logo: Joi.string().allow(""),
      pharmacyLicenseImage: Joi.string().allow(""),
      cnicImage: Joi.string().allow(""),
      taxFileImage: Joi.string().allow(""),
    });

    const { error } = pharmSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      name,
      pharmacyLicenseNumber,
      licenseExpiry,
      ownerFirstName,
      ownerLastName,
      emergencyNo,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      openTime,
      closeTime,
      description,
      // linkedIn,
      youtube,
      currentPassword,
      password,
      location,
      website,
      // twitter,
      facebook,
      instagram,
      // incomeTaxNo,
      // salesTaxNo,
      bankName,
      // accountHolderName,
      accountNumber,
      availability,
      averageRating,
      accountTitle,
      ntn,
      logo,
      pharmacyLicenseImage,
      cnicImage,
      taxFileImage,
      fcmToken,
    } = req.body;
    const pharmId = req.user._id;

    const pharm = await Pharmacy.findById(pharmId);

    if (!pharm) {
      return res.status(404).json([]);
    }

    if (currentPassword && password) {
      const match = await bcrypt.compare(currentPassword, pharm.password);

      if (!match) {
        const error = {
          status: 401,
          message: "Incorrect Current Password",
        };

        return next(error);
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      pharm.password = hashedPassword;
    }

    // Update only the provided fields
    if (name) pharm.name = name;
    if (pharmacyLicenseNumber)
      pharm.pharmacyLicenseNumber = pharmacyLicenseNumber;
    if (licenseExpiry) pharm.licenseExpiry = licenseExpiry;
    if (ownerFirstName) pharm.ownerFirstName = ownerFirstName;
    if (ownerLastName) pharm.ownerLastName = ownerLastName;
    if (emergencyNo) pharm.emergencyNo = emergencyNo;
    if (cnicOrPassportNo) pharm.cnicOrPassportNo = cnicOrPassportNo;
    if (cnicOrPassportExpiry) pharm.cnicOrPassportExpiry = cnicOrPassportExpiry;
    if (openTime) pharm.openTime = openTime;
    if (closeTime) pharm.closeTime = closeTime;
    if (description) pharm.description = description;
    if (location) pharm.location = location;
    if (youtube) pharm.youtube = youtube;
    if (ntn) pharm.ntn = ntn;
    if (accountTitle) pharm.accountTitle = accountTitle;
    // if (linkedIn) pharm.linkedIn = linkedIn;
    if (website) pharm.website = website;
    // if (twitter) pharm.twitter = twitter;
    if (facebook) pharm.facebook = facebook;
    if (instagram) pharm.instagram = instagram;
    // if (incomeTaxNo) pharm.incomeTaxNo = incomeTaxNo;
    // if (salesTaxNo) pharm.salesTaxNo = salesTaxNo;
    if (bankName) pharm.bankName = bankName;
    // if (accountHolderName) pharm.accountHolderName = accountHolderName;
    if (accountNumber) pharm.accountNumber = accountNumber;
    if (availability) pharm.availability = availability;
    if (averageRating) pharm.averageRating = averageRating;
    if (logo) pharm.logo = logo;
    if (pharmacyLicenseImage) pharm.pharmacyLicenseImage = pharmacyLicenseImage;
    if (cnicImage) pharm.cnicImage = cnicImage;
    if (taxFileImage) pharm.taxFileImage = taxFileImage;
    if (fcmToken) pharm.fcmToken = fcmToken;

    // Save the updated test
    await pharm.save();

    return res
      .status(200)
      .json({ message: "Pharmacy updated successfully", pharm: pharm });
  },

  async logout(req, res, next) {
    const userId = req.user._id;
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    try {
      await RefreshToken.deleteOne({ userId });
      await AccessToken.deleteOne({ token: accessToken });
      await Pharmacy.findByIdAndUpdate(userId, { $unset: { fcmToken: "" } });

      res.status(200).json({ pharmacy: null, auth: false });
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

      const pharm = await Pharmacy.findOne({ _id: id });

      const pharmDto = new PharmDTO(pharm);

      return res
        .status(200)
        .json({ pharm: pharmDto, auth: true, accessToken: accessToken });
    } catch (e) {
      return next(e);
    }
  },
};

module.exports = pharmAuthController;
