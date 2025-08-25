const express = require("express");
const mongoose = require("mongoose");
const app = express();
const TravelCompany = require("../../models/Travel Company/travelCompany.js");
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const travCompanyDto = require("../../dto/travelCompany.js");
const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");
const Hotel = require("../../models/Hotel/hotel.js");
const Property = require("../../models/Hotel/property");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

async function getNextVendorId() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestVendor = await TravelCompany.findOne({}).sort({
      createdAt: -1,
    });

    let nextVendorId = 1;
    if (latestVendor && latestVendor.vendorId) {
      // Extract the numeric part of the orderId and increment it
      const currentVendorId = parseInt(latestVendor.vendorId.substring(3));
      nextVendorId = currentVendorId + 1;
    }
    // Generate the next orderId
    const nextOrderId = `TCP${nextVendorId.toString().padStart(4, "0")}`;

    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}

const docCompanyAuthController = {
  async register(req, res, next) {
    try {
      const travCompanyRegisterSchema = Joi.object({
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
        country: Joi.string().allow(""),
        fcmToken: Joi.string(),
        isNational: Joi.boolean(),
      });

      // Validate the request body against the schema
      const { error } = travCompanyRegisterSchema.validate(req.body);

      if (error) {
        return next(error); // Handle validation errors
      }

      // Destructure fields from request body
      const {
        phoneNumber,
        email,
        password,
        name,
        country,
        bankName,
        accountHolderName,
        accountTitle,
        ntn,
        accountNumber,
        fcmToken,
        isNational,
      } = req.body;

      const existingTravelCompany = await TravelCompany.findOne({ email });

      if (existingTravelCompany) {
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

      const newTravelCompany = new TravelCompany({
        vendorId,
        phoneNumber,
        email,
        password: hashedPassword,
        name,
        bankName,
        accountHolderName,
        accountTitle,
        country,
        ntn,
        accountNumber,
        fcmToken,
        ...(isNational && {
          activationRequest: "accepted",
          paidActivation: true,
        }),
        isNational: isNational,
      });

      await newTravelCompany.save();

      // Generate and return tokens only if email is provided
      let accessToken = null;
      let refreshToken = null;
      if (email) {
        const userId = newTravelCompany._id;
        accessToken = JWTService.signAccessToken({ _id: userId }, "365d");
        refreshToken = JWTService.signRefreshToken({ _id: userId }, "365d");

        await JWTService.storeRefreshToken(refreshToken, userId);
        await JWTService.storeAccessToken(accessToken, userId);
      }

      return res.status(201).json({
        auth: true,
        doctor: newTravelCompany,
      });
    } catch (err) {
      next(err); // Pass any errors to the error handler
    }
  },

  async login(req, res, next) {
    // Validate user input
    const travelCompanyLoginSchema = Joi.object({
      email: Joi.string().required(),
      password: Joi.string().required(),
      fcmToken: Joi.string(),
    });

    const { error } = travelCompanyLoginSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const { email, password, fcmToken } = req.body;

    let travCompany;

    try {
      // Match username using a case-insensitive regex
      const emailRegex = new RegExp(email, "i");
      travCompany = await TravelCompany.findOne({
        email: { $regex: emailRegex },
      });

      if (!travCompany) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Check if the doctor is blocked
      if (travCompany.blocked === true) {
        return res.status(403).json({
          message: "User is Deleted",
        });
      }

      // Update fcmToken if necessary
      if (fcmToken && travCompany.fcmToken !== fcmToken) {
        travCompany.fcmToken = fcmToken;
        await travCompany.save();
      }

      // Match password
      const match = await bcrypt.compare(password, travCompany.password);
      if (!match) {
        console.log("anything3");
        return res.status(400).json({ message: "Incorrect email or password" });
      }
    } catch (error) {
      return next(error);
    }

    // Generate tokens
    const accessToken = JWTService.signAccessToken(
      { _id: travCompany._id },
      "365d"
    );
    const refreshToken = JWTService.signRefreshToken(
      { _id: travCompany._id },
      "365d"
    );

    // Update refresh token in database
    try {
      await RefreshToken.updateOne(
        { userId: travCompany._id },
        { token: refreshToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    // Update access token in database
    try {
      await AccessToken.updateOne(
        { userId: travCompany._id },
        { token: accessToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    // Return response
    const travCompanyDTO = new travCompanyDto(travCompany);
    return res
      .status(200)
      .json({ travelCompany: travCompanyDTO, auth: true, token: accessToken });
  },

  async updateProfile(req, res, next) {
    const travCompSchema = Joi.object({
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
    console.log("in there un ");

    const { error } = travCompSchema.validate(req.body);

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
    const travCompId = req.user._id;

    const travComp = await TravelCompany.findById(travCompId);

    if (!travComp) {
      return res.status(404).json([]);
    }
    if (currentPassword && password) {
      const match = await bcrypt.compare(currentPassword, travComp.password);

      if (!match) {
        const error = {
          status: 401,
          message: "Incorrect Current Password",
        };

        return next(error);
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      travComp.password = hashedPassword;
    }

    // Update only the provided fields
    if (phoneNumber) travComp.phoneNumber = phoneNumber;
    if (name) travComp.name = name;
    if (bankName) travComp.bankName = bankName;
    if (accountHolderName) travComp.accountHolderName = accountHolderName;
    if (accountTitle) travComp.accountTitle = accountTitle;
    if (ntn) travComp.ntn = ntn;
    if (accountNumber) travComp.accountNumber = accountNumber;

    await travComp.save();

    return res
      .status(200)
      .json({ message: "Doctor updated successfully", travComp: travComp });
  },

  async logout(req, res, next) {
    const userId = req.user._id;
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    try {
      await RefreshToken.deleteOne({ userId });
      await AccessToken.deleteOne({ token: accessToken });
      await TravelCompany.findByIdAndUpdate(userId, {
        $unset: { fcmToken: "" },
      });

      res.status(200).json({ travelCompany: null, auth: false });
    } catch (error) {
      return next(error);
    }
  },

  async addBranch(req, res, next) {
    try {
      const branchSchema = Joi.object({
        propertyName: Joi.string().required().messages({
          "any.required": "Property name is required",
          "string.empty": "Property name is required",
        }),
        phone: Joi.string().required().messages({
          "any.required": "Phone number is required",
          "string.empty": "Phone number is required",
        }),
        uan: Joi.string().allow(null, ""), // Optional field
        location: Joi.object().required().messages({
          "any.required": "Location is required",
          "object.base": "Location is required",
        }),
        images: Joi.array().items(Joi.string()).allow(null, ""), // Optional field
        features: Joi.array().items(Joi.string()).allow(null, ""), // Optional field
      });

      // Validate the request body
      const { error, value } = branchSchema.validate(req.body, {
        abortEarly: false,
      });
      if (error) {
        return res
          .status(400)
          .json({ errors: error.details.map((err) => err.message) });
      }

      const { propertyName, phone, uan, location, images, features } = value;

      // Find the travel company
      const travelCompanyId = req.user._id; // Assuming authenticated user ID
      const travelCompany = await TravelCompany.findById(travelCompanyId);
      if (!travelCompany) {
        return res.status(404).json({ message: "Travel company not found" });
      }

      // Create the new branch object, filtering out empty optional fields
      const newBranchData = {
        name: propertyName,
        phoneNumber: phone,
        travelCompanyId,
        location,
        entityType: "company",
        paidActivation: true,
        activationRequest: "accepted",
        isNational: true,
      };

      // Add optional fields only if they are not empty
      if (uan) newBranchData.uan = uan;
      if (images && images.length > 0) newBranchData.images = images;
      if (features && features.length > 0) newBranchData.features = features;

      const newBranch = new Hotel(newBranchData);
      await newBranch.save();

      return res.status(201).json({
        message: "Branch added successfully",
        branch: newBranch,
      });
    } catch (err) {
      next(err);
    }
  },

  async editBranch(req, res, next) {
    try {
      const branchSchema = Joi.object({
        propertyName: Joi.string().allow("").messages({
          "string.base": "Property name must be a string",
        }),
        phone: Joi.string().allow("").messages({
          "string.base": "Phone number must be a string",
        }),
        uan: Joi.string().allow("", null), // Optional field
        location: Joi.object().allow(null).messages({
          "object.base": "Location must be an object",
        }),
        images: Joi.array().items(Joi.string()).allow(null, ""), // Optional field
        features: Joi.array().items(Joi.string()).allow(null, ""), // Optional field
      });

      // Validate the request body
      const { error, value } = branchSchema.validate(req.body, {
        abortEarly: false,
      });
      if (error) {
        return res
          .status(400)
          .json({ errors: error.details.map((err) => err.message) });
      }

      const { propertyName, phone, uan, location, images, features } =
        value;

      // Get branch ID from params
      const { branchId } = req.query;

      // Find existing branch
      const branch = await Hotel.findById(branchId);
      if (!branch) {
        return res.status(404).json({ message: "Branch not found" });
      }

      // Update only non-empty fields
      if (propertyName !== "") branch.name = propertyName;
      if (phone !== "") branch.phoneNumber = phone;
      if (uan !== "" && uan !== null) branch.uan = uan;
      if (location) branch.location = location;
      if (images && images.length > 0) branch.images = images;
      if (features && features.length > 0) branch.features = features; // Updating features array

      await branch.save();

      return res.status(200).json({
        message: "Branch updated successfully",
        branch,
      });
    } catch (err) {
      next(err);
    }
  },

  async getBranches(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const skip = (page - 1) * limit;

      const travelCompanyId = req.user._id;
      const requestCount = await Hotel.countDocuments({ travelCompanyId });
      const totalPages = Math.ceil(requestCount / limit);

      const branches = await Hotel.find({ travelCompanyId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;
      res.status(200).json({
        auth: true,
        branches: branches,
        totalCount: requestCount,
        totalPages,
        previousPage,
        nextPage,
      });
    } catch (error) {
      next(error);
    }
  },

  async getProperties(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const skip = (page - 1) * limit;
      const branchId = req.query.branchId;
      const propertyCount = await Property.countDocuments({
        hotelId: branchId,
      });
      const totalPages = Math.ceil(propertyCount / limit);

      const properties = await Property.find({ hotelId: branchId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;
      res.status(200).json({
        auth: true,
        properties: properties,
        totalCount: propertyCount,
        totalPages,
        previousPage,
        nextPage,
      });
    } catch (error) {
      next(error);
    }
  },

  async getProperty(req, res, next) {
    try {
      const propertyId = req.query.id;

      // Validate if ID is provided
      if (!propertyId) {
        return res.status(400).json({
          auth: false,
          message: "Property ID is required",
        });
      }

      // Fetch property by ID
      const property = await Property.findById(propertyId);

      if (!property) {
        return res.status(404).json({
          auth: false,
          message: "Property not found",
        });
      }

      res.status(200).json({
        auth: true,
        property,
      });
    } catch (error) {
      next(error);
    }
  },
  async getBranch(req, res, next) {
    try {
      const branchId = req.query.id;

      // Validate if ID is provided
      if (!branchId) {
        return res.status(400).json({
          auth: false,
          message: "branch ID is required",
        });
      }

      // Fetch branch by ID
      const branch = await Hotel.findById(branchId);

      if (!branch) {
        return res.status(404).json({
          auth: false,
          message: "Branch not found",
        });
      }

      res.status(200).json({
        auth: true,
        branch,
      });
    } catch (error) {
      next(error);
    }
  },
};
module.exports = docCompanyAuthController;
