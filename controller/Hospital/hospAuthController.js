const express = require("express");
const app = express();
const Hospital = require("../../models/Hospital/hospital.js");
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const HospDTO = require("../../dto/hospital.js");
const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");
const LabDTO = require("../../dto/lab.js");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

async function getNextVendorId() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestVendor = await Hospital.findOne({}).sort({ createdAt: -1 });
    let nextVendorId = 1;
    if (latestVendor && latestVendor.vendorId) {
      // Extract the numeric part of the orderId and increment it
      const currentVendorId = parseInt(latestVendor.vendorId.substring(3));
      nextVendorId = currentVendorId + 1;
    }

    // Generate the next orderId
    const nextOrderId = `HOS${nextVendorId.toString().padStart(4, "0")}`;
    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}

const hospAuthController = {
  async register(req, res, next) {
    const pharmRegisterSchema = Joi.object({
      logo: Joi.string().required(),
      registrationImage: Joi.string().allow(""),
      taxFileImage: Joi.string().allow(""),
      cnicImage: Joi.string().allow(""),
      name: Joi.string().required(),
      hospitalRegNo: Joi.string().optional().allow(""),
      registrationExpiry: Joi.string().optional().allow(""),
      ownerFirstName: Joi.string().required(),
      ownerLastName: Joi.string().required(),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      emergencyNo: Joi.string().required(),
      openTime: Joi.string(),
      closeTime: Joi.string(),
      location: Joi.object().required(),
      country: Joi.string().optional().allow(""),
      // website: Joi.string().allow(""),
      // twitter: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      // incomeTaxNo: Joi.string().allow(""),
      // salesTaxNo: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      // accountHolderName: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
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
      isNational: Joi.boolean().required(),
      noOfBeds: Joi.number().optional(),
      description: Joi.string().optional(),
    });

    const { error } = pharmRegisterSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const {
      logo,
      registrationImage,
      taxFileImage,
      cnicImage,
      name,
      email,
      password,
      phoneNumber,
      youtube,
      linkedIn,
      hospitalRegNo,
      registrationExpiry,
      ownerFirstName,
      ownerLastName,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      emergencyNo,
      openTime,
      closeTime,
      country,
      location,
      // website,
      // twitter,
      facebook,
      instagram,
      accountTitle,
      ntn,
      // incomeTaxNo,
      // salesTaxNo,
      bankName,
      // accountHolderName,
      accountNumber,
      fcmToken,
      isNational,
      noOfBeds,
      description,
    } = req.body;

    let accessToken;
    let refreshToken;
    let hospital;
    try {
      let isVerified = false; // Default to false

      // If email is provided, check if it exists in the database
      if (email) {
        const existingHosp = await Hospital.findOne({ email });

        if (existingHosp) {
          // Check if email already exists in the database and is verified
          if (existingHosp.isVerified) {
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
      const hospToRegister = new Hospital({
        logo,
        registrationImage,
        taxFileImage,
        cnicImage,
        vendorId,
        name,
        hospitalRegNo,
        registrationExpiry,
        ownerFirstName,
        ownerLastName,
        cnicOrPassportNo,
        cnicOrPassportExpiry,
        emergencyNo,
        openTime,
        closeTime,
        youtube,
        linkedIn,
        location,
        country,
        // website,
        // twitter,
        facebook,
        instagram,
        // incomeTaxNo,
        accountTitle,
        ntn,
        // salesTaxNo,
        bankName,
        // accountHolderName,
        accountNumber,
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
        noOfBeds,
        description,
      });

      hospital = await hospToRegister.save();

      // Generate and return tokens only if email is provided
      let accessToken = null;
      let refreshToken = null;
      if (email) {
        const userId = hospital._id;
        accessToken = JWTService.signAccessToken({ _id: userId }, "365d");
        refreshToken = JWTService.signRefreshToken({ _id: userId }, "365d");

        await JWTService.storeRefreshToken(refreshToken, userId);
        await JWTService.storeAccessToken(accessToken, userId);
      }

      // Define message based on isVerified status
      const message = isVerified
        ? "Registration successful."
        : "Registration successful. Please verify your email.";

      return res.status(201).json({
        hospital: hospital,
        message: message,
        auth: !!email, // Authentication is true only if email exists
        token: accessToken || null, // Token is returned only if email exists
      });
    } catch (err) {
      next(err); // Pass any errors to the error handler
    }
  },
  async addBranchHosp(req, res, next) {
    const pharmRegisterSchema = Joi.object({
      logo: Joi.string().required(),
      registrationImage: Joi.string().allow(""),
      taxFileImage: Joi.string().allow(""),
      cnicImage: Joi.string().allow(""),
      name: Joi.string().required(),
      hospitalRegNo: Joi.string().optional().allow(""),
      registrationExpiry: Joi.string().optional().allow(""),
      ownerFirstName: Joi.string().required(),
      ownerLastName: Joi.string().required(),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      emergencyNo: Joi.string().required(),
      openTime: Joi.string(),
      closeTime: Joi.string(),
      location: Joi.object().required(),
      country: Joi.string().optional().allow(""),
      facebook: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      fcmToken: Joi.string(),
      phoneNumber: Joi.string().optional(),
      email: Joi.string().email().optional(),
      password: Joi.string()
        .pattern(passwordPattern)
        .message("Must include 1 uppercase, 1 special character, and 1 digit.")
        .when("email", {
          is: Joi.exist(),
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
      isNational: Joi.boolean().required(),
    });

    const { error } = pharmRegisterSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const {
      logo,
      registrationImage,
      taxFileImage,
      cnicImage,
      name,
      email,
      password,
      phoneNumber,
      youtube,
      linkedIn,
      hospitalRegNo,
      registrationExpiry,
      ownerFirstName,
      ownerLastName,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      emergencyNo,
      openTime,
      closeTime,
      country,
      location,
      facebook,
      instagram,
      accountTitle,
      ntn,
      bankName,
      accountNumber,
      fcmToken,
      isNational,
    } = req.body;

    const hospitalId = req.user._id;
    const mainHosp = await Hospital.findById(hospitalId);

    try {
      let isVerified = false; // Default to false

      // If email is provided, check if it exists in the database
      if (email) {
        const existingHosp = await Hospital.findOne({ email });

        if (existingHosp) {
          if (existingHosp.isVerified) {
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

      const hospToRegister = new Hospital({
        logo,
        registrationImage,
        mainHospitalId: hospitalId,
        taxFileImage,
        cnicImage,
        vendorId,
        name,
        hospitalRegNo,
        registrationExpiry,
        ownerFirstName,
        ownerLastName,
        cnicOrPassportNo,
        cnicOrPassportExpiry,
        emergencyNo,
        openTime,
        closeTime,
        youtube,
        linkedIn,
        country,
        location,
        facebook,
        instagram,
        bankName,
        accountTitle,
        ntn,
        accountNumber,
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

      // Save the updated main hospital
      await hospToRegister.save();

      // Add the new hospital to the main hospital's subHospitalIds
      mainHosp.subHospitalIds.push(hospToRegister._id);
      await mainHosp.save(); // Save the updated main hospital document

      // Populate the `mainHospitalId` in the response to include the main hospital details
      const populatedBranch = await Hospital.findById(
        hospToRegister._id
      ).populate("mainHospitalId");

      // Define message based on isVerified status
      const message = isVerified
        ? "Registration successful."
        : "Registration successful. Please verify your email.";

      return res.status(201).json({
        hospital: populatedBranch,
        message: message,
        auth: !!email,
      });
    } catch (err) {
      next(err); // Pass any errors to the error handler
    }
  },

  async getAllBranches(req, res, next) {
    try {
      const hospitalId = req.query.hospitalId;
      const { query } = req.query;

      if (!hospitalId) {
        return res
          .status(400)
          .json({ message: "hospitalId is required in the query parameters." });
      }

      const page = parseInt(req.query.page) || 1;
      const branchPerPage = 10;

      // Build the search query
      const searchQuery = {
        mainHospitalId: hospitalId,
      };

      if (query) {
        searchQuery.$or = [
          { name: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } },
        ];
      }

      // Get total branches count with the search filter applied
      const totalBranches = await Hospital.countDocuments(searchQuery);
      const totalPages = Math.ceil(totalBranches / branchPerPage);
      const skip = (page - 1) * branchPerPage;

      // Fetch branches with the search query, pagination, and sorting
      const branches = await Hospital.find(searchQuery)
        .populate({
          path: "mainHospitalId",
          select: "name location", // Exclude the 'favourites' field from userId
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(branchPerPage)
        .lean();

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        branches: branches,
        auth: true,
        totalBranches,
        previousPage,
        totalPages,
        nextPage,
      });
    } catch (error) {
      next(error);
    }
  },
  async login(req, res, next) {
    // Validate user input
    const hospLoginSchema = Joi.object({
      email: Joi.string().required(),
      password: Joi.string().required(),
      fcmToken: Joi.string(),
    });

    const { error } = hospLoginSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const { email, password, fcmToken } = req.body;

    let hosp;

    try {
      // Match username
      const emailRegex = new RegExp(email, "i");
      hosp = await Hospital.findOne({ email: { $regex: emailRegex } });

      if (!hosp) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Check if the hospital is blocked
      if (hosp.blocked === true) {
        return res.status(403).json({
          message: "User is Deleted",
        });
      }

      // Update fcmToken if necessary
      if (fcmToken && hosp?.fcmToken !== fcmToken) {
        hosp.fcmToken = fcmToken;
        await hosp.save();
      }

      // Check if the user is verified
      if (hosp.isVerified == false) {
        return res.status(403).json({ message: "Incorrect email or password" });
      }

      // Match password
      const match = await bcrypt.compare(password, hosp.password);
      if (!match) {
        return res.status(400).json({ message: "Incorrect email or password" });
      }
    } catch (error) {
      return next(error);
    }

    // Generate tokens
    const accessToken = JWTService.signAccessToken({ _id: hosp._id }, "365d");
    const refreshToken = JWTService.signRefreshToken({ _id: hosp._id }, "365d");

    // Update refresh token in database
    try {
      await RefreshToken.updateOne(
        { userId: hosp._id },
        { token: refreshToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    // Update access token in database
    try {
      await AccessToken.updateOne(
        { userId: hosp._id },
        { token: accessToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    // Return response
    const hospDto = new HospDTO(hosp);
    return res
      .status(200)
      .json({ hospital: hospDto, auth: true, token: accessToken });
  },

  async completeSignup(req, res, next) {
    const hospRegisterSchema = Joi.object({
      phoneNumber: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().pattern(passwordPattern).required(),
      confirmPassword: Joi.ref("password"),
    });

    const { error } = hospRegisterSchema.validate(req.body);

    // 2. if error in validation -> return error via middleware
    if (error) {
      return next(error);
    }

    const { password, email, phoneNumber } = req.body;
    const emailRegex = new RegExp(email, "i");
    const emailExists = await Hospital.findOne({
      email: { $regex: emailRegex },
    });
    if (emailExists) {
      const error = new Error("Email already exists!");
      error.status = 400;
      return next(error);
    }
    const userId = req.query.id;
    const existingUser = await Hospital.findById(userId);

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
      .json({ message: "User updated successfully", hospital: existingUser });
  },

  async updateProfile(req, res, next) {
    const hospSchema = Joi.object({
      logo: Joi.string().allow(""),
      registrationImage: Joi.string().allow(""),
      taxFileImage: Joi.string().allow(""),
      cnicImage: Joi.string().allow(""),
      name: Joi.string().allow(""),
      hospitalRegNo: Joi.string().allow(""),
      registrationExpiry: Joi.string().allow(""),
      ownerFirstName: Joi.string().allow(""),
      ownerLastName: Joi.string().allow(""),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      emergencyNo: Joi.string().allow(""),
      openTime: Joi.string().allow(""),
      closeTime: Joi.string().allow(""),
      currentPassword: Joi.string().allow(""),
      password: Joi.string().allow(""),
      location: Joi.object().allow(null),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      // website: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      // twitter: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      // incomeTaxNo: Joi.string().allow(""),
      // salesTaxNo: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      // accountHolderName: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      noOfBeds: Joi.number().allow(""),
      description: Joi.string().allow(""),
    });

    const { error } = hospSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      logo,
      registrationImage,
      taxFileImage,
      cnicImage,
      name,
      hospitalRegNo,
      registrationExpiry,
      ownerFirstName,
      ownerLastName,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      emergencyNo,
      openTime,
      currentPassword,
      password,
      closeTime,
      location,
      // website,
      youtube,
      linkedIn,
      accountTitle,
      ntn,
      // twitter,
      facebook,
      instagram,
      incomeTaxNo,
      // salesTaxNo,
      // bankName,
      // accountHolderName,
      accountNumber,
      fcmToken,
      noOfBeds,
      description,
    } = req.body;
    const hospId = req.user._id;

    const hosp = await Hospital.findById(hospId);

    if (!hosp) {
      return res.status(404).json([]);
    }

    if (currentPassword && password) {
      const match = await bcrypt.compare(currentPassword, hosp.password);

      if (!match) {
        const error = {
          status: 404,
          message: "Incorrect Current Password",
        };

        return next(error);
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      hosp.password = hashedPassword;
    }

    // Update only the provided fields
    if (name) hosp.name = name;
    if (logo) hosp.logo = logo;
    if (registrationImage) hosp.registrationImage = registrationImage;
    if (taxFileImage) hosp.taxFileImage = taxFileImage;
    if (cnicImage) hosp.cnicImage = cnicImage;
    if (hospitalRegNo) hosp.hospitalRegNo = hospitalRegNo;
    if (registrationExpiry) hosp.registrationExpiry = registrationExpiry;
    if (ownerFirstName) hosp.ownerFirstName = ownerFirstName;
    if (ownerLastName) hosp.ownerLastName = ownerLastName;
    if (cnicOrPassportNo) hosp.cnicOrPassportNo = cnicOrPassportNo;
    if (cnicOrPassportExpiry) hosp.cnicOrPassportExpiry = cnicOrPassportExpiry;
    if (emergencyNo) hosp.emergencyNo = emergencyNo;
    if (openTime) hosp.openTime = openTime;
    if (closeTime) hosp.closeTime = closeTime;
    if (location) hosp.location = location;
    // if (website) hosp.website = website;
    // if (twitter) hosp.twitter = twitter;
    if (youtube) hosp.youtube = youtube;
    if (linkedIn) hosp.linkedIn = linkedIn;
    if (facebook) hosp.facebook = facebook;
    if (ntn) hosp.ntn = ntn;
    if (accountTitle) hosp.accountTitle = accountTitle;
    if (instagram) hosp.instagram = instagram;
    // if (incomeTaxNo) hosp.incomeTaxNo = incomeTaxNo;
    // if (salesTaxNo) hosp.salesTaxNo = salesTaxNo;
    // if (bankName) hosp.bankName = bankName;
    // if (accountHolderName) hosp.accountHolderName = accountHolderName;
    if (accountNumber) hosp.accountNumber = accountNumber;
    if (fcmToken) hosp.fcmToken = fcmToken;
    if (noOfBeds) hosp.noOfBeds = noOfBeds;
    if (description) hosp.description = description;

    // Save the updated test
    await hosp.save();

    return res
      .status(200)
      .json({ message: "Hospital updated successfully", hospital: hosp });
  },

  async logout(req, res, next) {
    const userId = req.user._id;
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    try {
      await RefreshToken.deleteOne({ userId });
      await AccessToken.deleteOne({ token: accessToken });
      await Hospital.findByIdAndUpdate(userId, { $unset: { fcmToken: "" } });

      res.status(200).json({ hospital: null, auth: false });
    } catch (error) {
      return next(error);
    }
  },

  async refresh(req, res, next) {
    // 1. get refreshToken from cookies
    // 2. verify refreshToken
    // 3. generate new tokens
    // 4. update db, return response

    // const originalRefreshToken = req.cookies.refreshToken;
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
      const hosp = await Hospital.findOne({ _id: id });

      const hospDto = new HospDTO(hosp);

      return res
        .status(200)
        .json({ hospital: hospDto, auth: true, accessToken: accessToken });
    } catch (e) {
      return next(e);
    }
  },
};

module.exports = hospAuthController;
