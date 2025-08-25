const Doctor = require("../../models/Doctor/doctors");
const Appointment = require("../../models/All Doctors Models/appointment");
const Order = require("../../models/order.js");
const History = require("../../models/All Doctors Models/history");
const Notification = require("../../models/notification");
const geolib = require("geolib");
const { sendchatNotification } = require("../../firebase/service/index.js");
const DoctorAvailability = require("../../models/All Doctors Models/availability.js");
const Hospital = require("../../models/Hospital/hospital.js");
const Rating = require("../../models/rating");
const Prescription = require("../../models/All Doctors Models/ePrescription");
const Medicine = require("../../models/Pharmacy/medicine.js");
const Pharmacy = require("../../models/Pharmacy/pharmacy.js");
const Laboratory = require("../../models/Laboratory/laboratory.js");
const Tests = require("../../models/Laboratory/tests.js");
const User = require("../../models/User/user.js");
const axios = require("axios");
const pdfkit = require("pdfkit");
const ePrescription = require("../../models/All Doctors Models/ePrescription");
const AppointmentRequest = require("../../models/All Doctors Models/request.js");
const stripePaymentTransaction = require("../../models/stripeTransactions");
const Referral = require("../../models/All Doctors Models/referral.js");
const Admin = require("../../models/Admin/Admin"); // Import the Admin mode
const Speciality = require("../../models/All Doctors Models/specialities.js"); // Import the Admin mode
const MedicineRequest = require("../../models/Pharmacy/medicineRequest.js"); // Import the Admin mode
const Treatment = require("../../models/All Doctors Models/treatments.js"); // Import the Admin mode
const BookTreatment = require("../../models/All Doctors Models/bookTreatment.js");
const Category = require("../../models/All Doctors Models/categories.js");
const FreeConsultancy = require("../../models/All Doctors Models/freeConsultancy.js");
const Joi = require("joi");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const user = require("../../models/User/user.js");
const exchangeRateApi = require("../../utils/ExchangeRate.js");
const {
  FactorListInstance,
} = require("twilio/lib/rest/verify/v2/service/entity/factor.js");

async function getNextRequestNo() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestOrder = await MedicineRequest.findOne({}).sort({
      createdAt: -1,
    });

    let nextOrderIdNumber = 1;
    if (latestOrder && latestOrder.requestId) {
      // Extract the numeric part of the orderId and increment it
      const currentOrderIdNumber = parseInt(latestOrder.requestId.substring(3));
      nextOrderIdNumber = currentOrderIdNumber + 1;
    }

    // Generate the next orderId
    const nextOrderId = `REQ${nextOrderIdNumber.toString().padStart(4, "0")}`;

    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}
async function getNextAppointmentNo() {
  try {
    // Find the latest pharmacy order in the database and get its orderId
    const latestVendor = await AppointmentRequest.findOne({}).sort({
      createdAt: -1,
    });
    let nextVendorId = 1;
    if (latestVendor && latestVendor.appointmentId) {
      // Extract the numeric part of the orderId and increment it
      const currentVendorId = parseInt(latestVendor.appointmentId.substring(3));
      nextVendorId = currentVendorId + 1;
    }
    // Generate the next orderId
    const nextOrderId = `APP${nextVendorId.toString().padStart(4, "0")}`;
    return nextOrderId;
  } catch (error) {
    throw new Error("Failed to generate order number");
  }
}

