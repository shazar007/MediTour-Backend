const express = require("express");
const app = express();
const Donation = require("../../models/Donation/donationCompany.js");
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const donationDTO = require("../../dto/donation.js");
const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");
const DonationCompany = require("../../models/Donation/donationCompany.js");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

async function getNextVendorId() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestVendor = await DonationCompany.findOne({}).sort({
      createdAt: -1,
    });

    let nextVendorId = 1;
    if (latestVendor && latestVendor.vendorId) {
      // Extract the numeric part of the orderId and increment it
      const currentVendorId = parseInt(latestVendor.vendorId.substring(3));
      nextVendorId = currentVendorId + 1;
    }

    // Generate the next orderId
    const nextOrderId = `DON${nextVendorId.toString().padStart(4, "0")}`;

    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}
const donationAuthController = {
  async register(req, res, next) {
    const donationRegisterSchema = Joi.object({
      name: Joi.string().required(),
      companyLicenseNo: Joi.string().optional().allow(""),
      companyLicenseExpiry: Joi.string().optional().allow(""),
      ownerFirstName: Joi.string().required(),
      ownerLastName: Joi.string().required(),
      companyEmergencyNo: Joi.string().required(),
      cnicOrPassportNo: Joi.string().allow(""),
      country: Joi.string().optional().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      location: Joi.object().required(),
      // website: Joi.string().allow(""),
      // twitter: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      // incomeTaxNo: Joi.string().allow(""),
      // salesTaxNo: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      // accountHolderName: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
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

    const { error } = donationRegisterSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const {
      name,
      email,
      password,
      phoneNumber,
      companyLicenseNo,
      companyLicenseExpiry,
      ownerFirstName,
      ownerLastName,
      companyEmergencyNo,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      location,
      country,
      // website,
      // twitter,
      facebook,
      youtube,
      instagram,
      linkedIn,
      // incomeTaxNo,
      // salesTaxNo,
      bankName,
      // accountHolderName,
      accountNumber,
      logo,
      accountTitle,
      ntn,
      licenseImage,
      cnicImage,
      taxFileImage,
      fcmToken,
    } = req.body;

    let accessToken;
    let refreshToken;

    let donation;
    try {
      let isVerified = false; // Default to false

      // If email is provided, check if it exists in the database
      if (email) {
        const emailRegex = new RegExp(email, "i");
        const existingDonation = await Donation.findOne({
          email: { $regex: emailRegex },
        });

        if (existingDonation) {
          // Check if email already exists in the database and is verified
          if (existingDonation.isVerified) {
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
      // Generate MR number
      const vendorId = await getNextVendorId();
      const donationToRegister = new Donation({
        vendorId,
        name,
        email, // Optional field
        password: hashedPassword, // Optional field
        phoneNumber, // Optional field
        companyLicenseNo,
        companyLicenseExpiry,
        ownerFirstName,
        ownerLastName,
        country,
        linkedIn,
        companyEmergencyNo,
        cnicOrPassportNo,
        cnicOrPassportExpiry,
        location,
        // website,
        facebook,
        // twitter,
        accountTitle,
        ntn,
        youtube,
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
        isVerified, // Default value is false
        fcmToken,
        activationRequest: "accepted",
        paidActivation: true,
      });

      donation = await donationToRegister.save();

      // Generate and return tokens only if email is provided
      let accessToken = null;
      let refreshToken = null;
      if (email) {
        const userId = donation._id;
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
        donation: donation,
        message: message,
        auth: !!email, // Authentication is true only if email exists
        token: accessToken || null, // Token is returned only if email exists
      });
    } catch (err) {
      next(err); // Pass any errors to the error handler
    }
  },
  async login(req, res, next) {
    const donationSchema = Joi.object({
      email: Joi.string().required(),
      password: Joi.string().required(),
      fcmToken: Joi.string(),
    });

    const { error } = donationSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const { email, password, fcmToken } = req.body;

    let donation;

    try {
      // match username
      const emailRegex = new RegExp(email, "i");
      donation = await Donation.findOne({ email: { $regex: emailRegex } });
      if (!donation) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Check if the donation user is blocked
      if (donation.blocked === true) {
        return res.status(403).json({
          message: "User is Deleted",
        });
      }

      // Update fcmToken if necessary
      if (fcmToken && donation.fcmToken !== fcmToken) {
        donation.fcmToken = fcmToken;
        await donation.save();
      }

      // Check if the user is verified
      if (donation.isVerified == false) {
        return res.status(403).json({ message: "User not verified" });
      }

      // match password
      const match = await bcrypt.compare(password, donation.password);
      if (!match) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Generate tokens
      const accessToken = JWTService.signAccessToken(
        { _id: donation._id },
        "365d"
      );
      const refreshToken = JWTService.signRefreshToken(
        { _id: donation._id },
        "365d"
      );

      // Update refresh token in database
      await RefreshToken.updateOne(
        { userId: donation._id },
        { token: refreshToken },
        { upsert: true }
      );

      // Update access token in database
      await AccessToken.updateOne(
        { userId: donation._id },
        { token: accessToken },
        { upsert: true }
      );

      const donationDto = new donationDTO(donation);

      return res
        .status(200)
        .json({ donation: donationDto, auth: true, token: accessToken });
    } catch (error) {
      return next(error);
    }
  },

  async completeSignup(req, res, next) {
    const donationSchema = Joi.object({
      phoneNumber: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().pattern(passwordPattern).required(),
      confirmPassword: Joi.ref("password"),
    });

    const { error } = donationSchema.validate(req.body);

    // 2. if error in validation -> return error via middleware
    if (error) {
      return next(error);
    }

    const { password, email, phoneNumber } = req.body;
    const emailRegex = new RegExp(email, "i");
    const emailExists = await Donation.findOne({
      email: { $regex: emailRegex },
    });
    if (emailExists) {
      const error = new Error("Email already exists!");
      error.status = 400;
      return next(error);
    }
    const userId = req.query.id;
    const existingUser = await Donation.findById(userId);

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
      donation: existingUser,
    });
  },

  async updateProfile(req, res, next) {
    const donationSchema = Joi.object({
      name: Joi.string().allow(""),
      companyLicenseNo: Joi.string().allow(""),
      companyLicenseExpiry: Joi.string().allow(""),
      ownerFirstName: Joi.string().allow(""),
      currentPassword: Joi.string().allow(""),
      password: Joi.string().pattern(passwordPattern).allow(""),
      ownerLastName: Joi.string().allow(""),
      companyEmergencyNo: Joi.string().allow(""),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      // website: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      // twitter: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
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

    const { error } = donationSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      name,
      companyLicenseNo,
      companyLicenseExpiry,
      ownerFirstName,
      currentPassword,
      password,
      ownerLastName,
      companyEmergencyNo,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
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
      logo,
      licenseImage,
      accountTitle,
      ntn,
      cnicImage,
      taxFileImage,
    } = req.body;
    const donationId = req.user._id;

    const donation = await Donation.findById(donationId);

    if (!donation) {
      return res.status(404).json([]);
    }

    if (currentPassword && password) {
      const match = await bcrypt.compare(currentPassword, donation.password);

      if (!match) {
        const error = {
          status: 401,
          message: "Incorrect Current Password",
        };

        return next(error);
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      donation.password = hashedPassword;
    }

    // Update only the provided fields
    if (name) donation.name = name;
    if (companyLicenseNo) donation.companyLicenseNo = companyLicenseNo;
    if (companyLicenseExpiry)
      donation.companyLicenseExpiry = companyLicenseExpiry;
    if (ownerFirstName) donation.ownerFirstName = ownerFirstName;
    if (ownerLastName) donation.ownerLastName = ownerLastName;
    if (companyEmergencyNo) donation.companyEmergencyNo = companyEmergencyNo;
    if (cnicOrPassportNo) donation.cnicOrPassportNo = cnicOrPassportNo;
    if (cnicOrPassportExpiry)
      donation.cnicOrPassportExpiry = cnicOrPassportExpiry;
    // if (website) donation.website = website;
    if (facebook) donation.facebook = facebook;
    if (linkedIn) donation.linkedIn = linkedIn;
    // if (twitter) donation.twitter = twitter;
    if (ntn) donation.ntn = ntn;
    if (accountTitle) donation.accountTitle = accountTitle;
    if (youtube) donation.youtube = youtube;
    if (instagram) donation.instagram = instagram;
    // if (incomeTaxNo) donation.incomeTaxNo = incomeTaxNo;
    // if (salesTaxNo) donation.salesTaxNo = salesTaxNo;
    if (bankName) donation.bankName = bankName;
    // if (accountHolderName) donation.accountHolderName = accountHolderName;
    if (accountNumber) donation.accountNumber = accountNumber;
    if (logo) donation.logo = logo;
    if (licenseImage) donation.licenseImage = licenseImage;
    if (cnicImage) donation.cnicImage = cnicImage;
    if (taxFileImage) donation.taxFileImage = taxFileImage;

    // Save the updated test
    await donation.save();

    return res.status(200).json({
      message: "Donation Company updated successfully",
      donation: donation,
    });
  },

  async logout(req, res, next) {
    const userId = req.user._id;
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    try {
      await RefreshToken.deleteOne({ userId });
      await AccessToken.deleteOne({ token: accessToken });
      await DonationCompany.findByIdAndUpdate(userId, {
        $unset: { fcmToken: "" },
      });

      res.status(200).json({ donation: null, auth: false });
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

      const donation = await Donation.findOne({ _id: id });

      const donationDto = new donationDTO(agency);

      return res.status(200).json({
        donation: donationDto,
        auth: true,
        accessToken: accessToken,
      });
    } catch (e) {
      return next(e);
    }
  },
};

module.exports = donationAuthController;
