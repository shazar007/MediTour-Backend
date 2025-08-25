const express = require("express");
const mongoose = require("mongoose");
const app = express();
const Doctor = require("../../models/Doctor/doctors.js");
const { sendchatNotification } = require("../../firebase/service/index.js");
const Notification = require("../../models/notification.js");
const Hospital = require("../../models/Hospital/hospital.js");
const DoctorCompany = require("../../models/DoctorCompany/docCompany.js");
const Joi = require("joi");
const bcrypt = require("bcryptjs");
const doctorDto = require("../../dto/doctor.js");
const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");
const VerificationCode = require("../../models/verificationCode.js");
const Department = require("../../models/Hospital/department.js");
const { sendAccountCreationEmail } = require("../../controller/email.js");
// const Department = require("../../models/Hospital/department.js");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

async function getNextVendorId() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    console.log("getNextVendorId");
    const latestVendor = await Doctor.findOne({}).sort({ createdAt: -1 });
    console.log("getNextVendorId");

    let nextVendorId = 1;
    if (latestVendor && latestVendor.vendorId) {
      // Extract the numeric part of the orderId and increment it
      console.log("getNextVendorId");
      const currentVendorId = parseInt(latestVendor.vendorId.substring(3));
      nextVendorId = currentVendorId + 1;
    }
    console.log("getNextVendorId");
    // Generate the next orderId
    const nextOrderId = `DOC${nextVendorId.toString().padStart(4, "0")}`;
    console.log("getNextVendorId");

    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}

function calculateProfilePercentage(doctor) {
  const totalFields = 23; // Number of fields in the profile

  let filledFields = 0;

  // List of fields to check
  const fieldsToCheck = [
    "email",
    "password",
    "phoneNumber",
    "name",
    "cnicOrPassportNo",
    "cnicOrPassportExpiry",
    "qualifications",
    "speciality",
    "clinicExperience",
    "pmdcNumber",
    "pmdcExpiry",
    "location",
    "incomeTaxNo",
    "salesTaxNo",
    "bankName",
    "accountHolderName",
    "accountNumber",
    "doctorImage",
    "cnicImage",
    "pmdcImage",
    "taxFileImage",
    "about",
    "doctorType",
  ];

  // Count filled fields
  fieldsToCheck.forEach((field) => {
    if (doctor[field] && doctor[field].toString().trim() !== "") {
      filledFields++;
    }
  });

  // Calculate the percentage
  return (filledFields / totalFields) * 100;
}

