const express = require("express");
const app = express();
const VerificationCode = require("../models/verificationCode");
const nodemailer = require("nodemailer");
const Laboratory = require("../models/Laboratory/laboratory");
const Pharmacy = require("../models/Pharmacy/pharmacy");
const Pharmaceutical = require("../models/Pharmaceutical/pharmaceutical");
const Doctor = require("../models/Doctor/doctors");
const Hospital = require("../models/Hospital/hospital");
const AmbulanceCompany = require("../models/Ambulance/ambulanceCompany");
const Agency = require("../models/Travel Agency/travelAgency");
const RentCar = require("../models/Rent A Car/rentCar");
const Donation = require("../models/Donation/donationCompany");
const Hotel = require("../models/Hotel/hotel");
const Insurance = require("../models/Insurance/insurance");
const TravelCompany = require("../models/Travel Company/travelCompany");
const DoctorCompany = require("../models/DoctorCompany/docCompany");
const User = require("../models/User/user");
const ResetToken = require("../models/resetToken");
const validator = require("validator");
const EmailValidator = require("email-validator");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
app.use(express.json());
const Joi = require("joi");
const { v4: uuidv4 } = require("uuid");
const tokens = {};
const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;
const transporter = require("../utils/gmail");

const userTypeFunction = async function (userModel, email, newPassword) {
  let user;
  if (userModel === "Laboratory") {
    user = await Laboratory.find({ email });
  } else if (userModel === "Pharmacy") {
    user = await Pharmacy.find({ email });
  } else if (userModel === "Pharmaceutical") {
    user = await Pharmaceutical.find({ email });
  } else if (userModel === "DocCompany") {
    user = await DoctorCompany.find({ email });
  } else if (userModel === "Doctor") {
    user = await Doctor.find({ email });
  } else if (userModel === "Hospital") {
    user = await Hospital.find({ email });
  } else if (userModel === "Ambulance") {
    user = await AmbulanceCompany.find({ email });
  } else if (userModel === "Agency") {
    user = await Agency.find({ email });
  } else if (userModel === "RentCar") {
    user = await RentCar.find({ email });
  } else if (userModel === "Donation") {
    user = await Donation.find({ email });
  } else if (userModel === "Hotel") {
    user = await Hotel.find({ email });
  } else if (userModel === "Insurance") {
    user = await Insurance.find({ email });
  } else if (userModel === "User") {
    user = await User.find({ email });
  } else if (userModel === "TravComp") {
    user = await TravelCompany.find({ email });
  }
  if (!user) {
    return res
      .status(404)
      .json({ status: "Failure", message: "User not found" });
  }

  // Delete the token from the tokens object after it's used
  const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  if (userModel === "Laboratory") {
    await Laboratory.updateOne(
      { email: email },
      { password: hashedNewPassword },
      { runValidators: true }
    );
  } else if (userModel === "Pharmacy") {
    await Pharmacy.updateOne(
      { email: email },
      { password: hashedNewPassword },
      { runValidators: true }
    );
  } else if (userModel === "Pharmaceutical") {
    await Pharmaceutical.updateOne(
      { email: email },
      { password: hashedNewPassword },
      { runValidators: true }
    );
  } else if (userModel === "DocCompany") {
    await DoctorCompany.updateOne(
      { email: email },
      { password: hashedNewPassword },
      { runValidators: true }
    );
  } else if (userModel === "Doctor") {
    await Doctor.updateOne(
      { email: email },
      { password: hashedNewPassword },
      { runValidators: true }
    );
  } else if (userModel === "Hospital") {
    await Hospital.updateOne(
      { email: email },
      { password: hashedNewPassword },
      { runValidators: true }
    );
  } else if (userModel === "Ambulance") {
    await AmbulanceCompany.updateOne(
      { email: email },
      { password: hashedNewPassword },
      { runValidators: true }
    );
  } else if (userModel === "Agency") {
    await Agency.updateOne(
      { email: email },
      { password: hashedNewPassword },
      { runValidators: true }
    );
  } else if (userModel === "RentCar") {
    await RentCar.updateOne(
      { email: email },
      { password: hashedNewPassword },
      { runValidators: true }
    );
  } else if (userModel === "Donation") {
    await Donation.updateOne(
      { email: email },
      { password: hashedNewPassword },
      { runValidators: true }
    );
  } else if (userModel === "Hotel") {
    await Hotel.updateOne(
      { email: email },
      { password: hashedNewPassword },
      { runValidators: true }
    );
  } else if (userModel === "Insurance") {
    await Insurance.updateOne(
      { email: email },
      { password: hashedNewPassword },
      { runValidators: true }
    );
  } else if (userModel === "User") {
    await User.updateOne(
      { email: email },
      { password: hashedNewPassword },
      { runValidators: true }
    );
  } else if (userModel === "TravComp") {
    await TravelCompany.updateOne(
      { email: email },
      { password: hashedNewPassword },
      { runValidators: true }
    );
  }
};

