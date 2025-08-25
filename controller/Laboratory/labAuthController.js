const express = require("express");
const app = express();
const Laboratory = require("../../models/Laboratory/laboratory.js");
const mongoose = require("mongoose");
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const LabDTO = require("../../dto/lab.js");
const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");
const { sendchatNotification } = require("../../firebase/service/index.js");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

async function getNextVendorId() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestVendor = await Laboratory.findOne({}).sort({ createdAt: -1 });

    let nextVendorId = 1;
    if (latestVendor && latestVendor.vendorId) {
      // Extract the numeric part of the orderId and increment it
      const currentVendorId = parseInt(latestVendor.vendorId.substring(3));
      nextVendorId = currentVendorId + 1;
    }

    // Generate the next orderId
    const nextOrderId = `LAB${nextVendorId.toString().padStart(4, "0")}`;

    return nextOrderId;
  } catch (error) {
    console.error("Error in getNextVendorId:", error);
    throw new Error("Failed to generate order number");
  }
}

const labAuthController = {
  async register(req, res, next) {
    // 1. validate user input
    const labRegisterSchema = Joi.object({
      name: Joi.string().required(),
      labLicenseNumber: Joi.string().optional().allow(""),
      licenseExpiry: Joi.string().optional().allow(""),
      ownerFirstName: Joi.string().required(),
      ownerLastName: Joi.string().required(),
      emergencyNo: Joi.string().required(),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      description: Joi.string(),
      openTime: Joi.string(),
      closeTime: Joi.string(),
      country: Joi.string().optional().allow(""),
      location: Joi.object().required(),
      // website: Joi.string().allow(""),
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
      logo: Joi.string().required().allow(""),
      labLicenseImage: Joi.string().allow(""),
      cnicImage: Joi.string().allow(""),
      taxFileImage: Joi.string().allow(""),
      availability: Joi.boolean(),
      averageRating: Joi.number(),
      isVerified: Joi.boolean().default(false),
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
      isNational: Joi.boolean(),
    });
    module.exports = labRegisterSchema;

    const { error } = labRegisterSchema.validate(req.body);

    // 2. if error in validation -> return error via middleware
    if (error) {
      return next(error);
    }

    // 3. if email or username is already registered -> return an error
    const {
      name,
      labLicenseNumber,
      licenseExpiry,
      ownerFirstName,
      ownerLastName,
      emergencyNo,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      description,
      hospitalId,
      openTime,
      closeTime,
      country,
      location,
      website,
      twitter,
      facebook,
      linkedIn,
      youtube,
      instagram,
      incomeTaxNo,
      salesTaxNo,
      accountTitle,
      ntn,
      bankName,
      accountHolderName,
      accountNumber,
      logo,
      labLicenseImage,
      cnicImage,
      taxFileImage,
      availability,
      averageRating,
      fcmToken,
      email,
      password,
      phoneNumber,
      isNational,
    } = req.body;
    // const hospitalId = req.query.hospitalId;

    // 5. store user data in db
    let accessToken;
    let refreshToken;
    let lab;
    try {
      let isVerified = false; // Default to false

      // If email is provided, check if it exists in the database
      if (email) {
        const existingLab = await Laboratory.findOne({ email });

        if (existingLab) {
          // Check if email already exists in the database and is verified
          if (existingLab.isVerified) {
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
      const labToRegister = new Laboratory({
        name,
        vendorId,
        labLicenseNumber,
        licenseExpiry,
        ownerFirstName,
        ownerLastName,
        emergencyNo,
        cnicOrPassportNo,
        cnicOrPassportExpiry,
        description,
        openTime,
        closeTime,
        country,
        location,
        website,
        linkedIn,
        youtube,
        twitter,
        facebook,
        instagram,
        incomeTaxNo,
        salesTaxNo,
        bankName,
        accountHolderName,
        accountNumber,
        accountTitle,
        ntn,
        logo,
        labLicenseImage,
        cnicImage,
        taxFileImage,
        availability,
        averageRating,
        fcmToken,
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

      lab = await labToRegister.save();
      if (hospitalId) {
        lab.hospitalIds.push(hospitalId);
        // Set additional properties related to hospitalId
        lab.paidActivation = true; // Set paidActivation to true if hospitalId exists
        lab.activationRequest = "accepted"; // Set activationRequestAccepted to true if hospitalId exists
      }
      lab = await labToRegister.save();

      // Generate and return tokens only if email is provided
      let accessToken = null;
      let refreshToken = null;
      if (email) {
        const userId = lab._id;
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
        laboratory: lab,
        message: message,
        auth: !!email, // Authentication is true only if email exists
        token: accessToken || null, // Token is returned only if email exists
      });
    } catch (err) {
      next(err); // Pass any errors to the error handler
    }
  },

  async login(req, res, next) {
    const labLoginSchema = Joi.object({
      email: Joi.string().required(),
      password: Joi.string(),
      fcmToken: Joi.string().allow(""),
    });

    const { error } = labLoginSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const { email, password, fcmToken } = req.body;

    let lab;

    try {
      // Match username
      const emailRegex = new RegExp(email, "i");
      lab = await Laboratory.findOne({ email: { $regex: emailRegex } });
      if (!lab) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Check if the lab is blocked
      if (lab.blocked === true) {
        return res.status(403).json({
          message: "User is Deleted",
        });
      }

      // Update fcmToken if necessary
      if (fcmToken && fcmToken !== "" && lab?.fcmToken !== fcmToken) {
        lab.fcmToken = fcmToken;
        await lab.save();
      }

      // Check if the user is verified
      if (lab.isVerified == false) {
        return res.status(403).json({ message: "User not verified" });
      }

      // Match password
      const match = await bcrypt.compare(password, lab.password);
      if (!match) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }
    } catch (error) {
      return next(error);
    }

    // Generate tokens
    const accessToken = JWTService.signAccessToken({ _id: lab._id }, "365d");
    const refreshToken = JWTService.signRefreshToken({ _id: lab._id }, "365d");

    // Update refresh token in database
    try {
      await RefreshToken.updateOne(
        { userId: lab._id },
        { token: refreshToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    // Update access token in database
    try {
      await AccessToken.updateOne(
        { userId: lab._id },
        { token: accessToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    // Return response
    const labDto = new LabDTO(lab);
    return res
      .status(200)
      .json({ lab: labDto, auth: true, token: accessToken });
  },

  async completeSignup(req, res, next) {
    const labRegisterSchema = Joi.object({
      phoneNumber: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().pattern(passwordPattern).required(),
      confirmPassword: Joi.ref("password"),
    });

    const { error } = labRegisterSchema.validate(req.body);

    // 2. if error in validation -> return error via middleware
    if (error) {
      return next(error);
    }

    const { password, email, phoneNumber } = req.body;
    const emailRegex = new RegExp(email, "i");
    const emailExists = await Laboratory.findOne({
      email: { $regex: emailRegex },
    });
    if (emailExists) {
      const error = new Error("Email already exists!");
      error.status = 400;
      return next(error);
    }

    const userId = req.query.id;
    const existingUser = await Laboratory.findById(userId);

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
      .json({ message: "User updated successfully", lab: existingUser });
  },

  async updateProfile(req, res, next) {
    const labSchema = Joi.object({
      name: Joi.string().allow(""),
      labLicenseNumber: Joi.string().allow(""),
      licenseExpiry: Joi.string().allow(""),
      ownerFirstName: Joi.string().allow(""),
      ownerLastName: Joi.string().allow(""),
      emergencyNo: Joi.string().allow(""),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      description: Joi.string().allow(""),
      currentPassword: Joi.string().allow(""),
      password: Joi.string().pattern(passwordPattern).allow(""),
      openTime: Joi.string().allow(""),
      closeTime: Joi.string().allow(""),
      location: Joi.object().allow(null),
      // website: Joi.string().allow(""),
      // twitter: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      // incomeTaxNo: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      // salesTaxNo: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      // accountHolderName: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      logo: Joi.string().allow(""),
      labLicenseImage: Joi.string().allow(""),
      cnicImage: Joi.string().allow(""),
      taxFileImage: Joi.string().allow(""),
      availability: Joi.boolean().allow(null),
      averageRating: Joi.number(),
      isVerified: Joi.boolean(),
      fcmToken: Joi.string(),
    });

    const { error } = labSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      name,
      labLicenseNumber,
      licenseExpiry,
      ownerFirstName,
      ownerLastName,
      emergencyNo,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      description,
      currentPassword,
      password,
      openTime,
      closeTime,
      location,
      // website,
      // twitter,
      linkedIn,
      youtube,
      facebook,
      instagram,
      // incomeTaxNo,
      // salesTaxNo,
      bankName,
      // accountHolderName,
      accountNumber,
      logo,
      labLicenseImage,
      cnicImage,
      accountTitle,
      ntn,
      taxFileImage,
      availability,
      averageRating,
      fcmToken,
    } = req.body;
    const labId = req.user._id;

    const lab = await Laboratory.findById(labId);

    if (!lab) {
      return res.status(404).json([]);
    }

    if (currentPassword && password) {
      const match = await bcrypt.compare(currentPassword, lab.password);

      if (!match) {
        const error = {
          status: 401,
          message: "Incorrect Current Password",
        };

        return next(error);
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      lab.password = hashedPassword;
    }

    // Update only the provided fields
    if (name) lab.name = name;
    if (labLicenseNumber) lab.labLicenseNumber = labLicenseNumber;
    if (licenseExpiry) lab.licenseExpiry = licenseExpiry;
    if (ownerFirstName) lab.ownerFirstName = ownerFirstName;
    if (ownerLastName) lab.ownerLastName = ownerLastName;
    if (emergencyNo) lab.emergencyNo = emergencyNo;
    if (cnicOrPassportNo) lab.cnicOrPassportNo = cnicOrPassportNo;
    if (cnicOrPassportExpiry) lab.cnicOrPassportExpiry = cnicOrPassportExpiry;
    if (description) lab.description = description;
    if (openTime) lab.openTime = openTime;
    if (closeTime) lab.closeTime = closeTime;
    if (location) lab.location = location;
    if (ntn) lab.ntn = ntn;
    if (accountTitle) lab.accountTitle = accountTitle;
    // if (website) lab.website = website;
    // if (twitter) lab.twitter = twitter;
    if (facebook) lab.facebook = facebook;
    if (instagram) lab.instagram = instagram;
    if (youtube) lab.youtube = youtube;
    if (linkedIn) lab.linkedIn = linkedIn;
    // if (incomeTaxNo) lab.incomeTaxNo = incomeTaxNo;
    // if (salesTaxNo) lab.salesTaxNo = salesTaxNo;
    if (bankName) lab.bankName = bankName;
    // if (accountHolderName) lab.accountHolderName = accountHolderName;
    if (accountNumber) lab.accountNumber = accountNumber;
    if (logo) lab.logo = logo;
    if (labLicenseImage) lab.labLicenseImage = labLicenseImage;
    if (cnicImage) lab.cnicImage = cnicImage;
    if (taxFileImage) lab.taxFileImage = taxFileImage;
    if (availability) lab.availability = availability;
    if (averageRating) lab.averageRating = averageRating;
    if (fcmToken) lab.fcmToken = fcmToken;

    // Save the updated test
    await lab.save();

    return res
      .status(200)
      .json({ message: "Laboratory updated successfully", lab: lab });
  },

  async logout(req, res, next) {
    const userId = req.user._id;
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    try {
      await RefreshToken.deleteOne({ userId });
      await AccessToken.deleteOne({ token: accessToken });
      await Laboratory.findByIdAndUpdate(userId, { $unset: { fcmToken: "" } });

      res.status(200).json({ laboratory: null, auth: false });
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

      // res.cookie("accessToken", accessToken, {
      //   maxAge: 1000 * 60 * 60 * 24,
      //   httpOnly: true,
      // });

      // res.cookie("refreshToken", refreshToken, {
      //   maxAge: 1000 * 60 * 60 * 24,
      //   httpOnly: true,
      // });
      const lab = await Laboratory.findOne({ _id: id });

      const labDto = new LabDTO(lab);

      return res
        .status(200)
        .json({ lab: labDto, auth: true, accessToken: accessToken });
    } catch (e) {
      return next(e);
    }
  },

  async addBranch(req, res, next) {
    try {
      const labRegisterSchema = Joi.object({
        mainLabId: Joi.string().required(),
        branchCode: Joi.string().empty("").required().messages({
          "any.required": "branchCode is required",
          "string.empty": "branchCode cannot be empty",
        }),
        phone: Joi.string().empty("").required().messages({
          "any.required": "phone is required",
          "string.empty": "phone cannot be empty",
        }),
        country: Joi.string().empty("").required().messages({
          "any.required": "country is required",
          "string.empty": "country cannot be empty",
        }),
        location: Joi.object().required(),
      });

      const { error } = labRegisterSchema.validate(req.body);
      if (error) {
        return next(error);
      }
      const { mainLabId, branchCode, location, phone, country } = req.body;

      // Check if the main lab exists
      const mainLab = await Laboratory.findById(mainLabId);
      if (!mainLab) {
        return res.status(404).json({ error: "Main Lab not found" });
      }
      const isNational = mainLab.isNational;

      // Create new branch lab
      const newBranch = new Laboratory({
        branchCode,
        location,
        phoneNumber: phone,
        country,
        mainLab: mainLabId,
        isNational,
        paidActivation: true,
        activationRequest: "accepted",
      });

      await newBranch.save();

      // Add branch ID to main lab's subLabs array
      mainLab.subLabs.push(newBranch._id);
      await mainLab.save();

      res
        .status(201)
        .json({ message: "Branch Lab added successfully", newBranch });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateBranch(req, res, next) {
    try {
      const updateBranchSchema = Joi.object({
        branchId: Joi.string().required().messages({
          "any.required": "branchId is required",
        }),
        branchCode: Joi.string().empty(""),
        phone: Joi.string().empty(""),
        country: Joi.string().empty(""),
        location: Joi.object(), // location is optional
      });

      const { error } = updateBranchSchema.validate(req.body);
      if (error) {
        return next(error);
      }

      const { branchId, branchCode, phone, country, location } = req.body;

      // Find branch lab
      const branchLab = await Laboratory.findById(branchId);
      if (!branchLab) {
        return res.status(404).json({ error: "Branch Lab not found" });
      }

      // Update fields only if provided
      if (branchCode !== undefined) branchLab.branchCode = branchCode;
      if (phone !== undefined) branchLab.phoneNumber = phone;
      if (country !== undefined) branchLab.country = country;
      if (location !== undefined) branchLab.location = location;

      await branchLab.save();

      res
        .status(200)
        .json({ message: "Branch Lab updated successfully", branchLab });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async deleteBranch(req, res, next) {
    try {
      const branchId = req.query.branchId;

      // Find the branch lab
      const branchLab = await Laboratory.findById(branchId);
      if (!branchLab) {
        return res.status(404).json({ error: "Branch Lab not found" });
      }

      // Ensure it's actually a branch, not a main lab
      if (!branchLab.mainLab) {
        return res.status(400).json({ error: "This lab is not a branch" });
      }

      // Remove branch from main lab's subLabs
      await Laboratory.findByIdAndUpdate(branchLab.mainLab, {
        $pull: { subLabs: branchLab._id },
      });

      // Delete the branch lab
      await Laboratory.findByIdAndDelete(branchId);

      res.status(200).json({ message: "Branch Lab deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getBranches(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const labsPerPage = 10;
      const mainLab = req.query.mainLab;
      const city = req.query.city;

      if (!mainLab) {
        return res.status(400).json({
          auth: false,
          message: "mainLab Id is not given!",
        });
      }

      // Build dynamic filter
      const filter = { mainLab };
      if (city && city.trim() !== "") {
        filter["location.city"] = city;
      }

      const labCount = await Laboratory.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(labCount / labsPerPage));

      if (page > totalPages) {
        return res.status(200).json({
          auth: true,
          labBranches: [],
          previousPage: totalPages > 1 ? totalPages - 1 : null,
          nextPage: null,
          totalPages,
          totalCount: labCount,
        });
      }

      const skip = (page - 1) * labsPerPage;

      const labs = await Laboratory.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(labsPerPage);

      return res.status(200).json({
        auth: true,
        labBranches: labs,
        previousPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
        totalPages,
        totalCount: labCount,
      });
    } catch (error) {
      next(error);
    }
  },

  async getCities(req, res, next) {
    try {
      const mainLabId = req.user._id;

      const cities = await Laboratory.aggregate([
        {
          $match: {
            mainLab: mongoose.Types.ObjectId(mainLabId),
            "location.city": { $ne: [null, ""] },
          },
        },
        {
          $group: {
            _id: "$location.city",
          },
        },
        {
          $project: {
            _id: 0,
            city: "$_id",
          },
        },
      ]);

      return res.status(200).json({
        success: true,
        cities: cities.map((c) => c.city),
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = labAuthController;