const docAuthController = {
  async register(req, res, next) {
    // Joi Schema for validation
    const docRegisterSchema = Joi.object({
      doctorKind: Joi.string().required(),
      name: Joi.string().required(),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      qualifications: Joi.string().required(),
      awardsAndAchievements: Joi.array().allow(""),
      gender: Joi.string().allow(""),
      speciality: Joi.when("doctorKind", {
        is: "paramedic",
        then: Joi.array().optional(),
        otherwise: Joi.array().required(),
      }),
      clinicName: Joi.when("doctorKind", {
        is: "paramedic",
        then: Joi.string().optional(),
        otherwise: Joi.string().optional(),
      }),
      clinicExperience: Joi.when("doctorKind", {
        is: "paramedic",
        then: Joi.number().optional(),
        otherwise: Joi.number().required(),
      }),
      pmdcNumber: Joi.string().allow(""),
      pmdcExpiry: Joi.string().allow(""),
      location: Joi.object().allow(""),
      country: Joi.string().required(),
      website: Joi.string().allow(""),
      twitter: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      incomeTaxNo: Joi.string().allow(""),
      salesTaxNo: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      accountHolderName: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      cnicImage: Joi.string().allow(""),
      pmdcImage: Joi.string().allow(""),
      taxFileImage: Joi.string().allow(""),
      doctorType: Joi.string(),
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
      departmentId: Joi.string().optional(),
      docCompanyId: Joi.string().optional(),
      entityType: Joi.when("doctorKind", {
        is: "paramedic",
        then: Joi.string().optional().default("individual"), // Set default to "individual" for paramedics
        otherwise: Joi.string().required(),
      }),
      isNational: Joi.when("doctorKind", {
        is: "paramedic",
        then: Joi.boolean().forbidden(),
        otherwise: Joi.boolean().required(),
      }),
    });

    // Validate the request body against the schema
    const { error } = docRegisterSchema.validate(req.body);

    if (error) {
      return next(error); // Handle validation errors
    }

    // Destructure fields from request body
    const {
      doctorKind,
      name,
      email,
      password,
      phoneNumber,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      qualifications,
      awardsAndAchievements,
      speciality,
      clinicName,
      youtube,
      linkedIn,
      clinicExperience,
      pmdcNumber,
      gender,
      pmdcExpiry,
      location,
      country,
      website,
      twitter,
      facebook,
      instagram,
      incomeTaxNo,
      salesTaxNo,
      bankName,
      accountHolderName,
      accountTitle,
      ntn,
      accountNumber,
      cnicImage,
      pmdcImage,
      taxFileImage,
      doctorType,
      fcmToken,
      entityType,
      isNational,
    } = req.body;
    const hospitalId = req.body.hospitalId;
    const departmentId = req.body.departmentId;
    const docCompanyId = req.body.docCompanyId;
    const hospitalName = await Hospital.findById(hospitalId).select("name");
    console.log("hospitalName", hospitalName);

    try {
      let isVerified = false; // Default to false

      // If email is provided, check if it exists in the database
      if (email) {
        const existingDoctor = await Doctor.findOne({ email, doctorKind });

        if (existingDoctor) {
          // Check if email already exists in the database and is verified
          if (existingDoctor.isVerified) {
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

      // Step 1: Create the doctor record with isVerified set to false by default
      const newDoctor = new Doctor({
        doctorKind,
        name,
        cnicOrPassportNo,
        cnicOrPassportExpiry,
        qualifications,
        awardsAndAchievements,
        speciality,
        vendorId,
        gender,
        clinicExperience,
        pmdcNumber,
        pmdcExpiry,
        location,
        country,
        clinicName,
        youtube,
        accountTitle,
        ntn,
        linkedIn,
        website,
        twitter,
        facebook,
        instagram,
        incomeTaxNo,
        salesTaxNo,
        bankName,
        accountHolderName,
        accountNumber,
        cnicImage,
        pmdcImage,
        taxFileImage,
        doctorType,
        email, // Optional field
        password: hashedPassword, // Optional field
        phoneNumber, // Optional field
        fcmToken,
        departmentId,
        isVerified, // Default value is false
        entityType: doctorKind === "paramedic" ? "individual" : entityType, // Set entityType to "individual" for paramedics
        ...((isNational || doctorKind == "paramedic") && {
          activationRequest: "accepted",
          paidActivation: true,
        }),
        isNational: isNational,
      });
      newDoctor.profilePercentage = calculateProfilePercentage(newDoctor);

      await newDoctor.save();
      if (hospitalId && departmentId) {
        newDoctor.hospitalIds.push({
          hospitalId: hospitalId,
          departmentId: departmentId,
        });
        newDoctor.paidActivation = true;
        newDoctor.activationRequest = "accepted";
      } else if (docCompanyId) {
        newDoctor.docCompanyId = docCompanyId;
        newDoctor.entityType = "company";
        newDoctor.paidActivation = true;
        newDoctor.activationRequest = "accepted";
      } else if (doctorKind == "paramedic") {
        newDoctor.paidActivation = true;
        newDoctor.activationRequest = "accepted";
      }
      await newDoctor.save();
      if (hospitalId && departmentId) {
        sendAccountCreationEmail(
          newDoctor,
          "Doctor",
          hospitalName,
          newDoctor.email,
          password
        );
      }
      // Update the Department model with the doctor's ID
      await Department.findByIdAndUpdate(departmentId, {
        $push: { doctorIds: newDoctor._id },
      });
      // await department.save(); // Save the updated main hospital document

      // Generate and return tokens only if email is provided
      let accessToken = null;
      let refreshToken = null;
      if (email) {
        const userId = newDoctor._id;
        accessToken = JWTService.signAccessToken({ _id: userId }, "365d");
        refreshToken = JWTService.signRefreshToken({ _id: userId }, "365d");

        await JWTService.storeRefreshToken(refreshToken, userId);
        await JWTService.storeAccessToken(accessToken, userId);
      }

      // Define message based on isVerified status
      const message = isVerified
        ? "Registration successful."
        : "Registration successful. Please verify your email.";

      // Return the response
      return res.status(201).json({
        message: message,
        doctor: newDoctor,
        auth: !!email, // Authentication is true only if email exists
        token: accessToken || null, // Token is returned only if email exists
      });
    } catch (err) {
      next(err); // Pass any errors to the error handler
    }
  },

  async login(req, res, next) {
    // Validate user input
    const docLoginSchema = Joi.object({
      email: Joi.string().required(),
      doctorKind: Joi.string().required(),
      password: Joi.string().required(),
      fcmToken: Joi.string().allow(""),
    });

    const { error } = docLoginSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const { email, password, doctorKind, fcmToken } = req.body;

    let doc;

    try {
      // Match username using a case-insensitive regex
      const emailRegex = new RegExp(email, "i");
      doc = await Doctor.findOne({ email: { $regex: emailRegex }, doctorKind });

      if (!doc) {
        console.log("anything1");
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Check if the doctorKind matches
      console.log(doc.doctorKind);
      console.log(doctorKind);
      if (doc.doctorKind !== doctorKind) {
        console.log("anything2");
        return res.status(400).json({ message: "Incorrect email or password" });
      }

      // Check if the doctor is blocked
      if (doc.blocked === true) {
        return res.status(403).json({
          message: "User is Deleted",
        });
      }

      // Update fcmToken if necessary
      if (fcmToken && doc.fcmToken !== fcmToken) {
        doc.fcmToken = fcmToken;
        await doc.save();
      }

      // Check if the user is verified
      if (!doc.isVerified) {
        return res.status(403).json({ message: "User not verified" });
      }

      // Match password
      const match = await bcrypt.compare(password, doc.password);
      if (!match) {
        console.log("anything3");
        return res.status(400).json({ message: "Incorrect email or password" });
      }
    } catch (error) {
      return next(error);
    }

    // Generate tokens
    const accessToken = JWTService.signAccessToken({ _id: doc._id }, "365d");
    const refreshToken = JWTService.signRefreshToken({ _id: doc._id }, "365d");

    // Update refresh token in database
    try {
      await RefreshToken.updateOne(
        { userId: doc._id },
        { token: refreshToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    // Update access token in database
    try {
      await AccessToken.updateOne(
        { userId: doc._id },
        { token: accessToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    // Return response
    const docDto = new doctorDto(doc);
    return res
      .status(200)
      .json({ doctor: docDto, auth: true, token: accessToken });
  },

  async completeSignup(req, res, next) {
    const docRegisterSchema = Joi.object({
      phoneNumber: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().pattern(passwordPattern).required(),
      confirmPassword: Joi.ref("password"),
    });

    const { error } = docRegisterSchema.validate(req.body);

    // If there's an error in validation, return the error via middleware
    if (error) {
      return next(error);
    }

    const { password, email, phoneNumber } = req.body;
    const emailRegex = new RegExp(email, "i");
    const emailExists = await Doctor.findOne({ email: { $regex: emailRegex } });
    if (emailExists) {
      const error = new Error("Email already exists!");
      error.status = 400;
      return next(error);
    }

    let userId = req.query.id.trim(); // Trim the userId to remove any leading/trailing spaces

    // Validate the userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      const error = new Error("Invalid user ID format!");
      error.status = 400;
      return next(error);
    }

    const existingUser = await Doctor.findById(userId);

    if (!existingUser) {
      return res.status(404).json([]);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Update only the provided fields
    existingUser.email = email;
    existingUser.password = hashedPassword;
    existingUser.phoneNumber = phoneNumber;
    existingUser.isVerified = true;

    // Save the updated user
    existingUser.profilePercentage = calculateProfilePercentage(existingUser);

    await existingUser.save();

    return res
      .status(200)
      .json({ message: "User updated successfully", doctor: existingUser });
  },

  async updateProfile(req, res, next) {
    const docSchema = Joi.object({
      name: Joi.string().allow(""),
      cnicOrPassportNo: Joi.string().allow(""),
      cnicOrPassportExpiry: Joi.string().allow(""),
      qualifications: Joi.string().allow(""),
      awardsAndAchievements: Joi.array().allow(""),
      speciality: Joi.array().allow(null),
      clinicName: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      linkedIn: Joi.string().allow(""),
      clinicExperience: Joi.number().allow(""),
      experience: Joi.array().optional(),
      pmdcNumber: Joi.string().allow(""),
      currentPassword: Joi.string().allow(""),
      password: Joi.string().allow(""),
      pmdcExpiry: Joi.string().allow(""),
      location: Joi.object().allow(null),
      website: Joi.string().allow(""),
      twitter: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      incomeTaxNo: Joi.string().allow(""),
      salesTaxNo: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      accountTitle: Joi.string().allow(""),
      ntn: Joi.string().allow(""),
      accountHolderName: Joi.string().allow(""),
      gender: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      doctorImage: Joi.string().allow(""),
      cnicImage: Joi.string().allow(""),
      pmdcImage: Joi.string().allow(""),
      about: Joi.string().allow(""),
      taxFileImage: Joi.string().allow(""),
    });

    const { error } = docSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      name,
      cnicOrPassportNo,
      cnicOrPassportExpiry,
      qualifications,
      awardsAndAchievements,
      speciality,
      gender,
      clinicName,
      clinicExperience,
      experience,
      pmdcNumber,
      currentPassword,
      password,
      pmdcExpiry,
      location,
      website,
      twitter,
      facebook,
      instagram,
      linkedIn,
      youtube,
      incomeTaxNo,
      salesTaxNo,
      bankName,
      accountTitle,
      ntn,
      accountHolderName,
      accountNumber,
      doctorImage,
      cnicImage,
      pmdcImage,
      about,
      taxFileImage,
    } = req.body;
    const docId = req.user._id;

    const doc = await Doctor.findById(docId);

    if (!doc) {
      return res.status(404).json([]);
    }
    if (currentPassword && password) {
      const match = await bcrypt.compare(currentPassword, doc.password);

      if (!match) {
        const error = {
          status: 401,
          message: "Incorrect Current Password",
        };

        return next(error);
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      doc.password = hashedPassword;
    }

    // Update only the provided fields
    if (name) doc.name = name;
    if (cnicOrPassportNo) doc.cnicOrPassportNo = cnicOrPassportNo;
    if (cnicOrPassportExpiry) doc.cnicOrPassportExpiry = cnicOrPassportExpiry;
    if (qualifications) doc.qualifications = qualifications;
    if (awardsAndAchievements)
      doc.awardsAndAchievements = awardsAndAchievements;
    if (speciality) doc.speciality = speciality;
    if (clinicName) doc.clinicName = clinicName;
    if (clinicExperience) doc.clinicExperience = clinicExperience;
    if (experience) doc.experience = experience;
    if (pmdcNumber) doc.pmdcNumber = pmdcNumber;
    if (pmdcExpiry) doc.pmdcExpiry = pmdcExpiry; //..bbbb//
    if (location) doc.location = location;
    if (website) doc.website = website;
    if (facebook) doc.facebook = facebook;
    if (youtube) doc.youtube = youtube;
    if (linkedIn) doc.linkedIn = linkedIn;
    if (twitter) doc.twitter = twitter;
    if (instagram) doc.instagram = instagram;
    if (incomeTaxNo) doc.incomeTaxNo = incomeTaxNo;
    if (salesTaxNo) doc.salesTaxNo = salesTaxNo;
    if (bankName) doc.bankName = bankName;
    if (ntn) doc.ntn = ntn;
    if (accountTitle) doc.accountTitle = accountTitle;
    if (accountHolderName) doc.accountHolderName = accountHolderName;
    if (accountNumber) doc.accountNumber = accountNumber;
    if (doctorImage) doc.doctorImage = doctorImage;
    if (cnicImage) doc.cnicImage = cnicImage;
    if (pmdcImage) doc.pmdcImage = pmdcImage;
    if (taxFileImage) doc.taxFileImage = taxFileImage;
    if (gender) doc.gender = gender;
    if (about) doc.about = about;

    // Save the updated test
    doc.profilePercentage = calculateProfilePercentage(doc);

    await doc.save();

    return res
      .status(200)
      .json({ message: "Doctor updated successfully", doctor: doc });
  },

  async logout(req, res, next) {
    const userId = req.user._id;
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    try {
      await RefreshToken.deleteOne({ userId });
      await AccessToken.deleteOne({ token: accessToken });
      await Doctor.findByIdAndUpdate(userId, { $unset: { fcmToken: "" } });

      res.status(200).json({ doctor: null, auth: false });
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

      const doc = await Doctor.findOne({ _id: id });

      const doctorDTO = new doctorDto(doc);

      return res
        .status(200)
        .json({ doctor: doctorDTO, auth: true, accessToken: accessToken });
    } catch (e) {
      return next(e);
    }
  },

  async acceptInvitation(req, res, next) {
    try {
      const { email, type, code, hospitalId, departmentId, docCompanyId } =
        req.body;

      // Find the verification code
      const verificationCode = await VerificationCode.findOne({ code });
      if (!verificationCode) {
        return res
          .status(400)
          .json({ message: "Invalid verification code. Please try again." });
      }

      // Verify the email and type match the user's details
      if (
        email !== verificationCode.email ||
        type !== verificationCode.doctorKind
      ) {
        return res
          .status(400)
          .json({ message: "User details do not match the verification." });
      }

      // Find the doctor by email and type
      const doctor = await Doctor.findOne({ email, doctorKind: type });
      if (!doctor) {
        return res.status(404).json({ message: "Doctor not found!" });
      }

      // Handle Hospital and Department association
      if (hospitalId && departmentId) {
        const department = await Department.findById(departmentId);
        if (!department) {
          return res.status(404).json({ message: "Department not found!" });
        }

        // Check if hospital and department are already associated with the doctor
        const existingAssociation = doctor.hospitalIds.some(
          (association) =>
            association.hospitalId.toString() === hospitalId &&
            association.departmentId.toString() === departmentId
        );
        if (existingAssociation) {
          return res.status(200).json({
            status: true,
            message: "Hospital is already associated with the doctor.",
          });
        }

        // Associate the doctor with the hospital and department
        doctor.hospitalIds.push({ hospitalId, departmentId });
        department.doctorIds.push(doctor._id);
        await department.save();
      }
      // Handle Doctor Company ID
      if (docCompanyId) {
        if (doctor.docCompanyId && doctor.docCompanyId === docCompanyId) {
          return res.status(200).json({
            status: true,
            message: "This doctor company is already associated with the user.",
          });
        }

        doctor.docCompanyId = docCompanyId;
        const docCompany = await DoctorCompany.findById(docCompanyId);
        if (!docCompany) {
          return res.status(404).json({ message: "Doctor company not found!" });
        }

        if (!docCompany.doctorIds.includes(doctor._id)) {
          docCompany.doctorIds.push(doctor._id);
          await docCompany.save();
        }
      }

      // Save the doctor document
      await doctor.save();
      const hospital= await Hospital.findById(hospitalId)
      // Notify doctor about the appointment
      sendchatNotification(
        hospitalId,
        {
          title: "MediTour Global",
          message: `Your request to join ${hospital.name} has been approved by ${doctor.name}!`,
        },
        "Hospital"
      );

      const notification = new Notification({
        senderId:doctor._id,
        senderModelType: "Doctor",
        receiverId: hospitalId,
        receiverModelType: "Hospital",
        title: "MediTour Global",
        message: `Your request to join ${hospital.name} has been approved by ${doctor.name}!`,
      });
      await notification.save();

      // Final response
      await VerificationCode.deleteMany({ email });
      return res.status(200).json({
        status: true,
        message:
          "Your account has been successfully verified and associations updated.",
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = docAuthController;