const userLabController = {
  async getNearbyDocs(req, res, next) {
    try {
        // Extract and parse query parameters
        const latitude = parseFloat(req.query.lat);
        const longitude = parseFloat(req.query.long);
        const searchValue = req.query.search;
        const speciality = req.query.speciality;
        const doctorType = req.query.doctorType;
        const country = req.query.country;
        const radius = parseInt(req.query.radius) || 20000; // Default to 20,000 meters
        const city = req.query.city;
        const filterTypes = req.query.filter ? req.query.filter.split(",") : ["all"];
        const treatmentId = req.query.treatmentId;
        const isPagination = req.query.page !== undefined; // Check if page is provided
        const page = isPagination ? parseInt(req.query.page) || 1 : null;
        const limit = isPagination ? parseInt(req.query.limit) || 12 : null;

        let doctorQuery = { blocked: false, paidActivation: true, isMeditour: false };

        if (searchValue) {
            const regex = new RegExp(searchValue, "i");
            doctorQuery.$or = [{ name: regex }, { speciality: regex }];
        }

        if (doctorType) {
            doctorQuery.doctorKind = doctorType;
        }

        if (filterTypes.includes("recommended")) {
            doctorQuery.isRecommended = true;
        }
        if (filterTypes.includes("country")) {
            doctorQuery.country = country;
        }
        if (filterTypes.includes("city") && city) {
            doctorQuery["location.city"] = city.trim();
        }
        if (filterTypes.includes("speciality") && speciality) {
            doctorQuery.speciality = { $in: [speciality] };
        }

        if (treatmentId && filterTypes.includes("treatment")) {
            const treatments = await BookTreatment.find({ treatmentId, isPersonal: true }).distinct("doctorId");
            if (treatments.length > 0) {
                doctorQuery._id = { $in: treatments };
            } else {
                return res.status(200).json({ doctors: [], totalDocs: 0, previousPage: null, nextPage: null, auth: true });
            }
        }

        if (filterTypes.includes("nearby")) {
            if (!isNaN(latitude) && !isNaN(longitude)) {
                const geoNearQuery = {
                    $geoNear: {
                        near: { type: "Point", coordinates: [longitude, latitude] },
                        distanceField: "distance",
                        maxDistance: radius,
                        spherical: true,
                        query: doctorQuery,
                    },
                };

                let aggregationPipeline = [geoNearQuery, {
                    $project: { ...doctorQuery, averageRating: { $toDouble: "$averageRating" }, distance: 1 },
                }];

                if (isPagination) {
                    const totalDocs = await Doctor.aggregate([...aggregationPipeline, { $count: "count" }]);
                    const totalDocuments = totalDocs.length > 0 ? totalDocs[0].count : 0;
                    const totalPages = Math.ceil(totalDocuments / limit);
                    const skip = (page - 1) * limit;

                    aggregationPipeline.push({ $skip: skip }, { $limit: limit }, { $sort: { isRecommended: -1, averageRating: -1 } });
                    const doctors = await Doctor.aggregate(aggregationPipeline);

                    return res.status(200).json({ doctors, totalDocs: totalDocuments, previousPage: page > 1 ? page - 1 : null, nextPage: page < totalPages ? page + 1 : null, auth: true });
                }

                const doctors = await Doctor.aggregate(aggregationPipeline);
                return res.status(200).json({ doctors, totalDocs: doctors.length, auth: true });
            } else {
                return res.status(400).json({ error: "Invalid latitude or longitude for nearby filter" });
            }
        }

        let doctorsQuery = Doctor.find(doctorQuery);
        if (isPagination) {
            const skip = (page - 1) * limit;
            doctorsQuery = doctorsQuery.skip(skip).limit(limit);
        }

        doctorsQuery = doctorsQuery.sort({ isRecommended: -1, averageRating: -1 });
        const doctors = await doctorsQuery.exec();
        const totalDocs = isPagination ? await Doctor.countDocuments(doctorQuery) : doctors.length;
        const totalPages = isPagination ? Math.ceil(totalDocs / limit) : 1;

        return res.status(200).json({ doctors, totalDocs, previousPage: isPagination && page > 1 ? page - 1 : null, nextPage: isPagination && page < totalPages ? page + 1 : null, auth: true });
    } catch (error) {
        return next(error);
    }
},

  async filterDocs(req, res, next) {
    try {
      const minRating = parseFloat(req.query.minRating) || 0;
      const longitude = parseFloat(req.query.long);
      const latitude = parseFloat(req.query.lat);
      const radius = parseInt(req.query.radius) || 10000; // Default radius in meters
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 10; // Default to 10 doctors per page
      const doctorType = req.query.doctorType;
      const doctorKind = doctorType;
      // Geospatial query to find doctors within the specified radius
      const doctorsWithinRadius = await Doctor.find({
        location: {
          $geoWithin: {
            $centerSphere: [[longitude, latitude], radius / 6378.1], // Convert radius from meters to radians
          },
        },
        doctorKind: doctorKind,
      });

      // Get IDs of doctors within the radius
      const doctorIdsWithinRadius = doctorsWithinRadius.map(
        (doctor) => doctor._id
      );

      // Filter doctors by rating and apply pagination
      const totalFilteredDoctors = await Doctor.countDocuments({
        _id: { $in: doctorIdsWithinRadius },
        averageRating: { $gte: minRating },
        doctorKind: doctorKind,
      });

      // Calculate total pages
      const totalPages = Math.ceil(totalFilteredDoctors / limit);

      // Determine the skip count for pagination
      const skip = (page - 1) * limit;

      // Fetch the filtered doctors with pagination
      const doctors = await Doctor.find({
        _id: { $in: doctorIdsWithinRadius },
        averageRating: { $gte: minRating },
        doctorKind: doctorKind,
      })
        .skip(skip)
        .limit(limit);

      // Determine previous and next page numbers
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Return the paginated list of doctors with pagination details
      res.status(200).json({
        doctors,
        currentPage: page,
        totalPages,
        previousPage,
        nextPage,
        totalFilteredDoctors,
      });
    } catch (error) {
      // Handle errors
      next(error);
    }
  },

  async getDoc(req, res, next) {
    try {
      const doctorId = req.query.doctorId;
      const patientId = req.query.patientId;
      let type = req.query.type;

      // Fetch doctor details by ID
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json([]); // Send empty response
      }
      const clinicName = doctor.clinicName;

      // Initialize appointmentType array
      let appointmentType = [];
      let hospitals = [];

      // Fetch availability details
      const availability = await DoctorAvailability.findOne({ doctorId });

      if (availability) {
        // Check and add clinic availability
        if (availability.clinicAvailability?.availability?.length > 0) {
          appointmentType.push({
            type: "clinic",
            price: availability.clinicAvailability.price?.actualPrice,
          });
        }

        // Check and add hospital availability
        if (availability.hospitalAvailability?.length > 0) {
          appointmentType.push({
            type: "hospital",
            price: 0,
          });

          // Fetch hospital details asynchronously
          hospitals = await Promise.all(
            availability.hospitalAvailability.map(async (availability) => {
              const hospitalId = availability.hospitalId;
              const hospital = await Hospital.findById(hospitalId)
                .select("_id name")
                .exec();
              return hospital;
            })
          );
        }

        // Check and add video availability
        if (availability.videoAvailability?.availability?.length > 0) {
          appointmentType.push({
            type: "video",
            price: availability.videoAvailability.price?.actualPrice,
          });
        }

        // Check and add in-house availability
        if (availability.inHouseAvailability?.availability?.length > 0) {
          appointmentType.push({
            type: "in-house",
            price: availability.inHouseAvailability.price?.actualPrice,
          });
        }
      }

      // Respond based on the type of request
      let appointmentExists;
      if (patientId !== "") {
        const existingAppointmentRequest = await AppointmentRequest.findOne({
          doctorId: mongoose.Types.ObjectId(doctorId),
          patientId: mongoose.Types.ObjectId(patientId),
        });

        let existingAppointment;
        let existingAppointment1;
        let existingAppointment2;
        if (existingAppointmentRequest) {
          appointmentExists = true;
        } else {
          appointmentExists = false;
        }

        if (appointmentExists) {
          existingAppointment = await Appointment.findOne({
            doctorId: mongoose.Types.ObjectId(doctorId),
            patientId: mongoose.Types.ObjectId(patientId),
            status: "pending",
          });
          existingAppointment1 = await Appointment.findOne({
            doctorId: mongoose.Types.ObjectId(doctorId),
            patientId: mongoose.Types.ObjectId(patientId),
            status: { $in: ["completed", "cancelled"] },
          });
          existingAppointment2 = await Appointment.findOne({
            doctorId: mongoose.Types.ObjectId(doctorId),
            patientId: mongoose.Types.ObjectId(patientId),
          });

          if (existingAppointment2 || existingAppointment1) {
            appointmentExists = false;
          }
          if (existingAppointment) {
            appointmentExists = true;
          }
        }
      }

      // Sending response conditionally
      if (type === "doctor") {
        return res.status(200).json({
          doctor,
          clinicName,
          hospitals,
          appointmentType,
          ...(appointmentExists !== undefined && { appointmentExists }), // Only include if defined
        });
      } else if (type === "hospital") {
        return res.status(200).json({
          doctor,
          clinicName,
          ...(appointmentExists !== undefined && { appointmentExists }),
        });
      }
    } catch (error) {
      return next(error);
    }
  },

  async getHospitalAvailabilityPrice(req, res, next) {
    try {
      const doctorId = req.query.doctorId;
      const hospitalId = req.query.hospitalId;
      // Fetch the DoctorAvailability object based on the given doctorId
      const doctorAvailability = await DoctorAvailability.findOne({ doctorId });

      if (!doctorAvailability) {
        return res.status(404).json([]); // Send empty response
      }

      // Find the specific hospitalAvailability entry using its _id
      const hospitalAvailability = doctorAvailability.hospitalAvailability.find(
        (availability) => availability.hospitalId.toString() === hospitalId
      );

      if (!hospitalAvailability) {
        return res.status(404).json([]); // Send empty response
      }

      // Return the actualPrice of the found hospitalAvailability
      let actualPrice;
      if (hospitalAvailability?.price?.actualPrice) {
        actualPrice = hospitalAvailability.price.actualPrice;
      } else {
        actualPrice = 0;
      }
      res.json({ actualPrice: actualPrice });
    } catch (error) {
      throw error;
    }
  },

  async getAvailability(req, res, next) {
    try {
      const doctorId = req.query.doctorId;
      const type = req.query.type; // May be undefined
      const hospitalId = req.query.hospitalId;

      if (!doctorId) {
        return res.status(400).json({ message: "doctorId is required" });
      }
      if (!type) {
        return res.status(400).json({ message: "type is required" });
      }

      let doctorAvailability;

      if (type === "doctor") {
        // Fetch availability for doctor
        doctorAvailability = await DoctorAvailability.find({
          doctorId,
        })
          .populate({
            path: "hospitalAvailability.hospitalId",
            select: "name blocked paidActivation", // Include the blocked field
          })
          .lean();

        // Filter out hospitals where blocked is true
        doctorAvailability = doctorAvailability.map((availability) => {
          availability.hospitalAvailability =
            availability.hospitalAvailability.filter(
              (hospital) =>
                hospital.hospitalId &&
                !hospital.hospitalId.blocked &&
                hospital.hospitalId.paidActivation !== false
            );
          return availability;
        });

        return res.status(200).json({ availability: doctorAvailability });
      } else if (type === "hospital") {
        // Fetch availability for hospital
        doctorAvailability = await DoctorAvailability.find({
          doctorId,
        })
          .populate({
            path: "hospitalAvailability.hospitalId",
            select: "name blocked paidActivation", // Include the blocked field
          })
          .lean();

        if (hospitalId) {
          // Filter hospitalAvailability to only include entries matching the provided hospitalId
          doctorAvailability = doctorAvailability.map((availability) => {
            availability.hospitalAvailability =
              availability.hospitalAvailability.filter((availability) => {
                return (
                  availability.hospitalId &&
                  availability.hospitalId._id.equals(hospitalId) &&
                  !availability.hospitalId.blocked &&
                  availability.hospitalId.paidActivation !== false
                );
              });
            return availability;
          });
        } else {
          // Filter out hospitals where blocked is true
          doctorAvailability = doctorAvailability.map((availability) => {
            availability.hospitalAvailability =
              availability.hospitalAvailability.filter(
                (hospital) =>
                  hospital.hospitalId && !hospital.hospitalId.blocked
              );
            return availability;
          });
        }

        // Clear out other availability types as per your requirement
        doctorAvailability.forEach((avail) => {
          avail.clinicAvailability = {};
          avail.videoAvailability = {};
          avail.inHouseAvailability = {};
        });

        return res.status(200).json({ availability: doctorAvailability });
      } else if(type == "all") {
        doctorAvailability = await DoctorAvailability.find({
          doctorId,
        })
          .populate({
            path: "hospitalAvailability.hospitalId",
            select: "name blocked paidActivation",
          })
          return res.status(200).json({ availability: doctorAvailability });
      }
       else {
        // Default behavior for missing or unsupported type
        return res
          .status(400)
          .json({ message: "Invalid or missing type parameter" });
      }
    } catch (error) {
      next(error);
    }
  },
  async addAppointmentRequest(req, res, next) {
    try {
      const {
        appointmentType,
        hospital,
        totalAmount,
        paidByUserAmount,
        processingFee,
        isPaidFull,
        gatewayName,
        isTreatment,
        treatmentId,
        remainingAmount,
        docCompanyId,
        isCompany,
      } = req.body;
      const paymentId = req.body.paymentId;
      const doctorId = req.query.doctorId;
      const patientId = req.user._id;

      let paymentIdArray = [];

      if (gatewayName === "stripe") {
        paymentIdArray.push({
          id: paymentId,
          status: "completed",
          createdAt: new Date(),
        });
      } else if (gatewayName === "blinq") {
        paymentIdArray.push({
          id: paymentId,
          status: "pending",
          createdAt: new Date(),
        });
      }
      // Generate a unique vendor ID
      const appointmentId = await getNextAppointmentNo();

      // Create a new appointment request
      const newAppointment = new AppointmentRequest({
        appointmentId,
        paymentId: paymentIdArray, // Ensure this is an array of objects
        doctorId,
        patientId,
        ...(hospital && { hospital }),
        appointmentType,
        isPaidFull,
        paidByUserAmount,
        totalAmount,
        processingFee,
        status: "pending",
        gatewayName,
        isTreatment,
        treatmentId,
        remainingAmount,
        ...(isCompany && docCompanyId && { docCompanyId }),
        isCompany,
      });

      // Save the new appointment to the database
      const savedAppointment = await newAppointment.save();
      const id = savedAppointment._id;
      const idModelType = "AppointmentRequest";
      if (gatewayName !== "blinq") {
        if (paymentId && paidByUserAmount && !isPaidFull && processingFee) {
          const stripePaymentToRegister = new stripePaymentTransaction({
            id,
            idModelType,
            paymentId,
            gatewayName,
            paidByUserAmount,
            isPaidFull,
          });
          const stripeController = await stripePaymentToRegister.save();
        }
        const user = await User.findById(patientId);
        const doctor = await Doctor.findById(doctorId);
        const hospitalName = await Hospital.findById(hospital);

        // Check if the booking is saved successfully
        if (savedAppointment) {
          const admins = await Admin.find({});
          const roundedPaidAmount = Math.round(paidByUserAmount);
          const notificationMessage = (() => {
            if (appointmentType === "hospital") {
              return `New appointment request for ${hospitalName.name} with ${doctor.name} received from ${user.name} with the payment of ${roundedPaidAmount}.`;
            } else {
              return `New appointment request for ${doctor.name} (${appointmentType}) received from ${user.name} with the payment of ${roundedPaidAmount}.`;
            }
          })();
          // Send notifications
          sendchatNotification(
            user._id,
            {
              title: "MediTour Global",
              message:
                "Your appointment request has been sent. It'll be accepted shortly",
            },
            "user"
          );

          // Save notifications
          const patientNotification = new Notification({
            senderId: admins._id,
            senderModelType: "Admin",
            receiverId: user._id,
            receiverModelType: "Users",
            title: "MediTour Global",
            message:
              "Your appointment request has been sent. It'll be accepted shortly",
          });
          await patientNotification.save();

          // Create notifications for each admin
          const notifications = admins.map((admin) => ({
            senderId: patientId,
            senderModelType: "Users",
            receiverId: admin._id,
            receiverModelType: "Admin",
            title: "MediTour Global",
            message: notificationMessage,
          }));

          // Insert notifications into the database
          await Notification.insertMany(notifications);

          // Send chat notifications to all admins asynchronously
          admins.forEach((admin) => {
            sendchatNotification(
              admin._id,
              {
                title: "MediTour Global",
                message: notificationMessage,
              },
              "admin"
            );
          });
        }
      }

      // Return the created booking request in the response
      res.status(201).json({
        success: true,
        booking: savedAppointment,
      });
    } catch (error) {
      // Pass any errors to the error handling middleware
      return next(error);
    }
  },

  async getAppointment(req, res, next) {
    try {
      const appointmentId = req.query.appointmentId;
      // Check if doctor availability exists
      const appointment = await Appointment.findById(appointmentId)
        .populate("patientId")
        .populate("doctorId")
        .populate("hospital")
        .populate({
          path: "ePrescription",
          populate: {
            path: "test.testId",
          },
        });

      if (!appointment) {
        return res.status(404).json([]); // Send empty response
      }

      res.status(200).json({ appointment });
    } catch (error) {
      next(error);
    }
  },

  async getUpcomingAppointment(req, res, next) {
    try {
      const userId = req.user._id;
      // Check if doctor availability exists
      const latestAppointment = await Appointment.find({ patientId: userId })
        .populate("doctorId")
        .populate({
          path: "treatmentId", // Populate treatment details
          populate: {
            path: "treatmentId", // Now populate the doctorId in the treatment
          },
        })
        .sort({ createdAt: -1 })
        .limit(1);

      if (!latestAppointment) {
        return res.status(404).json([]); // Send empty response
      }

      res.status(200).json({ latestAppointment });
    } catch (error) {
      next(error);
    }
  },

  async getAllUpcomingAppointments(req, res, next) {
    try {
      const userId = req.user._id;
      const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
      const limit = parseInt(req.query.limit) || 30; // Default to 10 appointments per page

      // Count the total number of upcoming appointments for the user
      const totalAppointments = await Appointment.countDocuments({
        patientId: userId,
        status: "pending",
      });

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalAppointments / limit);

      // Calculate the number of appointments to skip based on the current page
      const skip = (page - 1) * limit;

      // Fetch the paginated upcoming appointments, sorted by creation date
      const latestAppointments = await Appointment.find({
        patientId: userId,
        status: "pending",
      })
        .populate("doctorId")
        .populate("patientId")
        .populate({
          path: "hospital", // Populate hospital details
          select: "name", // Select specific fields if needed
        })
        .populate({
          path: "treatmentId", // Populate treatment details
          populate: {
            path: "treatmentId", // Now populate the doctorId in the treatment
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      // Determine previous and next page numbers
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Return the paginated appointments with pagination details
      res.status(200).json({
        latestAppointments,
        currentPage: page,
        totalPages,
        previousPage,
        nextPage,
        totalAppointments,
      });
    } catch (error) {
      next(error);
    }
  },

  async getPatientData(req, res, next) {
    try {
      const appointmentId = req.query.appointmentId;

      // Fetch appointment details with populated data
      const patientAppointments = await Appointment.findById(appointmentId)
        .populate("patientId")
        .populate("doctorId")
        .populate("hospital")
        .populate("history")
        .populate({
          path: "ePrescription",
          populate: [
            {
              path: "doctorId",
              select: "name",
            },
            {
              path: "medicines",
              populate: {
                path: "medicineId",
                select: "generic productName tpPrice pricePerTab",
              },
            },
            {
              path: "test.testId",
            },
          ],
        });

      // Extract testNameIds from the ePrescription test array
      const testNameIds =
        patientAppointments.ePrescription?.test.map(
          (testItem) => testItem.testId?._id
        ) || [];

      // If there are testNameIds, filter labs that provide all the tests
      let filteredLabs = [];
      if (testNameIds.length > 0) {
        const matchingTests = await Tests.find({
          testNameId: { $in: testNameIds },
        }).populate("testNameId", "name");

        const labTestMap = {};
        matchingTests.forEach((test) => {
          if (!labTestMap[test.labId]) {
            labTestMap[test.labId] = [];
          }
          labTestMap[test.labId].push({
            _id: test._id,
            testId: test.testNameId._id,
            testName: test.testNameId.name,
            price: test.price,
            discount: test.discount,
            duration: test.duration,
            priceForMeditour: test.priceForMeditour,
            userAmount: test.userAmount,
          });
        });

        filteredLabs = Object.keys(labTestMap)
          .filter((labId) => {
            const providedTestIds = labTestMap[labId].map((test) =>
              test.testId.toString()
            );
            return testNameIds.every((testId) =>
              providedTestIds.includes(testId.toString())
            );
          })
          .map((labId) => ({
            labId,
            tests: labTestMap[labId],
          }));

        const labs = await Laboratory.find({
          _id: { $in: filteredLabs.map((lab) => lab.labId) },
          blocked: false,
          paidActivation: true,
        }).select("_id name logo paidActivation blocked hospitalIds");

        filteredLabs = filteredLabs
          .map((lab) => {
            const labDetails = labs.find(
              (l) =>
                l._id.toString() === lab.labId &&
                l.blocked === false &&
                l.paidActivation === true
            );

            if (!labDetails) {
              return null;
            }

            const totalUserAmount = lab.tests.reduce(
              (total, test) => total + (test.userAmount || 0),
              0
            );

            return {
              _id: labDetails._id,
              name: labDetails.name,
              logo: labDetails.logo,
              paidActivation: labDetails.paidActivation,
              hospitalIds: labDetails.hospitalIds, // Include hospitalIds for sorting
              tests: lab.tests,
              totalUserAmount,
            };
          })
          .filter((lab) => lab !== null);

        // Extract the hospital ID from the appointment
        const appointmentHospitalId =
          patientAppointments.hospital?._id.toString();

        console.log("Appointment Hospital ID:", appointmentHospitalId);
        // console.log("Filtered Labs Before Sorting:", filteredLabs);

        // Reorganize filteredLabs to prioritize the lab associated with the appointment's hospital
        if (appointmentHospitalId) {
          console.log("filteredLabs", filteredLabs);
          const relatedLabIndex = filteredLabs.findIndex((lab) =>
            lab.hospitalIds.includes(appointmentHospitalId)
          );

          console.log("Related Lab Index:", relatedLabIndex);

          if (relatedLabIndex !== -1) {
            // Move the related lab to the zero index
            const relatedLab = filteredLabs.splice(relatedLabIndex, 1)[0];
            filteredLabs.unshift(relatedLab);
          }
        }

        // console.log("Filtered Labs After Sorting:", filteredLabs);
      }

      // Fetch related orders for the appointment
      const orders = await Order.find({ appointmentId })
        .sort({ createdAt: -1 })
        .populate("vendorId", "name logo") // Populate vendor details
        .populate("items.itemId", "name price") // Populate item details
        .populate("userId", "name email"); // Populate user details

      res.status(200).json({
        patientAppointments,
        filteredLabs,
        orders, // Include orders in the response
      });
    } catch (error) {
      return next(error);
    }
  },
  async getNearbyMedicalServices(req, res, next) {
    try {
      const userLatitude = req.query.lat;
      const userLongitude = req.query.long;
      let pharmaciesWithDistance;
      let laboratoriesWithDistance;

      if (!userLatitude || !userLongitude) {
        throw new Error("Please provide both latitude and longitude");
      }

      const showPharmacies = req.query.showPharmacies;
      const showLabs = req.query.showLabs;
      const radius = 10000;

      let pharmacies;
      let laboratories;

      if (showPharmacies === "true") {
        let pharmacyQuery = {
          location: {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: [userLongitude, userLatitude],
              },
              $maxDistance: radius,
            },
          },
        };
        pharmacyQuery.blocked = false;
        pharmacies = await Pharmacy.find(pharmacyQuery);
        pharmaciesWithDistance = pharmacies.map((pharmacy) => {
          const longitude = pharmacy.location[0];
          const latitude = pharmacy.location[1];
          const pharmacyCoordinates = {
            latitude,
            longitude,
          };

          const distanceInMeters = geolib.getDistance(
            { latitude: userLatitude, longitude: userLongitude },
            pharmacyCoordinates
          );
          const distanceInKilometers = distanceInMeters / 1000; // Convert meters to kilometers
          return {
            pharmacy,
            distance: distanceInKilometers,
          };
        });
        return res.json(pharmaciesWithDistance);
      } else if (showLabs === "true") {
        const labQuery = {
          location: {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: [userLongitude, userLatitude],
              },
              $maxDistance: radius,
            },
          },
        };
        labQuery.blocked = false;
        laboratories = await Laboratory.find(labQuery);
        laboratoriesWithDistance = laboratories.map((laboratory) => {
          const longitude = laboratory.location[0];
          const latitude = laboratory.location[1];
          const laboratoryCoordinates = {
            latitude,
            longitude,
          };

          const distanceInMeters = geolib.getDistance(
            { latitude: userLatitude, longitude: userLongitude },
            laboratoryCoordinates
          );
          const distanceInKilometers = distanceInMeters / 1000; // Convert meters to kilometers
          return {
            laboratory,
            distance: distanceInKilometers,
          };
        });
        return res.json(laboratoriesWithDistance);
      }
    } catch (error) {
      next(error);
    }
  },

  async getAllRecords(req, res, next) {
    try {
      const patientId = req.user._id;
      const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
      const limit = parseInt(req.query.limit) || 30; // Default to 10 records per page

      // Count the total number of completed records
      const totalRecords = await Appointment.countDocuments({
        status: "completed",
        patientId,
      });

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalRecords / limit);

      // Calculate the number of records to skip based on the current page
      const skip = (page - 1) * limit;

      // Fetch the paginated completed records, sorted by creation date
      const latestRecords = await Appointment.find({
        status: "completed",
        patientId,
      })
        .populate({
          path: "treatmentId", // Populate treatment details
          populate: {
            path: "treatmentId", // Now populate the doctorId in the treatment
          },
        })
        .populate("patientId hospital doctorId")
        .sort({ createdAt: -1 }) // Sort by createdAt in descending order
        .skip(skip)
        .limit(limit);

      // Determine previous and next page numbers
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Check if no records were found
      // if (!latestRecords || latestRecords.length === 0) {
      //   return res.status(404).json({ message: "No records found" });
      // }

      // Return the paginated records with pagination details
      res.status(200).json({
        latestRecords,
        currentPage: page,
        totalPages,
        previousPage,
        nextPage,
        totalRecords,
      });
    } catch (error) {
      next(error);
    }
  },

  async saveTestResult(req, res, next) {
    try {
      const { resultUrl } = req.body;
      const { appointmentId } = req.query;

      // Fetch the appointment
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json([]); // Send empty response
      }

      const ePrescriptionId = appointment.ePrescription;

      // Fetch the ePrescription
      const prescription = await ePrescription.findById(ePrescriptionId);
      if (!prescription) {
        return res.status(404).json([]); // Send empty response
      }

      // Update the ePrescription with the new result URL
      const updatedPrescription = await ePrescription.findByIdAndUpdate(
        ePrescriptionId,
        {
          $set: { results: resultUrl }, // Use $set to update the results field
        },
        {
          new: true, // To return the updated document
        }
      );

      if (!updatedPrescription) {
        return res.status(404).json([]); // Send empty response
      }

      // Return a successful response
      return res.status(200).json({
        auth: true,
        message: "Result uploaded successfully!",
      });
    } catch (error) {
      return next(error);
    }
  },
  async downloadFile(req, res, next) {
    try {
      const appointmentId = req.query.appointmentId;
      const patientAppointments = await Appointment.findById(appointmentId)
        .populate({
          path: "patientId",
          select: "name email phone", // Specify the fields to select
        })
        .populate("doctorId", "name clinicName location.address") // Select only the doctor's name
        .populate({
          path: "hospital",
        })
        .populate("history")
        .populate({
          path: "ePrescription",
          populate: [
            {
              path: "doctorId",
              select: "name",
            },
            {
              path: "medicines",
              populate: {
                path: "medicineId",
                select: "generic productName tpPrice",
              },
            },
            {
              path: "test",
              populate: {
                path: "testId", // Populate testId within test
                select: "name description result", // Adjust based on your TestName schema
              },
            },
          ],
        });
      // Extracting patient's details
      const patient = patientAppointments.patientId;
      const patientName = patient.name;
      const patientEmail = patient.email;
      const patientPhone = patient.phone;

      // Extracting doctor's name
      const doctor = patientAppointments.doctorId;
      const doctorName = doctor ? doctor.name : "Unknown";
      const clinicName = doctor ? doctor.clinicName : "Unknown";
      const clinicAddress = doctor ? doctor.location.address : "Unknown";

      const doc = new PDFDocument();
      doc.fontSize(14).text(`Prescription for Patient: ${patientName}`, {
        align: "center",
      });

      // Adding patient details to the PDF document
      doc.fontSize(12).text(`Patient Name: ${patientName}`);
      doc.fontSize(12).text(`Patient Email: ${patientEmail}`);
      doc.fontSize(12).text(`Patient Phone: ${patientPhone}`);
      doc.fontSize(12).text(`Doctor Name: ${doctorName}`);
      doc.fontSize(12).text(`Clinic Name: ${clinicName}`);
      doc.fontSize(12).text(`Clinic Address: ${clinicAddress}`);

      // Check if ePrescription exists and has medicines/tests
      if (patientAppointments.ePrescription) {
        // Extracting medicines and tests from ePrescription
        const medicines = patientAppointments.ePrescription.medicines;
        const test = patientAppointments.ePrescription.test;

        // Adding medicines and tests to the PDF document
        if (medicines && medicines.length > 0) {
          doc.moveDown(); // Move down before listing medicines
          doc.fontSize(12).text("Medicines:");
          medicines.forEach((medicine, index) => {
            doc
              .fontSize(12)
              .text(
                `${index + 1}. ${medicine.medicineName || "Unknown"} - ` +
                  `Dosage: ${medicine.dosage || "N/A"}, ` +
                  `Quantity: ${medicine.quantity || "N/A"}, ` +
                  `Route: ${medicine.route || "N/A"}, ` +
                  `Frequency: ${medicine.frequency || "N/A"}, ` +
                  `Days: ${medicine.days || "N/A"}`
              );
          });
        }
        if (tests && tests.length > 0) {
          doc.moveDown(); // Move down before listing tests
          doc.fontSize(12).text("Tests:");
          tests.forEach((test, index) => {
            const testName = test.testId ? test.testId.name : "Unknown"; // Extract test name
            const testDescription = test.testId
              ? test.testId.description
              : "No description available"; // Extract test description
            const testResult =
              test.results && test.results.length > 0
                ? test.results.join(", ")
                : "No result available"; // Extract test results

            doc.text(
              `${
                index + 1
              }. Name: ${testName}, Description: ${testDescription}, Result: ${testResult}`
            );
          });
        }
      } else {
        doc.moveDown(); // Move down if no prescription details available
        doc.fontSize(12).text("Prescription details not available.");
      }

      // Add more content as needed

      // Set response headers to force download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=prescription_${appointmentId}.pdf`
      );

      // Pipe the PDF document directly to the response stream
      doc.pipe(res);
      doc.end();
    } catch (error) {
      return next(error);
    }
  },

  async getOpdDoc(req, res, next) {
    try {
      // Check for required query parameters
      if (req.query.isMeditour === undefined) {
        return res
          .status(400)
          .json({ message: "Missing required query parameter: isMeditour" });
      }

      let filter = {};

      // Check if the client specified isMeditour
      const isMeditour = req.query.isMeditour === "true"; // Convert string to boolean
      filter.isMeditour = isMeditour;
      filter.blocked = false;

      // Additional filter when isMeditour is false
      if (!isMeditour) {
        // Exclude doctors with doctorKind: 'paramedic'
        filter.doctorKind = { $ne: "paramedic" };

        // Exclude doctors with paidActivation: false
        filter.paidActivation = true;

        // Apply search by name if searchValue is provided
        if (req.query.searchValue) {
          const searchValue = req.query.searchValue.trim(); // Trim whitespace from the search value
          if (searchValue) {
            const regex = new RegExp(searchValue, "i"); // Case-insensitive regex
            filter.name = regex; // Search by name
          }
        }
      }

      // Pagination parameters
      const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
      const docPerPage = 30; // Docs per page

      // Count the total documents matching the filter
      const totalDocs = await Doctor.countDocuments(filter);

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalDocs / docPerPage);

      // Calculate the number of requests to skip based on the current page
      const skip = (page - 1) * docPerPage;

      // Query doctors based on the filter with pagination
      const doctors = await Doctor.find(filter).skip(skip).limit(docPerPage);

      // Calculate previous and next page values
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Return the doctors with pagination metadata
      return res.status(200).json({
        doctors,
        totalPages,
        totalDocs,
        previousPage,
        nextPage,
        auth: true,
      });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  },

  async getRefferal(req, res, next) {
    try {
      const patientId = req.user._id;
      const appointmentId = req.query.appointmentId;
      const referrals = await Referral.find({
        appointmentId,
        patientId,
      }).populate("appointmentId doctorId hospitalId specialityId");
      console.log("referrals", referrals);
      const referType = referrals[0].referType;
      console.log("referType", referType);
      let doctors;
      if (referType == "Hospital") {
        const hospitalId = referrals[0].hospitalId._id;
        console.log("hospitalId", hospitalId);
        doctors = await Doctor.find({
          "hospitalIds.hospitalId": { $in: [hospitalId] },
        });
      } else if (referType == "Specialities") {
        const specialityName = referrals[0].specialityId.specialityTitle;
        console.log("specialityName", specialityName);
        doctors = await Doctor.find({ speciality: { $in: [specialityName] } });
      }
      res.json({ referrals, doctors, auth: true });
    } catch (error) {
      next(error);
    }
  },
  async doctorRemainingPayment(req, res, next) {
    try {
      let {
        appointmentId,
        paidByUserAmount,
        processingFee,
        paymentId,
        gatewayName,
      } = req.body;

      const patientId = req.user._id;
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return res.status(404).json([]); // Send empty response
      }
      // Fetch user, doctor, and hospital details
      const user = await User.findById(patientId);
      const doctor = await Doctor.findById(appointment.doctorId); // Get doctorId from appointment
      const hospitalName = appointment.hospital
        ? await Hospital.findById(appointment.hospital)
        : null; // Get hospitalId from appointment
      let amount;
      if (gatewayName !== "blinq") {
        const userAmount = appointment.paidByUserAmount;
        const transactionFee = appointment.processingFee;
        amount = paidByUserAmount;
        const fee = processingFee;
        paidByUserAmount = userAmount + paidByUserAmount;
        processingFee = transactionFee + processingFee;
        appointment.paidByUserAmount = paidByUserAmount;
        appointment.processingFee = processingFee;
        appointment.isPaidFull = true;
      }

      let paymentIdArray = [];

      if (gatewayName === "stripe") {
        paymentIdArray.push({
          id: paymentId,
          status: "completed",
          createdAt: new Date(),
        });
      } else if (gatewayName === "blinq") {
        paymentIdArray.push({
          id: paymentId,
          status: "pending",
          createdAt: new Date(),
        });
      }
      appointment.paymentId.push(paymentIdArray[0]);
      await appointment.save();
      const idModelType = "Appointment";
      if (gatewayName !== "blinq") {
        const stripePaymentToRegister = new stripePaymentTransaction({
          id: appointmentId,
          idModelType,
          paymentId,
          gatewayName,
          paidByUserAmount: amount,
          isPaidFull: false,
        });
        const stripeController = await stripePaymentToRegister.save();

        // Notify admins
        const admins = await Admin.find(); // Adjust this to match your admin retrieval logic

        const notificationMessage =
          appointment.appointmentType === "hospital"
            ? `Payment of ${paidByUserAmount} received for ${
                hospitalName ? hospitalName.name : "Hospital"
              } (${appointment.appointmentType}) with Dr. ${doctor.name} from ${
                user.name
              }.`
            : `Payment of ${paidByUserAmount} received for Dr. ${doctor.name} (${appointment.appointmentType}) from ${user.name}.`;
        const adminNotifications = admins.map((admin) => ({
          senderId: patientId,
          senderModelType: "Users",
          receiverId: admin._id,
          receiverModelType: "Admin",
          title: "MediTour Global",
          message: notificationMessage,
        }));

        await Notification.insertMany(adminNotifications);

        admins.forEach((admin) => {
          sendchatNotification(
            admin._id,
            {
              title: "MediTour Global",
              message: notificationMessage,
            },
            "admin"
          );
        });
      }
      res.json({ appointment, auth: true });
    } catch (error) {
      next(error);
    }
  },
  async getDocListing(req, res, next) {
    try {
      const { hospitalId, doctorId, specialityId } = req.query;

      let doctors;

      if (hospitalId) {
        doctors = await Doctor.find({
          "hospitalIds.hospitalId": hospitalId,
        });
      } else if (doctorId) {
        doctors = await Doctor.findById(doctorId);
      } else if (specialityId) {
        const speciality = await Speciality.findById(specialityId);
        doctors = await Doctor.find({
          speciality: speciality.specialityTitle,
        });
      }

      res.status(200).json(doctors);
    } catch (error) {
      next(error);
    }
  },
  async addMedicineRequest(req, res, next) {
    try {
      const {
        medicineIds,
        doctorId,
        paymentId,
        paidByUserAmount,
        processingFee,
        totalAmount,
        gatewayName,
      } = req.body;
      const patientId = req.user._id;
      const requestId = await getNextRequestNo();
      let paymentIdArray = [];

      if (gatewayName === "stripe") {
        paymentIdArray.push({
          id: paymentId,
          status: "completed",
          createdAt: new Date(),
        });
      } else if (gatewayName === "blinq") {
        paymentIdArray.push({
          id: paymentId,
          status: "pending",
          createdAt: new Date(),
        });
      }
      const dollarAmount = await exchangeRateApi(totalAmount);
      const medicineRequest = new MedicineRequest({
        requestId,
        medicineIds,
        paymentId: paymentIdArray,
        doctorId,
        patientId,
        isPaidFull: true,
        paidByUserAmount,
        processingFee,
        totalAmount,
        dollarAmount,
        gatewayName,
      });

      // Save the new appointment to the database
      const savedRequest = await medicineRequest.save();
      const id = savedRequest._id;
      const idModelType = "MedicineRequest";
      if (gatewayName !== "blinq") {
        const stripePaymentToRegister = new stripePaymentTransaction({
          id,
          idModelType,
          paymentId,
          gatewayName,
          paidByUserAmount,
          isPaidFull: true,
        });
        const stripeController = await stripePaymentToRegister.save();
        const notificationMessage = `We have a new medicine request.`;
        const admins = await Admin.find({});
        const notifications = admins.map((admin) => ({
          senderId: patientId,
          senderModelType: "Users",
          receiverId: admin._id,
          receiverModelType: "Admin",
          title: "MediTour Global",
          message: notificationMessage,
          createdAt: new Date(), // Set the creation date for notifications
        }));

        // Insert notifications into the database in bulk for efficiency
        await Notification.insertMany(notifications);

        // Send chat notifications to all admins asynchronously
        admins.forEach((admin) => {
          sendchatNotification(
            admin._id,
            {
              title: "MediTour Global",
              message: notificationMessage,
            },
            "admin"
          );
        });
      }
      // await notifications.save();

      res.status(201).json({
        auth: true,
        medicineRequest: savedRequest,
      });
    } catch (error) {
      return next(error);
    }
  },

  async getTreatmentDocs(req, res, next) {
    try {
      const { treatmentId } = req.query;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 30) || 30;
      const skip = (page - 1) * limit;
      const treatmentIdObjectId = new mongoose.Types.ObjectId(treatmentId);

      // Aggregation pipeline to achieve count and paginated results in one call
      const pipeline = [
        {
          $match: { treatmentId: treatmentIdObjectId }, // Match the treatmentId
        },
        {
          $lookup: {
            from: "doctors", // Replace with the actual doctors collection name
            localField: "doctorId",
            foreignField: "_id",
            as: "doctor",
            pipeline: [
              { $match: { paidActivation: true, blocked: false } }, // Filter for active doctors within lookup
            ],
          },
        },
        {
          $unwind: "$doctor", // Unwind the doctor array (might be empty for no matches)
        },
        {
          $project: {
            _id: 0, // Exclude unnecessary _id field
            treatmentId: 1,
            totalAmount: 1,
            createdAt: 1,
            updatedAt: 1,
            doctor: 1, // Include the filtered doctor object
          },
        },
        { $sort: { createdAt: -1 } }, // Optional: Sort by creation date (descending)
        { $skip: skip },
        { $limit: limit },
      ];

      // Execute the aggregation pipeline
      const results = await BookTreatment.aggregate(pipeline);

      // Extract data from results
      const doctors = results;
      const doctorCount = results.length; // Total count is the length of the results

      // Calculate total pages
      const totalPages = Math.ceil(doctorCount / limit);

      // Determine the previous and next pages
      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Send the response as a single object
      res.json({
        doctors,
        doctorCount,
        previousPage,
        nextPage,
        totalPages,
        currentPage: page,
      });
    } catch (error) {
      next(error);
    }
  },

  async getCategoryDocs(req, res, next) {
    try {
      const name = req.query.name;
      const page = parseInt(req.query.page, 10) || 1; // Default to page 1
      const limit = parseInt(req.query.limit, 10) || 30; // Default to 30 items per page

      const skip = (page - 1) * limit;

      // Fetch category or subcategory directly using the provided name
      const category = await Category.findOne({ categoryName: name }).select(
        "_id"
      );
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }

      const treatments = await Treatment.find({
        $or: [{ subCategory: name }, { categoryId: category._id }],
      }).select("_id");

      if (treatments.length === 0) {
        return res.status(404).json({});
      }

      const treatmentIdsArray = treatments.map((item) => item._id);

      // Fetch doctors with pagination and paid activation filter
      const doctors = await BookTreatment.find({
        treatmentId: { $in: treatmentIdsArray },
        // "doctorId.paidActivation": true,
      })
        .populate("treatmentId")
        .populate({
          path: "doctorId", // Populating doctorId
          match: { paidActivation: true },
        }) // Filter only doctors with paidActivation = true
        .skip(skip)
        .limit(limit);

      const filteredDoctors = doctors.filter((doc) => doc.doctorId); // Remove null results from failed matches

      // Count total distinct doctors
      const totalDistinctDoctors = await BookTreatment.aggregate([
        {
          $match: {
            treatmentId: { $in: treatmentIdsArray },
          },
        },
        {
          $lookup: {
            from: "doctors", // Collection name for Doctor
            localField: "doctorId",
            foreignField: "_id",
            as: "doctor",
          },
        },
        {
          $unwind: "$doctor",
        },
        {
          $match: {
            "doctor.paidActivation": true,
          },
        },
        {
          $group: {
            _id: "$doctorId", // Group by unique doctorId
          },
        },
        {
          $count: "totalDoctors",
        },
      ]);

      const totalDoctorsCount =
        totalDistinctDoctors.length > 0
          ? totalDistinctDoctors[0].totalDoctors
          : 0;

      // // Calculate total items and total pages
      // const totalItems = await BookTreatment.countDocuments({
      //   treatmentId: { $in: treatmentIdsArray },
      //   "doctorId.paidActivation": true,
      // });

      const totalPages = Math.ceil(totalDoctorsCount / limit);

      const previousPage = page > 1 ? page - 1 : null;
      const nextPage = page < totalPages ? page + 1 : null;

      // Send response with pagination details and total distinct doctors
      res.json({
        page,
        limit,
        previousPage,
        nextPage,
        totalItems: totalDoctorsCount,
        totalPages,
        totalDoctors: totalDoctorsCount,
        doctors: filteredDoctors,
      });
    } catch (error) {
      console.error("Error in getCategoryDocs:", error.message);
      next(error);
    }
  },

  async getSubCategories(req, res, next) {
    try {
      const categoryId = req.query.categoryId;
      let categoryName = req.query.categoryName || "";

      // **Fix: Decode and Escape Special Characters (e.g., `&`)**
      categoryName = decodeURIComponent(categoryName).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      // Initialize an empty query object
      const query = {};

      // Add categoryId to the query if provided
      if (categoryId) {
        query.categoryId = categoryId;
      }

      // Fetch subcategories based on the constructed query
      const subCategories = await Treatment.find(query).populate({
        path: "categoryId",
        select: "categoryName",
      });

      // **Filter unwanted results and apply case-insensitive search**
      const filteredSubCategories = subCategories.filter((subCategory) => {
        if (!subCategory.categoryId) return false; // Remove null categoryId

        // **Fix: Use Case-Insensitive Partial Match for categoryName**
        const matchesCategoryName = categoryName
          ? new RegExp(categoryName, "i").test(
              subCategory.categoryId.categoryName
            )
          : true;

        return matchesCategoryName;
      });

      res.json(filteredSubCategories);
    } catch (error) {
      next(error);
    }
  },

  async addConsultancyForm(req, res, next) {
    try {
      const orderSchema = Joi.object({
        name: Joi.string().required(),
        phone: Joi.string().required(),
        email: Joi.string(),
        treatment: Joi.array().required(),
        message: Joi.string(),
      });

      const { error } = orderSchema.validate(req.body);
      const { name, phone, email, treatment, message } = req.body;
      const patientId = req.user._id;

      const freeConsultancy = new FreeConsultancy({
        patientId,
        name,
        phone,
        email,
        treatment,
        message,
      });

      // Save the new appointment to the database
      const savedConsultancy = await freeConsultancy.save();
      res.status(201).json({
        auth: true,
        freeConsultancy: savedConsultancy,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = userLabController;
