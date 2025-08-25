const express = require("express");
const app = express();
const Agency = require("../../models/Travel Agency/travelAgency.js");
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const agencyDTO = require("../../dto/travel agency/travelAgency.js");
const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");
const travelAgency = require("../../models/Travel Agency/travelAgency.js");
const TravelCompany = require("../../models/Travel Company/travelCompany.js");
const AgencyRequest = require("../../models/Travel Company/requests.js");
const Notification = require("../../models/notification.js");
const { sendchatNotification } = require("../../firebase/service/index.js");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;
async function getNextVendorId() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestVendor = await travelAgency.findOne({}).sort({ createdAt: -1 });

    let nextVendorId = 1;
    if (latestVendor && latestVendor.vendorId) {
      // Extract the numeric part of the orderId and increment it
      const currentVendorId = parseInt(latestVendor.vendorId.substring(3));
      nextVendorId = currentVendorId + 1;
    }

    // Generate the next orderId
    const nextOrderId = `TRA${nextVendorId.toString().padStart(4, "0")}`;

    return nextOrderId;
  } catch (error) {
    console.error("Error in getNextVendorId:", error);
    throw new Error("Failed to generate order number");
  }
}

const ambulanceAuthController = {
  async register(req, res, next) {
    const ambulanceRegisterSchema = Joi.object({
      name: Joi.string().required(),
      experience: Joi.number().optional(),
      features: Joi.array().optional(),
      companyLicenseNo: Joi.string().optional().allow(""),
      licenseExpiry: Joi.string().optional().allow(""),
      emergencyNo: Joi.string().required(),
      ownerFirstName: Joi.string().required(),
      ownerLastName: Joi.string().required(),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      country: Joi.string().optional().allow(""),
      location: Joi.object().required(),
      // website: Joi.string().allow(""),
      // twitter: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      // incomeTaxNo: Joi.string().allow(""),
      // salesTaxNo: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      // accountHolderName: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      logo: Joi.string().required(),
      comapnyLicenseImage: Joi.string().allow(""),
      cnicImage: Joi.string().allow(""),
      taxFileImage: Joi.string().optional().allow(""),
      fcmToken: Joi.string(),
      phoneNumber: Joi.string().optional(), // Phone number is optional
      email: Joi.string().email().optional(), // Email is optional
      travelCompanyId: Joi.string().optional(),
      password: Joi.string()
        .pattern(passwordPattern)
        .message("Must include 1 uppercase, 1 special character and 1 digit.")
        .when("email", {
          is: Joi.exist(),
          then: Joi.required(), // Required only if email is provided
          otherwise: Joi.optional(), // Optional otherwise
        }),
      isAddingCompany: Joi.boolean().optional(),
      isNational: Joi.boolean(),
    });
    const { error } = ambulanceRegisterSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const {
      name,
      experience,
      features,
      companyLicenseNo,
      email,
      password,
      phoneNumber,
      licenseExpiry,
      emergencyNo,
      ownerFirstName,
      ownerLastName,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      country,
      location,
      // website,
      // twitter,
      facebook,
      instagram,
      youtube,
      linkedIn,
      // incomeTaxNo,
      // salesTaxNo,
      bankName,
      // accountHolderName,
      accountTitle,
      ntn,
      accountNumber,
      logo,
      comapnyLicenseImage,
      cnicImage,
      taxFileImage,
      fcmToken,
      travelCompanyId,
      isAddingCompany,
      isNational
    } = req.body;

    let accessToken;
    let refreshToken;

    let agency;
    try {
      let isVerified = false; // Default to false

      // If email is provided, check if it exists in the database
      if (email) {
        const existingAgency = await Agency.findOne({ email });

        if (existingAgency) {
          // Check if email already exists in the database and is verified
          if (existingAgency.isVerified) {
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
      const agencyToRegister = new Agency({
        name,
        experience,
        features,
        vendorId,
        companyLicenseNo,
        licenseExpiry,
        emergencyNo,
        ownerFirstName,
        ownerLastName,
        cnicOrPassportNo,
        cnicOrPassportExpiry,
        country,
        location,
        // website,
        // twitter,
        facebook,
        youtube,
        linkedIn,
        instagram,
        // incomeTaxNo,
        // salesTaxNo,
        bankName,
        accountTitle,
        ntn,
        // accountHolderName,
        accountNumber,
        logo,
        comapnyLicenseImage,
        cnicImage,
        taxFileImage,
        email, // Optional field
        password: hashedPassword, // Optional field
        phoneNumber, // Optional field
        fcmToken,
        isVerified, // Default value is false
        ...(isNational && {
          activationRequest: "accepted",
          paidActivation: true,
        }),
        isNational: isNational,
      });

      agency = await agencyToRegister.save();

      if (travelCompanyId && isAddingCompany == false) {
        const travelCompany = await TravelCompany.findById(travelCompanyId);
        const id = agency._id;
        travelCompany.agencyIds.push(id);
        await travelCompany.save();
        agencyToRegister.travelCompanyId = travelCompanyId;
        agencyToRegister.entityType = "company";
        agencyToRegister.paidActivation = true;
        agencyToRegister.activationRequest = "accepted";
      } else if (travelCompanyId && isAddingCompany == true) {
        const agencyRequest = new AgencyRequest({
          vendorId: agency._id,
          vendorModel: "Travel Agency",
          travelCompanyId: travelCompanyId,
        });
        await agencyRequest.save();
        notificationMessage =
          "You have a received a new request from travel agency!";

        sendchatNotification(
          travelCompanyId,
          { title: "Invitation Request", message: notificationMessage },
          (type = "Travel Company") // Pass the normalized type here
        );

        // Save the notification to the database
        const notification = new Notification({
          senderId: agency._id,
          senderModelType: "Travel Agency",
          receiverId: travelCompanyId,
          receiverModelType: "Travel Company", // Correct receiver model type
          title: "Invitation Request",
          message: notificationMessage,
        });
        await notification.save();
      }
      await agency.save();

      // Generate and return tokens only if email is provided
      let accessToken = null;
      let refreshToken = null;
      if (email) {
        const userId = agency._id;
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
        travelAgency: agency,
        message: message,
        auth: !!email, // Authentication is true only if email exists
        token: accessToken || null, // Token is returned only if email exists
      });
    } catch (err) {
      next(err); // Pass any errors to the error handler
    }
  },
  async login(req, res, next) {
    const agencySchema = Joi.object({
      email: Joi.string().required(),
      password: Joi.string(),
      fcmToken: Joi.string(),
    });

    const { error } = agencySchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const { email, password, fcmToken } = req.body;

    let agency;

    try {
      // Match username
      const emailRegex = new RegExp(email, "i");
      agency = await Agency.findOne({ email: { $regex: emailRegex } });

      if (!agency) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Check if the agency is blocked
      if (agency.blocked === true) {
        return res.status(403).json({
          message: "User is Deleted",
        });
      }

      // Update fcmToken if necessary
      if (fcmToken && agency?.fcmToken !== fcmToken) {
        agency.fcmToken = fcmToken;
        await agency.save();
      } else {
        console.log("same Token");
      }

      // Check if the user is verified
      if (agency.isVerified == false) {
        return res.status(403).json({ message: "User not verified" });
      }

      // // Match password
      const match = await bcrypt.compare(password, agency.password);
      if (!match) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }
    } catch (error) {
      return next(error);
    }

    // Generate tokens
    const accessToken = JWTService.signAccessToken({ _id: agency._id }, "365d");
    const refreshToken = JWTService.signRefreshToken(
      { _id: agency._id },
      "365d"
    );

    // Update refresh token in database
    try {
      await RefreshToken.updateOne(
        { userId: agency._id },
        { token: refreshToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    // Update access token in database
    try {
      await AccessToken.updateOne(
        { userId: agency._id },
        { token: accessToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    // Return response
    return res
      .status(200)
      .json({ travelAgency: agency, auth: true, token: accessToken });
  },

  async completeSignup(req, res, next) {
    const agencyRegisterSchema = Joi.object({
      phoneNumber: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().pattern(passwordPattern).required(),
      confirmPassword: Joi.ref("password"),
    });

    const { error } = agencyRegisterSchema.validate(req.body);

    // 2. if error in validation -> return error via middleware
    if (error) {
      return next(error);
    }

    const { password, email, phoneNumber } = req.body;
    const emailRegex = new RegExp(email, "i");
    const emailExists = await Agency.findOne({ email: { $regex: emailRegex } });
    if (emailExists) {
      const error = new Error("Email already exists!");
      error.status = 400;
      return next(error);
    }
    const userId = req.query.id;
    const existingUser = await Agency.findById(userId);

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
      travelAgency: existingUser,
    });
  },

  async updateProfile(req, res, next) {
    const agencySchema = Joi.object({
      name: Joi.string().allow(""),
      experience: Joi.number().allow(""),
      features: Joi.array().allow(""),
      companyLicenseNo: Joi.string().allow(""),
      licenseExpiry: Joi.string().allow(""),
      emergencyNo: Joi.string().allow(""),
      ownerFirstName: Joi.string().allow(""),
      ownerLastName: Joi.string().allow(""),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      location: Joi.object().allow(null),
      phoneNumber: Joi.string().allow(""),
      currentPassword: Joi.string().allow(""),
      password: Joi.string().pattern(passwordPattern).allow(""),
      // website: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      // twitter: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      // incomeTaxNo: Joi.string().allow(""),
      // salesTaxNo: Joi.string().allow(""),
      logo: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      // accountHolderName: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      comapnyLicenseImage: Joi.string().allow(""),
      cnicImage: Joi.string().allow(""),
      taxFileImage: Joi.string().allow(""),
    });

    const { error } = agencySchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      name,
      experience,
      companyLicenseNo,
      licenseExpiry,
      emergencyNo,
      ownerFirstName,
      ownerLastName,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      location,
      phoneNumber,
      currentPassword,
      password,
      // website,
      // twitter,
      facebook,
      accountTitle,
      ntn,
      instagram,
      youtube,
      linkedIn,
      // incomeTaxNo,
      // salesTaxNo,
      bankName,
      logo,
      // accountHolderName,
      accountNumber,
      comapnyLicenseImage,
      cnicImage,
      taxFileImage,
      features
    } = req.body;
    const agencyId = req.user._id;

    const agency = await Agency.findById(agencyId);

    if (!agency) {
      return res.status(404).json([]);
    }

    if (currentPassword && password) {
      const match = await bcrypt.compare(currentPassword, agency.password);

      if (!match) {
        const error = {
          status: 401,
          message: "Incorrect Current Password",
        };

        return next(error);
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      agency.password = hashedPassword;
    }

    // Update only the provided fields
    if (name) agency.name = name;
    if (experience) agency.experience = experience;
    if (companyLicenseNo) agency.companyLicenseNo = companyLicenseNo;
    if (licenseExpiry) agency.licenseExpiry = licenseExpiry;
    if (emergencyNo) agency.emergencyNo = emergencyNo;
    if (ownerFirstName) agency.ownerFirstName = ownerFirstName;
    if (ownerLastName) agency.ownerLastName = ownerLastName;
    if (cnicOrPassportNo) agency.cnicOrPassportNo = cnicOrPassportNo;
    if (cnicOrPassportExpiry)
      agency.cnicOrPassportExpiry = cnicOrPassportExpiry;
    if (location) agency.location = location;
    if (phoneNumber) agency.phoneNumber = phoneNumber;
    // if (website) agency.website = website;
    if (facebook) agency.facebook = facebook;
    // if (twitter) agency.twitter = twitter;
    if (instagram) agency.instagram = instagram;
    if (youtube) agency.youtube = youtube;
    if (linkedIn) agency.linkedIn = linkedIn;
    // if (incomeTaxNo) agency.incomeTaxNo = incomeTaxNo;
    // if (salesTaxNo) agency.salesTaxNo = salesTaxNo;
    if (bankName) agency.bankName = bankName;
    if (logo) agency.logo = logo;
    if (ntn) agency.ntn = ntn;
    if (accountTitle) agency.accountTitle = accountTitle;
    // if (accountHolderName) agency.accountHolderName = accountHolderName;
    if (accountNumber) agency.accountNumber = accountNumber;
    if (comapnyLicenseImage) agency.comapnyLicenseImage = comapnyLicenseImage;
    if (cnicImage) agency.cnicImage = cnicImage;
    if (taxFileImage) agency.taxFileImage = taxFileImage;
    if (features) agency.features = features;

    // Save the updated test
    await agency.save();

    return res.status(200).json({
      message: "Travel Agency updated successfully",
      travelAgency: agency,
    });
  },

  async logout(req, res, next) {
    const userId = req.user._id;
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    try {
      await RefreshToken.deleteOne({ userId });
      await AccessToken.deleteOne({ token: accessToken });
      await Agency.findByIdAndUpdate(userId, { $unset: { fcmToken: "" } });

      res.status(200).json({ agency: null, auth: false });
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

      const agency = await Agency.findOne({ _id: id });

      const agencyDto = new agencyDTO(agency);

      return res.status(200).json({
        travelAgency: agencyDto,
        auth: true,
        accessToken: accessToken,
      });
    } catch (e) {
      return next(e);
    }
  },
};

module.exports = ambulanceAuthController;
