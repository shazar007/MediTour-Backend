const express = require("express");
const app = express();
const Hotel = require("../../models/Hotel/hotel.js");
const TravelCompany = require("../../models/Travel Company/travelCompany.js");
const HotelRequest = require("../../models/Travel Company/requests.js");
const Notification = require("../../models/notification.js");
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const hotelDTO = require("../../dto/hotel.js");
const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");
const { sendchatNotification } = require("../../firebase/service/index.js");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

async function getNextVendorId() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestVendor = await Hotel.findOne({}).sort({ createdAt: -1 });

    let nextVendorId = 1;
    if (latestVendor && latestVendor.vendorId) {
      // Extract the numeric part of the orderId and increment it
      const currentVendorId = parseInt(latestVendor.vendorId.substring(3));
      nextVendorId = currentVendorId + 1;
    }

    // Generate the next orderId
    const nextOrderId = `HOT${nextVendorId.toString().padStart(4, "0")}`;

    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}

const hotelAuthController = {
  async register(req, res, next) {
    const hotelRegisterSchema = Joi.object({
      name: Joi.string().required(),
      features: Joi.array().optional(),
      experience: Joi.number().optional(),
      companyLicenseNo: Joi.string().optional().allow(""),
      companyLicenseExpiry: Joi.string().optional().allow(""),
      ownerFirstName: Joi.string().required(),
      ownerLastName: Joi.string().required(),
      companyEmergencyNo: Joi.string().required(),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      country: Joi.string().optional().allow(""),
      location: Joi.object().required(),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      // website: Joi.string().allow(""),
      // twitter: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      // incomeTaxNo: Joi.string().allow(""),
      // salesTaxNo: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      // accountHolderName: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      logo: Joi.string().required(),
      licenseImage: Joi.string().allow(""),
      cnicImage: Joi.string().allow(""),
      taxFileImage: Joi.string().allow(""),
      fcmToken: Joi.string(),
      properties: Joi.object(),
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

    const { error } = hotelRegisterSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const {
      name,
      features,
      experience,
      companyLicenseNo,
      companyLicenseExpiry,
      ownerFirstName,
      email,
      password,
      phoneNumber,
      ownerLastName,
      companyEmergencyNo,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      country,
      location,
      // website,
      // twitter,
      accountTitle,
      ntn,
      youtube,
      facebook,
      linkedIn,
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
      properties,
      travelCompanyId,
      isAddingCompany,
      isNational
    } = req.body;

    let accessToken;
    let refreshToken;
    let hotel;
    try {
      let isVerified = false; // Default to false

      // If email is provided, check if it exists in the database
      if (email) {
        const existingHotel = await Hotel.findOne({ email });

        if (existingHotel) {
          // Check if email already exists in the database and is verified
          if (existingHotel.isVerified) {
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

      const hotelToRegister = new Hotel({
        name,
        features,
        experience,
        vendorId,
        companyLicenseNo,
        companyLicenseExpiry,
        ownerFirstName,
        ownerLastName,
        companyEmergencyNo,
        cnicOrPassportNo,
        cnicOrPassportExpiry,
        country,
        location,
        // website,
        // twitter,
        youtube,
        facebook,
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
        licenseImage,
        cnicImage,
        taxFileImage,
        email, // Optional field
        password: hashedPassword, // Optional field
        phoneNumber, // Optional field
        fcmToken,
        isVerified, // Default value is false
        properties,
        ...(isNational && {
          activationRequest: "accepted",
          paidActivation: true,
        }),
        isNational: isNational,
      });

      await hotelToRegister.save();

      if (travelCompanyId && isAddingCompany == false) {
        const travelCompany = await TravelCompany.findById(travelCompanyId);
        const id = hotelToRegister._id;
        travelCompany.hotelIds.push(id);
        await travelCompany.save();
        hotelToRegister.travelCompanyId = travelCompanyId;
        hotelToRegister.entityType = "company";
        hotelToRegister.paidActivation = true;
        hotelToRegister.activationRequest = "accepted";
      } else if (travelCompanyId && isAddingCompany == true) {
        const hotelRequest = new HotelRequest({
          vendorId: hotelToRegister._id,
          vendorModel: "Hotel",
          travelCompanyId: travelCompanyId,
        });
        await hotelRequest.save();
        notificationMessage = "You have a received a new request from a Hotel!";
        type = "Travel Company";

        sendchatNotification(
          travelCompanyId,
          { title: "Invitation Request", message: notificationMessage },
          type // Pass the normalized type here
        );

        // Save the notification to the database
        const notification = new Notification({
          senderId: hotelToRegister._id,
          senderModelType: "Hotel",
          receiverId: travelCompanyId,
          receiverModelType: "Travel Company", // Correct receiver model type
          title: "Invitation Request",
          message: notificationMessage,
        });
        await notification.save();
      }

      await hotelToRegister.save();

      let accessToken = null;
      let refreshToken = null;
      if (email) {
        const userId = hotelToRegister._id;
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
        hotel: hotelToRegister,
        message: message,
        auth: !!email, // Authentication is true only if email exists
        token: accessToken || null, // Token is returned only if email exists
      });
    } catch (err) {
      next(err); // Pass any errors to the error handler
    }
  },

  async login(req, res, next) {
    const hotelSchema = Joi.object({
      email: Joi.string().required(),
      password: Joi.string().required(),
      fcmToken: Joi.string(),
    });

    const { error } = hotelSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const { email, password, fcmToken } = req.body;

    let hotel;

    try {
      // match username
      const emailRegex = new RegExp(email, "i");
      hotel = await Hotel.findOne({ email: { $regex: emailRegex } });
      if (!hotel) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Check if the hotel user is blocked
      if (hotel.blocked === true) {
        return res.status(403).json({
          message: "User is Deleted",
        });
      }

      // Update fcmToken if necessary
      //update fcmToken
      if (fcmToken && hotel?.fcmToken !== fcmToken) {
        Object.keys(hotel).map((key) => (hotel["fcmToken"] = fcmToken));

        let update = await hotel.save();
      }

      // Check if the user is verified
      if (hotel.isVerified == false) {
        return res.status(403).json({ message: "User not verified" });
      }

      // match password
      const match = await bcrypt.compare(password, hotel.password);
      if (!match) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Generate tokens
      const accessToken = JWTService.signAccessToken(
        { _id: hotel._id },
        "365d"
      );
      const refreshToken = JWTService.signRefreshToken(
        { _id: hotel._id },
        "365d"
      );

      // Update refresh token in database
      await RefreshToken.updateOne(
        { userId: hotel._id },
        { token: refreshToken },
        { upsert: true }
      );

      // Update access token in database
      await AccessToken.updateOne(
        { userId: hotel._id },
        { token: accessToken },
        { upsert: true }
      );

      // const hotelDto = new hotelDTO(hotel);

      return res
        .status(200)
        .json({ hotel: hotel, auth: true, token: accessToken });
    } catch (error) {
      return next(error);
    }
  },

  async completeSignup(req, res, next) {
    const hotelRegisterSchema = Joi.object({
      phoneNumber: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().pattern(passwordPattern).required(),
      confirmPassword: Joi.ref("password"),
    });

    const { error } = hotelRegisterSchema.validate(req.body);

    // 2. if error in validation -> return error via middleware
    if (error) {
      return next(error);
    }

    const { password, email, phoneNumber } = req.body;
    const emailRegex = new RegExp(email, "i");
    const emailExists = await Hotel.findOne({ email: { $regex: emailRegex } });
    if (emailExists) {
      const error = new Error("Email already exists!");
      error.status = 400;
      return next(error);
    }
    const userId = req.query.id;
    const existingUser = await Hotel.findById(userId);

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
      hotel: existingUser,
    });
  },

  async updateProfile(req, res, next) {
    const hotelSchema = Joi.object({
      name: Joi.string().allow(""),
      features: Joi.array().allow(""),
      experience: Joi.number().allow(""),
      companyLicenseNo: Joi.string().allow(""),
      companyLicenseExpiry: Joi.string().allow(""),
      ownerFirstName: Joi.string().allow(""),
      ownerLastName: Joi.string().allow(""),
      companyEmergencyNo: Joi.string().allow(""),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      location: Joi.object().allow(""),
      // website: Joi.string().allow(""),
      // twitter: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      phoneNumber: Joi.string().allow(""),
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
      properties: Joi.object().allow(null),
      currentPassword: Joi.string().allow(null, ""),
      password: Joi.string().allow(null, ""),
    });

    const { error } = hotelSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      name,
      experience,
      features,
      companyLicenseNo,
      companyLicenseExpiry,
      ownerFirstName,
      ownerLastName,
      companyEmergencyNo,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      location,
      // website,
      // twitter,
      youtube,
      phoneNumber,
      instagram,
      // incomeTaxNo,
      // salesTaxNo,
      bankName,
      // accountHolderName,
      accountNumber,
      logo,
      facebook,
      linkedIn,
      licenseImage,
      cnicImage,
      taxFileImage,
      properties,
      accountTitle,
      ntn,
      currentPassword,
      password,
    } = req.body;
    const hotelId = req.user._id;
    const hotel = await Hotel.findById(hotelId);

    if (!hotel) {
      return res.status(404).json([]);
    }

    if (currentPassword && password) {
      const match = await bcrypt.compare(currentPassword, hotel.password);

      if (!match) {
        const error = {
          status: 401,
          message: "Incorrect Current Password",
        };

        return next(error);
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      hotel.password = hashedPassword;
    }
    // Update only the provided fields
    if (name) hotel.name = name;
    if (features) hotel.features = features;
    if (experience) hotel.experience = experience;
    if (companyLicenseNo) hotel.companyLicenseNo = companyLicenseNo;
    if (companyLicenseExpiry) hotel.companyLicenseExpiry = companyLicenseExpiry;
    if (ownerFirstName) hotel.ownerFirstName = ownerFirstName;
    if (ownerLastName) hotel.ownerLastName = ownerLastName;
    if (companyEmergencyNo) hotel.companyEmergencyNo = companyEmergencyNo;
    if (cnicOrPassportNo) hotel.cnicOrPassportNo = cnicOrPassportNo;
    if (cnicOrPassportExpiry) hotel.cnicOrPassportExpiry = cnicOrPassportExpiry;
    if (location) hotel.location = location;
    // if (website) hotel.website = website;
    // if (twitter) hotel.twitter = twitter;
    if (youtube) hotel.youtube = youtube;
    if (linkedIn) hotel.linkedIn = linkedIn;
    if (facebook) hotel.facebook = facebook;
    if (phoneNumber) hotel.phoneNumber = phoneNumber;
    if (instagram) hotel.instagram = instagram;
    // if (incomeTaxNo) hotel.incomeTaxNo = incomeTaxNo;
    // if (salesTaxNo) hotel.salesTaxNo = salesTaxNo;
    if (ntn) hotel.ntn = ntn;
    if (accountTitle) hotel.accountTitle = accountTitle;
    if (bankName) hotel.bankName = bankName;
    // if (accountHolderName) hotel.accountHolderName = accountHolderName;
    if (accountNumber) hotel.accountNumber = accountNumber;
    if (logo) hotel.logo = logo;
    if (licenseImage) hotel.licenseImage = licenseImage;
    if (cnicImage) hotel.cnicImage = cnicImage;
    if (taxFileImage) hotel.taxFileImage = taxFileImage;
    if (properties) hotel.properties = properties;

    // Save the updated hotel details
    await hotel.save();

    return res.status(200).json({
      message: "Hotel updated successfully",
      hotel: hotel,
    });
  },

  async logout(req, res, next) {
    const userId = req.user._id;
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    try {
      await RefreshToken.deleteOne({ userId });
      await AccessToken.deleteOne({ token: accessToken });
      await Hotel.findByIdAndUpdate(userId, { $unset: { fcmToken: "" } });

      res.status(200).json({ hotel: null, auth: false });
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

      const hotel = await Hotel.findOne({ _id: id });

      const hotelDto = new hotelDTO(hotel);

      return res.status(200).json({
        hotel: hotelDto,
        auth: true,
        accessToken: accessToken,
      });
    } catch (e) {
      return next(e);
    }
  },
};

module.exports = hotelAuthController;