const verificationController = {
  async sendCodeToEmail(req, res, next) {
    let emailExists;
    const { email } = req.body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Additional checks for the domain part and local part of the email address
    if (!EmailValidator.validate(email)) {
      const error = {
        status: 400,
        message: "Invalid email address!",
      };

      return next(error);
    }
    let emailRegexx = new RegExp(email, "i");
    if (req.originalUrl.includes("/lab")) {
      emailExists = await Laboratory.findOne({
        email: { $regex: emailRegexx },
      });
    } else if (req.originalUrl.includes("/pharmaceu")) {
      emailExists = await Pharmaceutical.findOne({
        email: { $regex: emailRegexx },
      });
    } else if (req.originalUrl.includes("/pharm")) {
      emailExists = await Pharmacy.findOne({ email: { $regex: emailRegexx } });
    } else if (req.originalUrl.includes("/doc")) {
      emailExists = await Doctor.findOne({ email: { $regex: emailRegexx } });
    } else if (req.originalUrl.includes("/hosp")) {
      emailExists = await Hospital.findOne({ email: { $regex: emailRegexx } });
    } else if (req.originalUrl.includes("/ambulance")) {
      emailExists = await AmbulanceCompany.findOne({
        email: { $regex: emailRegexx },
      });
    } else if (req.originalUrl.includes("/agency")) {
      emailExists = await Agency.findOne({ email: { $regex: emailRegexx } });
    } else if (req.originalUrl.includes("/rentCar")) {
      emailExists = await RentCar.findOne({ email: { $regex: emailRegexx } });
    } else if (req.originalUrl.includes("/donation")) {
      emailExists = await Donation.findOne({ email: { $regex: emailRegexx } });
    } else if (req.originalUrl.includes("/hotel")) {
      emailExists = await Hotel.findOne({ email: { $regex: emailRegexx } });
    } else if (req.originalUrl.includes("/insurance")) {
      emailExists = await Insurance.findOne({ email: { $regex: emailRegexx } });
    } else if (req.originalUrl.includes("/user")) {
      emailExists = await User.findOne({ email: { $regex: emailRegexx } });
    }
    if (emailExists) {
      const error = new Error("Email already exists!");
      error.status = 400;
      return next(error);
    }
    try {
      // Invalidate previous codes for this email
      await VerificationCode.deleteMany({ email });
      let code;
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
      var codeToSave = new VerificationCode({
        email: email,
        code: Math.floor(100000 + Math.random() * 900000),
        expiresAt,
      });
      code = codeToSave.save();
      var mailOptions = {
        from: "no-reply@example.com",
        to: email,
        subject: "Account Verification",
        html: `
        <div style="
          font-family: Arial, sans-serif;
          text-align: center;
          background-color: #f3f4f6;
          color: #555;
          padding: 20px;
          border-radius: 8px;
          max-width: 600px;
          margin: auto;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
          
          <h1 style="font-size: 24px; color: #333;">Signup to MediTour</h1>
          <p style="font-size: 16px; margin: 10px 0 20px;">
Welcome! Please enter this code within the next 2 minutes to start Signup process:
          </p>
          <div style="
            font-size: 20px;
            font-weight: bold;
            background-color: #fff;
            color: #ff6600;
            padding: 10px;
            border: 2px dashed #ff6600;
            border-radius: 5px;
            display: inline-block;
            margin: 20px 0;
          ">
            ${codeToSave.code}
          </div>
          
          <hr style="border: 0; height: 1px; background: #ddd; margin: 20px 0;">
          
          <p style="font-size: 12px; color: #aaa;">
            Thank you for using our service.
          </p>
        </div>`,
      };
      transporter.sendMail(mailOptions, function (err) {
        if (err) {
          return next(err);
        }

        return res.status(200).json({
          status: true,
          message: ` A verification email has been sent to ${email}`,
        });
      });
    } catch (error) {
      return next(error);
    }
  },

  //............Forgot Password Mobile...............//
  async forgotPassword(req, res, next) {
    try {
      let emailExists;
      const { email } = req.body;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      // Additional checks for the domain part and local part of the email address
      if (!EmailValidator.validate(email)) {
        const error = {
          status: 400,
          message: "Invalid email address!",
        };

        return next(error);
      }
      let emailRegexx = new RegExp(email, "i");
      if (req.originalUrl.includes("/lab")) {
        emailExists = await Laboratory.findOne({
          email: { $regex: emailRegexx },
        });
      } else if (req.originalUrl.includes("/pharmaceu")) {
        emailExists = await Pharmaceutical.findOne({
          email: { $regex: emailRegexx },
        });
      } else if (req.originalUrl.includes("/pharm")) {
        emailExists = await Pharmacy.findOne({
          email: { $regex: emailRegexx },
        });
      } else if (req.originalUrl.includes("/doc")) {
        emailExists = await Doctor.findOne({ email: { $regex: emailRegexx } });
      } else if (req.originalUrl.includes("/hosp")) {
        emailExists = await Hospital.findOne({
          email: { $regex: emailRegexx },
        });
      } else if (req.originalUrl.includes("/ambulance")) {
        emailExists = await AmbulanceCompany.findOne({
          email: { $regex: emailRegexx },
        });
      } else if (req.originalUrl.includes("/agency")) {
        emailExists = await Agency.findOne({ email: { $regex: emailRegexx } });
      } else if (req.originalUrl.includes("/rentCar")) {
        emailExists = await RentCar.findOne({ email: { $regex: emailRegexx } });
      } else if (req.originalUrl.includes("/donation")) {
        emailExists = await Donation.findOne({
          email: { $regex: emailRegexx },
        });
      } else if (req.originalUrl.includes("/hotel")) {
        emailExists = await Hotel.findOne({ email: { $regex: emailRegexx } });
      } else if (req.originalUrl.includes("/insurance")) {
        emailExists = await Insurance.findOne({
          email: { $regex: emailRegexx },
        });
      } else if (req.originalUrl.includes("/user")) {
        emailExists = await User.findOne({ email: { $regex: emailRegexx } });
      }
      if (!emailExists) {
        const error = new Error("User not found!");
        error.status = 400;
        return next(error);
      }
      // Invalidate previous codes for this email
      await VerificationCode.deleteMany({ email });
      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000);

      // Save verification code in the database
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
      const codeToSave = new VerificationCode({
        email: email,
        code: verificationCode,
        expiresAt,
      });
      await codeToSave.save();
      const mailOptions = {
        from: "no-reply@example.com",
        to: email,
        subject: "Reset Password",
        html: `
        <div style="
          font-family: Arial, sans-serif;
          text-align: center;
          background-color: #f3f4f6;
          color: #555;
          padding: 20px;
          border-radius: 8px;
          max-width: 600px;
          margin: auto;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
          
          <h1 style="font-size: 24px; color: #333;">Reset Your Password</h1>
          <p style="font-size: 16px; margin: 10px 0 20px;">
            Use the following code to reset your password:
          </p>
          
          <div style="
            font-size: 20px;
            font-weight: bold;
            background-color: #fff;
            color: #ff6600;
            padding: 10px;
            border: 2px dashed #ff6600;
            border-radius: 5px;
            display: inline-block;
            margin: 20px 0;
          ">
            ${verificationCode}
          </div>
          
          <p style="font-size: 14px; color: #777; margin: 20px 0;">
            If you did not request to reset your password, you can safely ignore this email.
          </p>
          
          <hr style="border: 0; height: 1px; background: #ddd; margin: 20px 0;">
          
          <p style="font-size: 12px; color: #aaa;">
            Thank you for using our service.
          </p>
        </div>`,
      };

      transporter.sendMail(mailOptions, function (err) {
        if (err) {
          return next(err);
        }

        return res.status(200).json({
          status: true,
          message: `A password reset code has been sent to ${email}`,
        });
      });
    } catch (error) {
      return res
        .status(500)
        .json({ status: "failure", message: "Internal server error" });
    }
  },
  async updatePassword(req, res, next) {
    const { email, newPassword, verificationCode } = req.body;
    try {
      // Check if the verification code is provided
      if (!verificationCode) {
        return res
          .status(400)
          .json({ message: "Verification code is required" });
      }

      // Find the verification code associated with the provided email
      const code = await VerificationCode.findOne({
        email,
        code: verificationCode,
      });
      if (!code) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      let emailExists;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!EmailValidator.validate(email)) {
        return res.status(400).json({ message: "Invalid email address!" });
      }

      const emailRegexx = new RegExp(email, "i");
      let userType;
      if (req.originalUrl.includes("/lab")) {
        userType = Laboratory;
      } else if (req.originalUrl.includes("/pharmaceu")) {
        userType = Pharmaceutical;
      } else if (req.originalUrl.includes("/pharm")) {
        userType = Pharmacy;
      } else if (req.originalUrl.includes("/doc")) {
        userType = Doctor;
      } else if (req.originalUrl.includes("/hosp")) {
        userType = Hospital;
      } else if (req.originalUrl.includes("/ambulance")) {
        userType = AmbulanceCompany;
      } else if (req.originalUrl.includes("/agency")) {
        userType = Agency;
      } else if (req.originalUrl.includes("/rentCar")) {
        userType = RentCar;
      } else if (req.originalUrl.includes("/donation")) {
        userType = Donation;
      } else if (req.originalUrl.includes("/hotel")) {
        userType = Hotel;
      } else if (req.originalUrl.includes("/insurance")) {
        userType = Insurance;
      } else if (req.originalUrl.includes("/user")) {
        userType = User;
      }

      if (userType) {
        user = await userType.findOne({ email: { $regex: emailRegexx } });
      } else {
        return res.status(400).json({ message: "User type not recognized" });
      }

      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }

      // Check if the new password meets the pattern requirements
      if (!passwordPattern.test(newPassword)) {
        return res.status(400).json({
          message: "Must include 1 uppercase, 1 special character and 1 digit.",
        });
      }

      // Check if the new password is the same as the old one
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        return res.status(400).json({
          message: "New password must be different from the old password",
        });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update the user's password with the hashed password
      user.password = hashedPassword;
      await user.save();

      // Delete the verification code from the database
      await VerificationCode.deleteOne({ email, code: verificationCode });

      return res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  },
  async confirmEmail(req, res, next) {
    const { code, email, type, doctorKind } = req.body;

    // Find the verification code based on the provided code
    VerificationCode.findOne({ code: code }, function (err, cod) {
      if (!cod) {
        const error = new Error(
          "Incorrect verification code. Please double-check the code and try again."
        );
        error.status = 400;
        return next(error);
      } else {
        if (email == cod.email) {
          // If the type is "doctor", check for the doctorKind
          if (type === "doctor" && doctorKind) {
            // Check if doctorKind matches the kind in the database
            Doctor.findOne(
              { email: cod.email, doctorKind: doctorKind },
              function (err, doctor) {
                if (doctor) {
                  return res.status(200).json({
                    status: true,
                    message:
                      "Your doctor account has been successfully verified",
                  });
                } else {
                  return res.status(400).json({
                    status: false,
                    message:
                      "Doctor kind doesn't match. Please select the correct type of doctor.",
                  });
                }
              }
            );
          } else {
            // General case (non-doctor types)
            return res.status(200).json({
              status: true,
              message: "Your account has been successfully verified",
            });
          }
        } else {
          return res.status(400).json({
            status: false,
            message:
              "We were unable to find a user for this verification. Please enter a correct email!",
          });
        }
      }
    });
  },

  //............Forgot Password Web...............//
  async ResetLink(req, res, next) {
    try {
      let { email, doctorKind } = req.body;
      let existingUser;
      let userType;

      if (!email) {
        return res
          .status(400)
          .json({ status: "failure", message: "Please enter email" });
      }
      if (req.originalUrl.includes("/lab")) {
        try {
          existingUser = await Laboratory.findOne({ email });
          userType = "Laboratory";
        } catch (error) {
          return next(error);
        }
      } else if (req.originalUrl.includes("/pharmaceu")) {
        try {
          existingUser = await Pharmaceutical.findOne({ email });
          userType = "Pharmaceutical";
        } catch (error) {
          return next(error);
        }
      } else if (req.originalUrl.includes("/pharm")) {
        try {
          existingUser = await Pharmacy.findOne({ email });
          userType = "Pharmacy";
        } catch (error) {
          return next(error);
        }
      } else if (req.originalUrl.includes("/docCompany")) {
        try {
          existingUser = await DoctorCompany.findOne({ email });
          userType = "DocCompany";
        } catch (error) {
          return next(error);
        }
      } else if (req.originalUrl.includes("/doc")) {
        try {
          existingUser = await Doctor.findOne({ email, doctorKind });
          userType = "Doctor";
        } catch (error) {
          return next(error);
        }
      } else if (req.originalUrl.includes("/hosp")) {
        try {
          existingUser = await Hospital.findOne({ email });
          userType = "Hospital";
        } catch (error) {
          return next(error);
        }
      } else if (req.originalUrl.includes("/ambulance")) {
        try {
          existingUser = await AmbulanceCompany.findOne({ email });
          userType = "Ambulance";
        } catch (error) {
          return next(error);
        }
      } else if (req.originalUrl.includes("/agency")) {
        try {
          existingUser = await Agency.findOne({ email });
          userType = "Agency";
        } catch (error) {
          return next(error);
        }
      } else if (req.originalUrl.includes("/rentCar")) {
        try {
          existingUser = await RentCar.findOne({ email });
          userType = "RentCar";
        } catch (error) {
          return next(error);
        }
      } else if (req.originalUrl.includes("/donation")) {
        try {
          existingUser = await Donation.findOne({ email });
          userType = "Donation";
        } catch (error) {
          return next(error);
        }
      } else if (req.originalUrl.includes("/hotel")) {
        try {
          existingUser = await Hotel.findOne({ email });
          userType = "Hotel";
        } catch (error) {
          return next(error);
        }
      } else if (req.originalUrl.includes("/insurance")) {
        try {
          existingUser = await Insurance.findOne({ email });
          userType = "Insurance";
        } catch (error) {
          return next(error);
        }
      } else if (req.originalUrl.includes("/user")) {
        try {
          existingUser = await User.findOne({ email });
          userType = "User";
        } catch (error) {
          return next(error);
        }
      } else if (req.originalUrl.includes("/travComp")) {
        try {
          existingUser = await TravelCompany.findOne({ email });
          userType = "TravComp";
        } catch (error) {
          return next(error);
        }
      }

      if (!existingUser) {
        return res
          .status(400)
          .json({ status: "failure", message: "Email not found" });
      }

      // Delete any existing tokens for this email to invalidate all old reset links
      await ResetToken.deleteMany({ email });

      // Generate a new reset token
      const resetToken = uuidv4();

      // Save the new reset token
      const token = new ResetToken({ token: resetToken, email, userType });
      await token.save();

      // Create the reset link
      const baseUrl = "https://meditour.global";
      let resetLink;

      if (userType == "Ambulance") {
        resetLink = `${baseUrl}/homeservices/ambulanceservices/update-password?token=${resetToken}`;
      } else if (userType == "Laboratory") {
        resetLink = `${baseUrl}/laboratory/update-password?token=${resetToken}`;
      } else if (userType == "Hospital") {
        resetLink = `${baseUrl}/medicalservices/hospital/update-password?token=${resetToken}`;
      } else if (userType == "Pharmaceutical") {
        resetLink = `${baseUrl}/pharmaceu/update-password?token=${resetToken}`;
      } else if (userType == "Pharmacy") {
        resetLink = `${baseUrl}/pharmacy/update-password?token=${resetToken}`;
      } else if (userType == "DocCompany") {
        resetLink = `${baseUrl}/travComp/update-password?token=${resetToken}`;
      } else if (doctorKind == "doctor") {
        resetLink = `${baseUrl}/${doctorKind}/update-password?token=${resetToken}`;
      } else if (userType == "RentCar") {
        resetLink = `${baseUrl}/traveltourism/rentAcar/update-password?token=${resetToken}`;
      } else if (userType == "Agency") {
        resetLink = `${baseUrl}/traveltourism/travelAgency/update-password?token=${resetToken}`;
      } else if (userType == "Donation") {
        resetLink = `${baseUrl}/donation/update-password?token=${resetToken}`;
      } else if (userType == "Hotel") {
        resetLink = `${baseUrl}/traveltourism/hotel/update-password?token=${resetToken}`;
      } else if (userType == "Insurance") {
        resetLink = `${baseUrl}/Insurance/update-password?token=${resetToken}`;
      } else if (userType == "User") {
        resetLink = `${baseUrl}/Insurance/update-password?token=${resetToken}`;
      } else if (userType == "TravComp") {
        resetLink = `${baseUrl}/travComp/update-password?token=${resetToken}`;
      }

      var mailOptions = {
        from: "no-reply@example.com",
        to: email,
        subject: "Reset Password",
        html: `  <div style="
      font-family: Arial, sans-serif;
      text-align: center;
      background-color: #f3f4f6;
      color: #555;
      padding: 20px;
      border-radius: 8px;
      max-width: 600px;
      margin: auto;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
      <h1 style="font-size: 24px; color: #333;">Reset Your Password</h1>
      <p style="font-size: 16px; margin: 10px 0 20px;">
      You requested to reset your password. Click the button below to proceed:
      </p>
      
      <a href="${resetLink}" style="
        display: inline-block;
        background-color: #ff6600;
        color: white;
        padding: 12px 30px;
        font-size: 16px;
        border-radius: 5px;
        text-decoration: none;
        margin-bottom: 20px;
      ">Reset Password</a>
      
      <p style="font-size: 14px; color: #777; margin: 20px 0;">
        If the button above doesn't work, copy and paste the following link into your browser:
      </p>
      
      <p style="font-size: 13px; color: #888; word-break: break-all;">
        <a href="${resetLink}" style="color: #ff6600; text-decoration: none;">${resetLink}</a>
      </p>
      
      <hr style="border: 0; height: 1px; background: #ddd; margin: 20px 0;">
      
      <p style="font-size: 12px; color: #aaa;">
        If you did not request to reset your password, you can safely ignore this email.
      </p>
    </div>`,
      };
      transporter.sendMail(mailOptions, function (err) {
        if (err) {
          return next(err);
        }

        return res.status(200).json({
          status: true,
          message: `Password reset link sent to ${email}`,
        });
      });
    } catch (error) {
      return res
        .status(500)
        .json({ status: "failure", message: "Internal server error" });
    }
  },

  async resetPassword(req, res, next) {
    try {
      const resetSchema = Joi.object({
        newPassword: Joi.string()
          .pattern(passwordPattern)
          .message(
            "Must include 1 uppercase, 1 special character, and 1 digit."
          )
          .required(),
      });

      const { error } = resetSchema.validate(req.body);

      if (error) {
        return next(error);
      }

      const token = req.query.token;
      const { newPassword } = req.body;
      if (!newPassword) {
        return res.json({
          status: "Failure",
          message: "Please enter a new password",
        });
      }

      const resetToken = await ResetToken.findOne({ token });

      if (!resetToken) {
        return res.status(403).json({
          status: "failure",
          message: "Link expired. Please request a new link",
        });
      }

      const { email, userType } = resetToken;

      await userTypeFunction(userType, email, newPassword);

      await ResetToken.deleteOne({ token });

      return res.json({
        status: "success",
        message: "Password reset successful",
      });
    } catch (error) {
      next(error);
    }
  },

  async updateAllUsersPassword(req, res, next) {
    try {
      const resetSchema = Joi.object({
        oldPassword: Joi.string().required(),
        newPassword: Joi.string()
          .pattern(passwordPattern)
          .message("Must include 1 uppercase, 1 special character and 1 digit.")
          .required(),
        email: Joi.string().required(),
        userModel: Joi.string().required(),
      });

      const { error } = resetSchema.validate(req.body);

      if (error) {
        return next(error);
      }

      const { oldPassword, newPassword, email, userModel } = req.body;

      if (!newPassword) {
        return res.json({
          status: "Failure",
          message: "Please enter new password",
        });
      }

      if (!oldPassword) {
        return res.json({
          status: "Failure",
          message: "Please enter old password",
        });
      }

      // Fetch the user
      let user;
      if (userModel === "Laboratory") {
        user = await Laboratory.findOne({ email });
      } else if (userModel === "Pharmacy") {
        user = await Pharmacy.findOne({ email });
      } else if (userModel === "Pharmaceutical") {
        user = await Pharmaceutical.findOne({ email });
      } else if (userModel === "Doctor") {
        user = await Doctor.findOne({ email });
      } else if (userModel === "Hospital") {
        user = await Hospital.findOne({ email });
      } else if (userModel === "Ambulance") {
        user = await AmbulanceCompany.findOne({ email });
      } else if (userModel === "Agency") {
        user = await Agency.findOne({ email });
      } else if (userModel === "RentCar") {
        user = await RentCar.findOne({ email });
      } else if (userModel === "Donation") {
        user = await Donation.findOne({ email });
      } else if (userModel === "Hotel") {
        user = await Hotel.findOne({ email });
      } else if (userModel === "Insurance") {
        user = await Insurance.findOne({ email });
      } else if (userModel === "User") {
        user = await User.findOne({ email });
      } else if (userModel === "TravComp") {
        user = await TravelCompany.findOne({ email });
      }

      if (!user) {
        return res.status(404).json({
          status: "Failure",
          message: "User not found",
        });
      }

      // Compare old password
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({
          status: "Failure",
          message: "Old password is incorrect",
        });
      }

      // Call userTypeFunction to update the password
      await userTypeFunction(userModel, email, newPassword);

      return res.json({
        status: "Success",
        message: "Password reset successful",
      });
    } catch (error) {
      next(error);
    }
  },

  //............Gen Apis...............//
  async sendCodeToEmailGen(req, res, next) {
    let emailExists;
    const { email, type, doctorKind } = req.body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Additional checks for the domain part and local part of the email address
    if (!EmailValidator.validate(email)) {
      const error = {
        status: 400,
        message: "Invalid email address!",
      };

      return next(error);
    }
    let emailRegexx = new RegExp(email, "i");
    if (type == "laboratory") {
      emailExists = await Laboratory.findOne({
        email: { $regex: emailRegexx },
      });
    } else if (type == "pharmaceutical") {
      emailExists = await Pharmaceutical.findOne({
        email: { $regex: emailRegexx },
      });
    } else if (type == "pharmacy") {
      emailExists = await Pharmacy.findOne({ email: { $regex: emailRegexx } });
    } else if (type == "doctor") {
      emailExists = await Doctor.findOne({
        email: { $regex: emailRegexx },
        doctorKind,
      });
    } else if (type == "hospital") {
      emailExists = await Hospital.findOne({ email: { $regex: emailRegexx } });
    } else if (type == "ambulance") {
      emailExists = await AmbulanceCompany.findOne({
        email: { $regex: emailRegexx },
      });
    } else if (type == "travelagency") {
      emailExists = await Agency.findOne({ email: { $regex: emailRegexx } });
    } else if (type == "rentacar") {
      emailExists = await RentCar.findOne({ email: { $regex: emailRegexx } });
    } else if (type == "donation") {
      emailExists = await Donation.findOne({ email: { $regex: emailRegexx } });
    } else if (type == "hotel") {
      emailExists = await Hotel.findOne({ email: { $regex: emailRegexx } });
    } else if (type == "insurance") {
      emailExists = await Insurance.findOne({ email: { $regex: emailRegexx } });
    } else if (type == "user") {
      emailExists = await User.findOne({ email: { $regex: emailRegexx } });
    } else {
      return res.status(400).json({ status: true, message: "Invalid Type!" });
    }
    if (emailExists) {
      const error = new Error("Email already exists!");
      error.status = 400;
      return next(error);
    }
    try {
      // Invalidate previous codes for this email
      await VerificationCode.deleteMany({ email });
      let code;
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
      var codeToSave = new VerificationCode({
        email: email,
        code: Math.floor(100000 + Math.random() * 900000),
        expiresAt,
      });
      code = codeToSave.save();
      var mailOptions = {
        from: "no-reply@example.com",
        to: email,
        subject: "Account Verification",
        html: `
        <div style="
          font-family: Arial, sans-serif;
          text-align: center;
          background-color: #f3f4f6;
          color: #555;
          padding: 20px;
          border-radius: 8px;
          max-width: 600px;
          margin: auto;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
          
          <h1 style="font-size: 24px; color: #333;">Signup to MediTour</h1>
          <p style="font-size: 16px; margin: 10px 0 20px;">
Welcome! Please enter this code within the next 2 minutes to start Signup process:
          </p>
          <div style="
            font-size: 20px;
            font-weight: bold;
            background-color: #fff;
            color: #ff6600;
            padding: 10px;
            border: 2px dashed #ff6600;
            border-radius: 5px;
            display: inline-block;
            margin: 20px 0;
          ">
            ${codeToSave.code}
          </div>
          
          <hr style="border: 0; height: 1px; background: #ddd; margin: 20px 0;">
          
          <p style="font-size: 12px; color: #aaa;">
            Thank you for using our service.
          </p>
        </div>`,
      };
      transporter.sendMail(mailOptions, function (err) {
        if (err) {
          return next(err);
        }

        return res.status(200).json({
          status: true,
          message: ` A verification email has been sent to ${email}`,
        });
      });
    } catch (error) {
      return next(error);
    }
  },

  async forgotPasswordGen(req, res, next) {
    try {
      let emailExists;
      const { email, type, doctorKind } = req.body;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      // Additional checks for the domain part and local part of the email address
      if (!EmailValidator.validate(email)) {
        const error = {
          status: 400,
          message: "Invalid email address!",
        };

        return next(error);
      }
      let emailRegexx = new RegExp(email, "i");
      if (type == "laboratory") {
        emailExists = await Laboratory.findOne({
          email: { $regex: emailRegexx },
        });
      } else if (type == "pharmaceutical") {
        emailExists = await Pharmaceutical.findOne({
          email: { $regex: emailRegexx },
        });
      } else if (type == "pharmacy") {
        emailExists = await Pharmacy.findOne({
          email: { $regex: emailRegexx },
        });
      } else if (type == "doctor") {
        emailExists = await Doctor.findOne({
          email: { $regex: emailRegexx },
          doctorKind,
        });
      } else if (type == "hospital") {
        emailExists = await Hospital.findOne({
          email: { $regex: emailRegexx },
        });
      } else if (type == "ambulance") {
        emailExists = await AmbulanceCompany.findOne({
          email: { $regex: emailRegexx },
        });
      } else if (type == "travelagency") {
        emailExists = await Agency.findOne({ email: { $regex: emailRegexx } });
      } else if (type == "rentacar") {
        emailExists = await RentCar.findOne({ email: { $regex: emailRegexx } });
      } else if (type == "donation") {
        emailExists = await Donation.findOne({
          email: { $regex: emailRegexx },
        });
      } else if (type == "hotel") {
        emailExists = await Hotel.findOne({ email: { $regex: emailRegexx } });
      } else if (type == "insurance") {
        emailExists = await Insurance.findOne({
          email: { $regex: emailRegexx },
        });
      } else if (type == "user") {
        emailExists = await User.findOne({ email: { $regex: emailRegexx } });
      }
      if (!emailExists) {
        const error = new Error("User not found!");
        error.status = 400;
        return next(error);
      }
      // Invalidate previous codes for this email
      await VerificationCode.deleteMany({ email });
      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000);

      // Save verification code in the database
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
      const codeToSave = new VerificationCode({
        email: email,
        code: verificationCode,
        expiresAt,
      });
      if (doctorKind) {
        codeToSave.doctorKind = doctorKind;
      }
      await codeToSave.save();
      const mailOptions = {
        from: "no-reply@example.com",
        to: email,
        subject: "Reset Password",
        html: `
        <div style="
          font-family: Arial, sans-serif;
          text-align: center;
          background-color: #f3f4f6;
          color: #555;
          padding: 20px;
          border-radius: 8px;
          max-width: 600px;
          margin: auto;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
          
          <h1 style="font-size: 24px; color: #333;">Reset Your Password</h1>
          <p style="font-size: 16px; margin: 10px 0 20px;">
            Use the following code to reset your password:
          </p>
          
          <div style="
            font-size: 20px;
            font-weight: bold;
            background-color: #fff;
            color: #ff6600;
            padding: 10px;
            border: 2px dashed #ff6600;
            border-radius: 5px;
            display: inline-block;
            margin: 20px 0;
          ">
            ${verificationCode}
          </div>
          
          <p style="font-size: 14px; color: #777; margin: 20px 0;">
            If you did not request to reset your password, you can safely ignore this email.
          </p>
          
          <hr style="border: 0; height: 1px; background: #ddd; margin: 20px 0;">
          
          <p style="font-size: 12px; color: #aaa;">
            Thank you for using our service.
          </p>
        </div>`,
      };

      transporter.sendMail(mailOptions, function (err) {
        if (err) {
          return next(err);
        }

        return res.status(200).json({
          status: true,
          message: `A password reset code has been sent to ${email}`,
        });
      });
    } catch (error) {
      return res
        .status(500)
        .json({ status: "failure", message: "Internal server error" });
    }
  },

  async updatePasswordGen(req, res, next) {
    const { email, newPassword, verificationCode, type, doctorKind } = req.body;
    console.log("doctorKind", doctorKind);
    try {
      // Check if the verification code is provided
      if (!verificationCode) {
        return res
          .status(400)
          .json({ message: "Verification code is required" });
      }

      // Find the verification code associated with the provided email
      const verificationQuery = {
        email,
        code: verificationCode,
      };

      // Add doctorKind to the query only if doctorKind is provided and is "doctor"
      if (doctorKind) {
        verificationQuery.doctorKind = doctorKind;
      }

      console.log("verificationQuery", verificationQuery);
      // Find the verification code associated with the provided email
      const code = await VerificationCode.findOne(verificationQuery);
      if (!code) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      if (!EmailValidator.validate(email)) {
        return res.status(400).json({ message: "Invalid email address!" });
      }

      const emailRegexx = new RegExp(email, "i");
      const userTypes = {
        laboratory: Laboratory,
        pharmaceutical: Pharmaceutical,
        pharmacy: Pharmacy,
        doctor: Doctor,
        hospital: Hospital,
        ambulance: AmbulanceCompany,
        travelagency: Agency,
        rentacar: RentCar,
        donation: Donation,
        hotel: Hotel,
        insurance: Insurance,
        user: User,
      };

      let userType = userTypes[type];
      if (!userType) {
        return res.status(400).json({ message: "User type not recognized" });
      }

      const userQuery = { email: { $regex: emailRegexx } };
      if (doctorKind) {
        userQuery.doctorKind = doctorKind;
      }

      let user = await userType.findOne(userQuery);
      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }

      if (!passwordPattern.test(newPassword)) {
        return res.status(400).json({
          message: "Must include 1 uppercase, 1 special character and 1 digit.",
        });
      }

      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        return res.status(400).json({
          message: "New password must be different from the old password",
        });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();

      console.log("Updated password for user:", user.email);

      await VerificationCode.deleteOne({ email, code: verificationCode });

      return res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error updating password:", error);
      return next(error);
    }
  },
};

module.exports = verificationController;
