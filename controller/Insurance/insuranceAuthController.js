const express = require("express");
const app = express();
const Insurance = require("../../models/Insurance/insurance.js");
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const insuranceDTO = require("../../dto/Insurance/insurance.js");
const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

async function getNextVendorId() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestVendor = await Insurance.findOne({}).sort({ createdAt: -1 });

    let nextVendorId = 1;
    if (latestVendor && latestVendor.vendorId) {
      // Extract the numeric part of the orderId and increment it
      const currentVendorId = parseInt(latestVendor.vendorId.substring(3));
      nextVendorId = currentVendorId + 1;
    }

    // Generate the next orderId
    const nextOrderId = `INS${nextVendorId.toString().padStart(4, "0")}`;
    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}

const insuranceAuthController = {
  async register(req, res, next) {
    const insuranceRegisterSchema = Joi.object({
      name: Joi.string().required(),
      companyLicenseNo: Joi.string().optional().allow(""),
      licenseExpiry: Joi.string().optional().allow(""),
      ownerFirstName: Joi.string().required(),
      ownerLastName: Joi.string().required(),
      emergencyNo: Joi.string().required(),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      location: Joi.object().required(),
      // website: Joi.string().allow(""),
      // twitter: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      // salesTaxNo: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
       country: Joi.string().optional().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      // incomeTaxNo: Joi.string().allow(""),
      // accountHolderName: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      logo: Joi.string().required(),
      licenseImage: Joi.string().allow(""),
      cnicImage: Joi.string().allow(""),
      taxFileImage: Joi.string().optional().allow(""),
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

    const { error } = insuranceRegisterSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const {
      name,
      companyLicenseNo,
      licenseExpiry,
      ownerFirstName,
      country,
      ownerLastName,
      emergencyNo,
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
      accountTitle,
      ntn,
      // accountHolderName,
      accountNumber,
      logo,
      licenseImage,
      cnicImage,
      taxFileImage,
      fcmToken,
      email,
      password,
      phoneNumber,
    } = req.body;

    let accessToken;
    let refreshToken;
    let insurance;
    try {
      let isVerified = false; // Default to false

      // If email is provided, check if it exists in the database
      if (email) {
        const existingInsurance = await Insurance.findOne({ email });

        if (existingInsurance) {
          // Check if email already exists in the database and is verified
          if (existingInsurance.isVerified) {
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
      const insuranceToRegister = new Insurance({
        name,
        vendorId,
        companyLicenseNo,
        licenseExpiry,
        country,
        ownerFirstName,
        accountTitle,
        ntn,
        ownerLastName,
        emergencyNo,
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

      insurance = await insuranceToRegister.save();

      // Generate and return tokens only if email is provided
      let accessToken = null;
      let refreshToken = null;
      if (email) {
        const userId = insurance._id;
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
        insurance: insurance,
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

    let insurance;

    try {
      // match username
      const emailRegex = new RegExp(email, "i");
      insurance = await Insurance.findOne({ email: { $regex: emailRegex } });
      if (!insurance) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Check if the insurance user is blocked
      if (insurance.blocked === true) {
        return res.status(403).json({
          message: "User is Deleted",
        });
      }

      // Update fcmToken if necessary
      if (fcmToken && insurance.fcmToken !== fcmToken) {
        insurance.fcmToken = fcmToken;
        await insurance.save();
      }

      // Check if the user is verified
      if (insurance.isVerified == false) {
        return res.status(403).json({ message: "User not verified" });
      }

      // match password
      const match = await bcrypt.compare(password, insurance.password);
      if (!match) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Generate tokens
      const accessToken = JWTService.signAccessToken(
        { _id: insurance._id },
        "365d"
      );
      const refreshToken = JWTService.signRefreshToken(
        { _id: insurance._id },
        "365d"
      );

      // Update refresh token in database
      await RefreshToken.updateOne(
        { userId: insurance._id },
        { token: refreshToken },
        { upsert: true }
      );

      // Update access token in database
      await AccessToken.updateOne(
        { userId: insurance._id },
        { token: accessToken },
        { upsert: true }
      );

      const insuranceDto = new insuranceDTO(insurance);

      return res
        .status(200)
        .json({ insurance: insuranceDto, auth: true, token: accessToken });
    } catch (error) {
      return next(error);
    }
  },

  async completeSignup(req, res, next) {
    const insuranceRegisterSchema = Joi.object({
      phoneNumber: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().pattern(passwordPattern).required(),
      confirmPassword: Joi.ref("password"),
    });

    const { error } = insuranceRegisterSchema.validate(req.body);

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
      insurance: existingUser,
    });
  },

  async updateProfile(req, res, next) {
    const insuranceSchema = Joi.object({
      name: Joi.string().allow(""),
      currentPassword: Joi.string().allow(""),
      password: Joi.string().pattern(passwordPattern).allow(""),
      companyLicenseNo: Joi.string().allow(""),
      licenseExpiry: Joi.string().allow(""),
      ownerFirstName: Joi.string().allow(""),
      ownerLastName: Joi.string().allow(""),
      emergencyNo: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      location: Joi.object().allow(null),
      // website: Joi.string().allow(""),
      // twitter: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
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

    const { error } = insuranceSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      name,
      currentPassword,
      password,
      companyLicenseNo,
      licenseExpiry,
      ownerFirstName,
      ownerLastName,
      emergencyNo,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      location,
      accountTitle,
      ntn,
      // website,
      // twitter,
      youtube,
      linkedIn,
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
      fcmToken,
    } = req.body;
    const insuranceId = req.user._id;

    const insurance = await Insurance.findById(insuranceId);

    if (!insurance) {
      return res.status(404).json([]);
    }

    if (currentPassword && password) {
      const match = await bcrypt.compare(currentPassword, insurance.password);

      if (!match) {
        const error = {
          status: 401,
          message: "Incorrect Current Password",
        };

        return next(error);
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      insurance.password = hashedPassword;
    }

    // Update only the provided fields
    if (name) insurance.name = name;
    if (companyLicenseNo) insurance.companyLicenseNo = companyLicenseNo;
    if (licenseExpiry) insurance.licenseExpiry = licenseExpiry;
    if (ownerFirstName) insurance.ownerFirstName = ownerFirstName;
    if (ownerLastName) insurance.ownerLastName = ownerLastName;

    if (emergencyNo) insurance.emergencyNo = emergencyNo;
    if (cnicOrPassportNo) insurance.cnicOrPassportNo = cnicOrPassportNo;
    if (cnicOrPassportExpiry)
      insurance.cnicOrPassportExpiry = cnicOrPassportExpiry;
    if (location) insurance.location = location;
    // if (website) insurance.website = website;
    if (facebook) insurance.facebook = facebook;
    // if (twitter) insurance.twitter = twitter;
    if (linkedIn) insurance.linkedIn = linkedIn;
    if (ntn) insurance.ntn = ntn;
    if (accountTitle) insurance.accountTitle = accountTitle;
    if (youtube) insurance.youtube = youtube;
    if (instagram) insurance.instagram = instagram;
    // if (incomeTaxNo) insurance.incomeTaxNo = incomeTaxNo;
    // if (salesTaxNo) insurance.salesTaxNo = salesTaxNo;
    if (bankName) insurance.bankName = bankName;
    // if (accountHolderName) insurance.accountHolderName = accountHolderName;
    if (accountNumber) insurance.accountNumber = accountNumber;
    if (logo) insurance.logo = logo;
    if (licenseImage) insurance.licenseImage = licenseImage;
    if (cnicImage) insurance.cnicImage = cnicImage;
    if (taxFileImage) insurance.taxFileImage = taxFileImage;
    if (fcmToken) insurance.fcmToken = fcmToken;

    // Save the updated test
    await insurance.save();

    return res.status(200).json({
      message: "Insurance updated successfully",
      insurance: insurance,
    });
  },

  async logout(req, res, next) {
    const userId = req.user._id;
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    try {
      await RefreshToken.deleteOne({ userId });
      await AccessToken.deleteOne({ token: accessToken });
      await Insurance.findByIdAndUpdate(userId, { $unset: { fcmToken: "" } });

      res.status(200).json({ insurance: null, auth: false });
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
        insurance: insuranceDto,
        auth: true,
        accessToken: accessToken,
      });
    } catch (e) {
      return next(e);
    }
  },
};

module.exports = insuranceAuthController;
