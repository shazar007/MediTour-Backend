const express = require("express");
const app = express();
const Pharmacies = require("../../models/Pharmacy/pharmacy");
const Hospital = require("../../models/Hospital/hospital");
const Labs = require("../../models/Laboratory/laboratory");
const Appointment = require("../../models/All Doctors Models/appointment.js");
const Department = require("../../models/Hospital/department.js");
const Doctor = require("../../models/Doctor/doctors.js");
const Patient = require("../../models/User/user.js");
const VerificationCode = require("../../models/verificationCode.js");
const nodemailer = require("nodemailer");
const transporter = require("../../utils/gmail.js");

const mongoose = require("mongoose");

const hospLabController = {
  async sendCodeToLabEmail(req, res, next) {
    const hospId = req.user._id;
    // const userId = req.query.id;
    const type = req.body.type;
    const email = req.body.email;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let emailExists;
    let emailRegexx = new RegExp(email, "i");
    if (type == "labs") {
      emailExists = await Labs.findOne({
        email: { $regex: emailRegexx },
      });
    } else if (type == "pharmacy") {
      emailExists = await Pharmacies.findOne({
        email: { $regex: emailRegexx },
      });
    }

    const hospital = await Hospital.findById(hospId);
    if (!hospital) {
      return res.status(404).json({});
    }
    if (emailExists) {
      return res.status(400).json({ message: "Email already exists!" });
    }
    // const email = user.email;
    try {
      // Invalidate previous codes for this email
      await VerificationCode.deleteMany({ email });
      let code;
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
      var codeToSave = new VerificationCode({
        email: email,
        code: Math.floor(100000 + Math.random() * 900000),
        doctorKind: type,
        expiresAt,
      });
      code = codeToSave.save();

      var mailOptions = {
        from: "no-reply@example.com",
        to: email,
        subject: "Account Verification",
        html:`<div style="
        font-family: Arial, sans-serif;
        text-align: center;
        background-color: #f3f4f6;
        color: #555;
        padding: 20px;
        border-radius: 8px;
        max-width: 600px;
        margin: auto;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
      
        <h1 style="font-size: 24px; color: #333;">${hospital.name} is Adding You to Their Network on MediTour!</h1>
        <p style="font-size: 16px; margin: 10px 0 20px;">
          You are being added by ${hospital.name} as a ${type === "labs" ? "Laboratory" : type} in the MediTour dashboard!
        </p>
        <p style="font-size: 16px; margin: 10px 0 20px;">
          Your verification code is:
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
          margin: 20px 0;">
          ${codeToSave.code}
        </div>
      
        <p style="font-size: 16px; margin: 10px 0 20px;">
          Thank You!
        </p>
      
        <hr style="border: 0; height: 1px; background: #ddd; margin: 20px 0;">
      
        <p style="font-size: 12px; color: #aaa;">
          Thank you for using our service.
        </p>
      </div>`,
        // text:
        //   `You are being added by ${hospital.name}` +
        //   " " +
        //   `as a ${type === "labs" ? "Laboratory" : type}` + // Labs ko laboratory banane ka logic
        //   " in meditour dashboard!\n" +
        //   "Your verification code is " +
        //   codeToSave.code +
        //   "\n\nThank You!\n",
      };
      transporter.sendMail(mailOptions, function (err) {
        if (err) {
          return next(err);
        }

        return res.status(200).json({
          status: true,
          email: email,
          message: ` A verification email has been sent`,
        });
      });
    } catch (error) {
      return next(error);
    }
  },
  async confirmEmail(req, res, next) {
    try {
      const { code, email, isHospAddingDoc, type } = req.body;
      const hospitalId = req.user._id;
      // const departmentId = req.query.id;

      // Find verification code
      VerificationCode.findOne({ code: code }, async function (err, cod) {
        if (!cod) {
          const error = new Error(
            "Incorrect verification code. Please double-check the code and try again."
          );
          error.status = 400;
          return next(error);
        } else {
          if (email === cod.email && type == cod.doctorKind) {
            if (!isHospAddingDoc) {
              const user = await Doctor.findOne({
                email: email,
                doctorKind: type,
              }); // Assuming the user is available in `req.user`

              // Check if the hospitalId is not already in the array before pushing
              if (user.hospitalIds.includes(hospitalId)) {
                return res.status(200).json({
                  status: true,
                  message: "This hospital is already associated with the user.",
                });
              }

              user.hospitalIds.push(hospitalId);

              await user.save();
            }
            return res.status(200).json({
              status: true,
              message: "Your account has been successfully verified",
            });
          } else {
            return res.status(200).json({
              status: true,
              message:
                "Please enter a correct email!",
            });
          }
        }
      });
    } catch (error) {
      return next(error);
    }
  },
  async getHospitalLabsAndPharms(req, res, next) {
    try {
      // Fetch hospital ID from the request
      const hospitalId = req.user._id;

      // Pagination variables
      const page = parseInt(req.query.page) || 1;
      const labsPerPage = 10;
      const skip = (page - 1) * labsPerPage;

      // Search keyword from query
      const searchKeyword = req.query.search ? req.query.search : "";

      // Determine the collection based on the query parameter
      const type = req.query.type === "pharmacy" ? Pharmacies : Labs;

      // Aggregate query to fetch data with search functionality
      const results = await type.aggregate([
        {
          $match: {
            hospitalIds: { $in: [hospitalId] }, // Filter by hospital ID
            $or: [
              { name: { $regex: searchKeyword, $options: "i" } }, // Search by name
              { ownerFirstName: { $regex: searchKeyword, $options: "i" } }, // Search by owner's first name
              { ownerLastName: { $regex: searchKeyword, $options: "i" } }, // Search by owner's last name
              { email: { $regex: searchKeyword, $options: "i" } }, // Search by email
            ],
          },
        },
        {
          $lookup: {
            from: "hospitals",
            localField: "hospitalIds",
            foreignField: "_id",
            as: "hospitalIds",
          },
        },
        {
          $project: {
            name: 1,
            email: 1,
            phoneNumber: 1,
            location: 1,
            isVerified: 1,
            averageRating: 1,
            hospitalIds: {
              _id: 1,
              name: 1,
              logo: 1,
              location: 1,
              createdAt: 1,
            },
            accountTitle: 1,
            emergencyNo: 1,
            ownerFirstName: 1,
            ownerLastName: 1,
            isActive: 1,
          },
        },
        { $sort: { createdAt: -1 } }, // Sort by creation date
        { $skip: skip }, // Skip the records based on pagination
        { $limit: labsPerPage }, // Limit the number of results fetched
      ]);

      // Fetch total count of labs/pharmacies with search functionality
      const totalResults = await type.countDocuments({
        hospitalIds: { $in: [hospitalId] },
        $or: [
          { name: { $regex: searchKeyword, $options: "i" } },
          { ownerFirstName: { $regex: searchKeyword, $options: "i" } },
          { ownerLastName: { $regex: searchKeyword, $options: "i" } },
          { email: { $regex: searchKeyword, $options: "i" } },
        ],
      });
      const totalPages = Math.ceil(totalResults / labsPerPage);

      // Pagination details
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Response: Dynamic selection based on `type`
      if (req.query.type === "pharmacy") {
        res.status(200).json({
          pharmacies: results,
          pharmacyCount: results.length,
          previousPage,
          nextPage,
          totalPages,
          auth: true,
        });
      } else {
        res.status(200).json({
          labs: results,
          labCount: results.length,
          previousPage,
          nextPage,
          totalPages,
          auth: true,
        });
      }
    } catch (error) {
      return next(error);
    }
  },
  async genericSearch(req, res, next) {
    try {
      const hospitalId = req.user._id;
      const { type, query, page = 1, limit = 10 } = req.query;

      if (!type || !query) {
        return res.status(400).json({
          message: "invalid parameters.",
        });
      }

      let results = [];
      let totalResults = 0;

      // Convert page and limit to integers
      const pageNumber = parseInt(page, 10);
      const pageLimit = parseInt(limit, 10);

      // Calculate skip and limit for pagination
      const skip = (pageNumber - 1) * pageLimit;

      const patients = await Patient.find({
        name: { $regex: query, $options: "i" },
      });

      const patientIds = patients.map((patient) => patient._id);

      switch (type) {
        case "branches":
          results = await Hospital.find({
            mainHospitalId: hospitalId,
            $or: [
              { name: { $regex: query, $options: "i" } },
              { email: { $regex: query, $options: "i" } },
            ],
          })
            .skip(skip)
            .limit(pageLimit);

          // Get the total count for pagination
          totalResults = await Hospital.countDocuments({
            mainHospitalId: hospitalId,
            $or: [
              { name: { $regex: query, $options: "i" } },
              { email: { $regex: query, $options: "i" } },
            ],
          });
          break;

        case "appointment":
          results = await Appointment.find({
            hospital: hospitalId,
            $or: [
              { appointmentId: { $regex: query, $options: "i" } },
              { patientId: { $in: patientIds } },
            ],
          })
            .populate({
              path: "patientId",
              select: "name",
            })
            .skip(skip)
            .limit(pageLimit)
            .exec();

          totalResults = await Appointment.countDocuments({
            hospital: hospitalId,
            $or: [
              { appointmentId: { $regex: query, $options: "i" } },
              { patientId: { $in: patientIds } },
            ],
          });
          break;

        case "department":
          const doctors = await Doctor.find({
            $or: [
              { name: { $regex: query, $options: "i" } },
              { email: { $regex: query, $options: "i" } },
            ],
          });

          const doctorIds = doctors.map((doctor) => doctor._id);

          results = await Department.find({
            hospitalId: hospitalId,
            $or: [{ headDocId: { $in: doctorIds } }],
          })
            .populate("headDocId", "name email")
            .populate("categoryId", "categoryName")
            .skip(skip)
            .limit(pageLimit)
            .then((departments) => {
              return departments.filter(
                (department) =>
                  department.categoryId &&
                  department.categoryId.categoryName &&
                  department.categoryId.categoryName
                    .toLowerCase()
                    .includes(query.toLowerCase())
              );
            });

          totalResults = await Department.countDocuments({
            hospitalId: hospitalId,
            $or: [{ headDocId: { $in: doctorIds } }],
          });
          break;

        case "doctor":
          results = await Doctor.find({
          "hospitalIds.hospitalId": hospitalId,
            $or: [
              { name: { $regex: query, $options: "i" } },
              { email: { $regex: query, $options: "i" } },
            ],
          })
            .skip(skip)
            .limit(pageLimit);

          totalResults = await Doctor.countDocuments({
         "hospitalIds.hospitalId": hospitalId,
            $or: [
              { name: { $regex: query, $options: "i" } },
              { email: { $regex: query, $options: "i" } },
            ],
          });
          break;

        case "patient":
          const appointments = await Appointment.find({
            hospital: hospitalId,
            $or: [
              { appointmentId: { $regex: query, $options: "i" } },
              { patientId: { $in: patientIds } },
            ],
          });

          const appointmentPatientIds = [
            ...new Set(
              appointments.map((appointment) =>
                appointment.patientId.toString()
              )
            ),
          ];

          results = await Patient.find({
            _id: { $in: appointmentPatientIds },
            name: { $regex: query, $options: "i" },
          })
            .skip(skip)
            .limit(pageLimit);

          totalResults = await Patient.countDocuments({
            _id: { $in: appointmentPatientIds },
            name: { $regex: query, $options: "i" },
          });

          break;

        case "laboratory":
          results = await Labs.find({
            hospitalIds: { $in: [hospitalId] },
            $or: [
              { name: { $regex: query, $options: "i" } },
              { email: { $regex: query, $options: "i" } },
            ],
          })
            .skip(skip)
            .limit(pageLimit);

          totalResults = await Labs.countDocuments({
            hospitalIds: { $in: [hospitalId] },
            $or: [
              { name: { $regex: query, $options: "i" } },
              { email: { $regex: query, $options: "i" } },
            ],
          });
          break;

        case "pharmacy":
          results = await Pharmacies.find({
            hospitalIds: { $in: [hospitalId] },
            $or: [
              { name: { $regex: query, $options: "i" } },
              { email: { $regex: query, $options: "i" } },
            ],
          })
            .skip(skip)
            .limit(pageLimit);

          totalResults = await Pharmacies.countDocuments({
            hospitalIds: { $in: [hospitalId] },
            $or: [
              { name: { $regex: query, $options: "i" } },
              { email: { $regex: query, $options: "i" } },
            ],
          });
          break;

        default:
          return res.status(400).json({
            message: `Invalid type.`,
          });
      }

      // Calculate total pages
      const totalPages = Math.ceil(totalResults / pageLimit);

      // Determine if there are previous and next pages
      const previousPage = pageNumber > 1 ? pageNumber - 1 : null;
      const nextPage = pageNumber < totalPages ? pageNumber + 1 : null;

      return res.status(200).json({
        auth: true,
        results: results,
        totalResults: totalResults,
        previousPage,
        nextPage,
        totalPages,
      });
    } catch (error) {
      next(error);
    }
  },
};
module.exports = hospLabController;
