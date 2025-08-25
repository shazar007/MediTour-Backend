const express = require("express");
const app = express();
const RentCar = require("../../models/Rent A Car/rentCar.js");
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const rentCarDTO = require("../../dto/rentCar.js");
const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");
const rentCar = require("../../models/Rent A Car/rentCar.js");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

async function getNextVendorId() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestVendor = await RentCar.findOne({}).sort({ createdAt: -1 });

    let nextVendorId = 1;
    if (latestVendor && latestVendor.vendorId) {
      // Extract the numeric part of the orderId and increment it
      const currentVendorId = parseInt(latestVendor.vendorId.substring(3));
      nextVendorId = currentVendorId + 1;
    }
    // Generate the next orderId
    const nextOrderId = `RNT${nextVendorId.toString().padStart(4, "0")}`;

    return nextOrderId;
  } catch (error) {
    console.error("Error in getNextVendorId:", error);
    throw new Error("Failed to generate order number");
  }
}

const rentCarAuthController = {
  async register(req, res, next) {
    const rentCarRegisterSchema = Joi.object({
      name: Joi.string().required(),
      companyLicenseNo: Joi.string().optional().allow(""),
      licenseExpiry: Joi.string().optional().allow(""),
      ownerFirstName: Joi.string().required(),
      ownerLastName: Joi.string().required(),
      companyEmergencyNo: Joi.string().required(),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      location: Joi.object().required(),
      // website: Joi.string().allow(""),
      // twitter: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      country: Joi.string().optional().allow(""),
      youtube: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      // incomeTaxNo: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      // salesTaxNo: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      // accountHolderName: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      logo: Joi.string().required(),
      licenseImage: Joi.string().optional().allow(""),
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
    });
    const { error } = rentCarRegisterSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const {
      name,
      companyLicenseNo,
      licenseExpiry,
      country,
      ownerFirstName,
      ownerLastName,
      companyEmergencyNo,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      location,
      // website,
      youtube,
      linkedIn,
      // twitter,
      facebook,
      instagram,
      // incomeTaxNo,
      // salesTaxNo,
      bankName,
      // accountHolderName,
      accountNumber,
      logo,
      licenseImage,
      accountTitle,
      ntn,
      cnicImage,
      taxFileImage,
      fcmToken,
      email,
      password,
      phoneNumber,
    } = req.body;

    let accessToken;
    let refreshToken;

    let rentCar;
    try {
      let isVerified = false; // Default to false

      // If email is provided, check if it exists in the database
      if (email) {
        const existingRentCar = await RentCar.findOne({ email });

        if (existingRentCar) {
          // Check if email already exists in the database and is verified
          if (existingRentCar.isVerified) {
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
      const rentCarToRegister = new RentCar({
        name,
        vendorId,
        companyLicenseNo,
        licenseExpiry,
        ownerFirstName,
        country,
        ownerLastName,
        companyEmergencyNo,
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
        logo,
        accountTitle,
        ntn,
        youtube,
        linkedIn,
        licenseImage,
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

      rentCar = await rentCarToRegister.save();
      // Generate and return tokens only if email is provided
      let accessToken = null;
      let refreshToken = null;
      if (email) {
        const userId = rentCar._id;
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
        rentCar: rentCar,
        message: message,
        auth: !!email, // Authentication is true only if email exists
        token: accessToken || null, // Token is returned only if email exists
      });
    } catch (err) {
      next(err); // Pass any errors to the error handler
    }
  },

  async login(req, res, next) {
    const rentCarSchema = Joi.object({
      email: Joi.string().required(),
      password: Joi.string().required(),
      fcmToken: Joi.string(),
    });

    const { error } = rentCarSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const { email, password, fcmToken } = req.body;

    let rentCar;

    try {
      // Match username
      const emailRegex = new RegExp(email, "i");
      rentCar = await RentCar.findOne({ email: { $regex: emailRegex } });

      if (!rentCar) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Check if the rent car service is blocked
      if (rentCar.blocked === true) {
        return res.status(403).json({
          message: "User is Deleted",
        });
      }

      // Update fcmToken if necessary
      if (fcmToken && rentCar?.fcmToken !== fcmToken) {
        rentCar.fcmToken = fcmToken;
        await rentCar.save();
      } else {
        console.log("same Token");
      }

      // Check if the user is verified
      if (rentCar.isVerified == false) {
        return res.status(403).json({ message: "User not verified" });
      }

      // Match password
      const match = await bcrypt.compare(password, rentCar.password);
      if (!match) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }
    } catch (error) {
      return next(error);
    }

    // Generate tokens
    const accessToken = JWTService.signAccessToken(
      { _id: rentCar._id },
      "365d"
    );
    const refreshToken = JWTService.signRefreshToken(
      { _id: rentCar._id },
      "365d"
    );

    // Update refresh token in database
    try {
      await RefreshToken.updateOne(
        { userId: rentCar._id },
        { token: refreshToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    // Update access token in database
    try {
      await AccessToken.updateOne(
        { userId: rentCar._id },
        { token: accessToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    // Return response
    const rentCarDto = new rentCarDTO(rentCar);
    return res
      .status(200)
      .json({ rentCar: rentCarDto, auth: true, token: accessToken });
  },

  async completeSignup(req, res, next) {
    const rentCarRegisterSchema = Joi.object({
      phoneNumber: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().pattern(passwordPattern).required(),
      confirmPassword: Joi.ref("password"),
    });

    const { error } = rentCarRegisterSchema.validate(req.body);

    // 2. if error in validation -> return error via middleware
    if (error) {
      return next(error);
    }

    const { password, email, phoneNumber } = req.body;
    const emailRegex = new RegExp(email, "i");
    const emailExists = await RentCar.findOne({
      email: { $regex: emailRegex },
    });
    if (emailExists) {
      const error = new Error("Email already exists!");
      error.status = 400;
      return next(error);
    }
    const userId = req.query.id;
    const existingUser = await RentCar.findById(userId);

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
      rentCar: existingUser,
    });
  },

  async updateProfile(req, res, next) {
    const rentCarSchema = Joi.object({
      name: Joi.string().allow(""),
      companyLicenseNo: Joi.string().allow(""),
      licenseExpiry: Joi.string().allow(""),
      ownerFirstName: Joi.string().allow(""),
      ownerLastName: Joi.string().allow(""),
      companyEmergencyNo: Joi.string().allow(""),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      location: Joi.object().allow(null),
      phoneNumber: Joi.string().allow(""),
      currentPassword: Joi.string().allow(""),
      password: Joi.string().pattern(passwordPattern).allow(""),
      // website: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      twitter: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      // incomeTaxNo: Joi.string().allow(""),
      // salesTaxNo: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      // accountHolderName: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      logo: Joi.string().allow(""),
      licenseImage: Joi.string().allow(""),
      cnicImage: Joi.string().allow(""),
      taxFileImage: Joi.string().allow(""),
    });

    const { error } = rentCarSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      name,
      companyLicenseNo,
      licenseExpiry,
      ownerFirstName,
      ownerLastName,
      companyEmergencyNo,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      location,
      phoneNumber,
      youtube,
      linkedIn,
      currentPassword,
      password,
      // website,
      // twitter,
      accountTitle,
      ntn,
      facebook,
      instagram,
      // incomeTaxNo,
      // salesTaxNo,
      bankName,
      // accountHolderName,
      accountNumber,
      logo,
      licenseImage,
      cnicImage,
      taxFileImage,
    } = req.body;
    const rentCarId = req.user._id;

    const rentCar = await RentCar.findById(rentCarId);

    if (!rentCar) {
      return res.status(404).json([]);
    }

    if (currentPassword && password) {
      const match = await bcrypt.compare(currentPassword, rentCar.password);

      if (!match) {
        const error = {
          status: 401,
          message: "Incorrect Current Password",
        };

        return next(error);
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      rentCar.password = hashedPassword;
    }

    // Update only the provided fields
    if (name) rentCar.name = name;
    if (companyLicenseNo) rentCar.companyLicenseNo = companyLicenseNo;
    if (licenseExpiry) rentCar.licenseExpiry = licenseExpiry;
    if (ownerFirstName) rentCar.ownerFirstName = ownerFirstName;
    if (ownerLastName) rentCar.ownerLastName = ownerLastName;
    if (companyEmergencyNo) rentCar.companyEmergencyNo = companyEmergencyNo;
    if (cnicOrPassportNo) rentCar.cnicOrPassportNo = cnicOrPassportNo;
    if (cnicOrPassportExpiry)
      rentCar.cnicOrPassportExpiry = cnicOrPassportExpiry;
    if (location) rentCar.location = location;
    if (phoneNumber) rentCar.phoneNumber = phoneNumber;
    // if (website) rentCar.website = website;
    if (facebook) rentCar.facebook = facebook;
    if (youtube) rentCar.youtube = youtube;
    if (linkedIn) rentCar.linkedIn = linkedIn;
    // if (twitter) rentCar.twitter = twitter;
    if (instagram) rentCar.instagram = instagram;
    // if (incomeTaxNo) rentCar.incomeTaxNo = incomeTaxNo;
    // if (salesTaxNo) rentCar.salesTaxNo = salesTaxNo;
    if (bankName) rentCar.bankName = bankName;
    if (ntn) rentCar.ntn = ntn;
    if (accountTitle) rentCar.accountTitle = accountTitle;
    // if (accountHolderName) rentCar.accountHolderName = accountHolderName;
    if (accountNumber) rentCar.accountNumber = accountNumber;
    if (logo) rentCar.logo = logo;
    if (licenseImage) rentCar.licenseImage = licenseImage;
    if (cnicImage) rentCar.cnicImage = cnicImage;
    if (taxFileImage) rentCar.taxFileImage = taxFileImage;

    // Save the updated test
    await rentCar.save();

    return res.status(200).json({
      message: "Rent Car updated successfully",
      rentCar: rentCar,
    });
  },

  async logout(req, res, next) {
    const userId = req.user._id;
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    try {
      await RefreshToken.deleteOne({ userId });
      await AccessToken.deleteOne({ token: accessToken });
      await RentCar.findByIdAndUpdate(userId, { $unset: { fcmToken: "" } });

      res.status(200).json({ rentCar: null, auth: false });
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

      const rentCar = await RentCar.findOne({ _id: id });

      const rentCarDto = new rentCarDTO(rentCar);

      return res.status(200).json({
        rentCar: rentCarDto,
        auth: true,
        accessToken: accessToken,
      });
    } catch (e) {
      return next(e);
    }
  },
};

module.exports = rentCarAuthController;
