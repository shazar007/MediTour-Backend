const Joi = require("joi");
const User = require("../../models/User/user");
const bcrypt = require("bcryptjs");
const UserDTO = require("../../dto/user.js");
const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");
const AmbulanceBooking = require("../../models/Ambulance/booking.js");
const HotelBooking = require("../../models/Hotel/bookhotel.js");
const InsuranceBooking = require("../../models/Insurance/insuranceBooking.js");
const RentCarBooking = require("../../models/Rent A Car/acceptedRequests.js");
const TravelBooking = require("../../models/Travel Agency/booking.js");
const OPDRequest = require("../../models/All Doctors Models/opdRequest.js");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;
const { sendchatNotification } = require("../../firebase/service");

async function getNextMrNo() {
  // Find the latest user in the database and get their mrNo
  const latestUser = await User.findOne()
    .sort({ createdAt: -1 })
    .select("mrNo");

  // If there are no users yet, start with "000001"
  const nextMrNo = latestUser
    ? String(Number(latestUser.mrNo) + 1).padStart(6, "0")
    : "000001";

  return nextMrNo;
}
const authController = {
  async register(req, res, next) {
    const userRegisterSchema = Joi.object({
      name: Joi.string().required(),
      spouseOrGuardianName: Joi.string().allow("").optional(),
      phone: Joi.string().required(),
      email: Joi.string().required(),
      password: Joi.string().pattern(passwordPattern).required().messages({
        "string.pattern.base":
          "Must include 1 uppercase, 1 special character and 1 digit.",
      }),
    });

    const { error } = userRegisterSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const { name, spouseOrGuardianName, phone, email, password } = req.body;

    try {
      // Check if email already exists
      const emailRegex = new RegExp(email, "i");
      const emailExists = await User.findOne({ email: { $regex: emailRegex } });

      if (emailExists) {
        return next({
          status: 409,
          message: "Email already registered",
        });
      }

      // Generate mrNo
      const mrNo = await getNextMrNo();

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new user
      const userToRegister = new User({
        name,
        spouseOrGuardianName,
        phone,
        email,
        password: hashedPassword,
        mrNo,
        auth_provider: "conventional",
      });

      const user = await userToRegister.save();

      // Generate tokens
      const accessToken = JWTService.signAccessToken({ _id: user._id }, "365d");
      const refreshToken = JWTService.signRefreshToken(
        { _id: user._id },
        "365d"
      );

      await JWTService.storeRefreshToken(refreshToken, user._id);
      await JWTService.storeAccessToken(accessToken, user._id);

      // Send response
      return res.status(201).json({ user, auth: true, token: accessToken });
    } catch (error) {
      return next(error);
    }
  },

  async googleAuth(req, res, next) {
    const googleAuthSchema = Joi.object({
      oauth_id: Joi.string().required(),
      name: Joi.string().optional(),
      email: Joi.string().required(),
      userImage: Joi.string().allow(""),
      fcmToken: Joi.string().allow(""),
    });

    const { error } = googleAuthSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { oauth_id, name, email, userImage, fcmToken } = req.body;

    try {
      let user = await User.findOne({ email });

      if (user) {
        if (user.auth_provider === "conventional") {
          user.auth_provider = "google";
          user.oauth_id = oauth_id;

          if (!user.userImage && userImage) user.userImage = userImage;
          if (fcmToken) user.fcmToken = fcmToken;

          await user.save();
        } else if (user.auth_provider === "google") {
          if (fcmToken && user.fcmToken !== fcmToken) {
            user.fcmToken = fcmToken;
            await user.save();
          }
        }
      } else {
        const mrNo = await getNextMrNo();

        user = new User({
          name,
          email,
          userImage,
          auth_provider: "google",
          oauth_id,
          mrNo,
          fcmToken,
        });

        await user.save();
      }

      if (user.blocked) {
        return next({
          status: 403,
          message: "User is deleted.",
        });
      }

      const accessToken = JWTService.signAccessToken({ _id: user._id }, "365d");
      const refreshToken = JWTService.signRefreshToken(
        { _id: user._id },
        "365d"
      );

      await JWTService.storeRefreshToken(refreshToken, user._id);
      await JWTService.storeAccessToken(accessToken, user._id);

      const userDto = new UserDTO(user);

      return res.status(200).json({
        user: userDto,
        auth: true,
        token: accessToken,
      });
    } catch (err) {
      return next(err);
    }
  },

  async login(req, res, next) {
    const userLoginSchema = Joi.object({
      email: Joi.string().required(),
      password: Joi.string().required(),
      fcmToken: Joi.string(),
    });

    const { error } = userLoginSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const { email, password, fcmToken } = req.body;

    let user;

    try {
      // match username
      const emailRegex = new RegExp(email, "i");
      user = await User.findOne({ email: { $regex: emailRegex } });
      console.log("user", user);

      if (!user) {
        const error = {
          status: 400,
          message: "Incorrect email or password!",
        };

        return next(error);
      } else if (!user.password) {
        const error = {
          status: 400,
          message: `Please use Google Sign-In and then go to My Profile to set the new password.`,
        };

        return next(error);
      } else {
        //update fcmToken
        if (fcmToken && user?.fcmToken !== fcmToken) {
          Object.keys(user).map((key) => (user["fcmToken"] = fcmToken));

          let update = await user.save();
        } else {
          console.log("same Token");
        }
      }
      if (user.blocked == true) {
        const error = {
          status: 403,
          message: "User is Deleted",
        };

        return next(error);
      }

      // match password

      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        const error = {
          status: 400,
          message: "Incorrect email or password.",
        };

        return next(error);
      }
    } catch (error) {
      return next(error);
    }

    const accessToken = JWTService.signAccessToken({ _id: user._id }, "365d");
    const refreshToken = JWTService.signRefreshToken({ _id: user._id }, "365d");
    // update refresh token in database
    try {
      await RefreshToken.updateOne(
        {
          userId: user._id,
        },
        { token: refreshToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    try {
      await AccessToken.updateOne(
        {
          userId: user._id,
        },
        { token: accessToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    const userDto = new UserDTO(user);
    // sendchatNotification(
    //   user._id,
    //   {
    //     title: "MediTour",
    //     message: `${user?.name} this is test message`,
    //   },
    //   "user"
    // );

    return res.status(200).json({ user: user, auth: true, token: accessToken });
  },

  async logout(req, res, next) {
    const userId = req.user._id;
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    try {
      await RefreshToken.deleteOne({ userId });
      await AccessToken.deleteOne({ token: accessToken });
      await User.findByIdAndUpdate(userId, { $unset: { fcmToken: "" } });

      res.status(200).json({ user: null, auth: false });
    } catch (error) {
      return next(error);
    }
  },

  async addAddress(req, res, next) {
    try {
      const userId = req.user._id; // Getting the userId from the authenticated user
      const { address, city } = req.body;
      const lat = parseFloat(req.body.lat);
      const lng = parseFloat(req.body.lng);
      const addressId = req.query.addressId;

      // Find the user by userId
      const user = await User.findById(userId);

      const isDuplicate = user.addresses.some(
        (add) => add.lat === lat && add.lng === lng
      );
      if (isDuplicate) {
        return res.status(400).json({ message: "Address Already Exists" });
      }
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if addressId is provided for updating an existing address
      if (addressId) {
        const index = user.addresses.findIndex((add) => add._id == addressId);
        if (index === -1) {
          return res
            .status(404)
            .json({ message: "Address not found against given addressId!" });
        }

        // Update existing address
        user.addresses[index] = { _id: addressId, lat, lng, address, city };
      } else {
        // Check if the new address is unique (both lat and lng)

        // Add the new address to the user's addresses array
        user.addresses.push({ lat, lng, address, city });
      }

      // Save the updated user
      await user.save();

      return res
        .status(200)
        .json({ message: "Address added successfully", user });
    } catch (error) {
      console.error("Error adding address:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async getAllBooking(req, res, next) {
    try {
      const userId = req.user._id;
      const bookingType = req.query.type;

      // Pagination parameters
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const bookingsPerPage = 10; // Default to 10 bookings per page
      const skip = (page - 1) * bookingsPerPage; // Calculate how many documents to skip

      // Map booking types to their corresponding models
      const bookingModels = {
        ambulance: AmbulanceBooking,
        hotel: HotelBooking,
        insurance: InsuranceBooking,
        rentcar: RentCarBooking,
        travel: TravelBooking,
        flight: TravelBooking,
        tour: TravelBooking,
      };

      const BookingModel = bookingModels[bookingType.toLowerCase()];

      if (!BookingModel) {
        return res.status(400).json({ message: "Invalid booking type" });
      }

      let bookings;
      let totalBookings;

      try {
        // Fetch bookings based on type and userId
        switch (bookingType.toLowerCase()) {
          case "ambulance":
            bookings = await AmbulanceBooking.find({ userId })
              .populate("bidRequestId requestId ambulanceId")
              .sort({ createdAt: -1 })
              .skip(skip)
              .limit(bookingsPerPage);
            totalBookings = await AmbulanceBooking.countDocuments({ userId });
            break;
          case "hotel":
            bookings = await HotelBooking.find({ userId })
              .populate("hotelId serviceId")
              .sort({ createdAt: -1 })
              .skip(skip)
              .limit(bookingsPerPage);
            totalBookings = await HotelBooking.countDocuments({ userId });
            break;
          case "insurance":
            bookings = await InsuranceBooking.find({ userId })
              .populate("insuranceCompanyId insuranceId")
              .sort({ createdAt: -1 })
              .skip(skip)
              .limit(bookingsPerPage);
            totalBookings = await InsuranceBooking.countDocuments({ userId });
            break;
          case "rentcar":
            bookings = await RentCarBooking.find({ userId })
              .populate("rentACarId vehicleId")
              .sort({ createdAt: -1 })
              .skip(skip)
              .limit(bookingsPerPage);
            totalBookings = await RentCarBooking.countDocuments({ userId });
            break;
          case "travel":
            bookings = await TravelBooking.find({ userId })
              .populate("bidRequestId requestId tourId agencyId")
              .sort({ createdAt: -1 })
              .skip(skip)
              .limit(bookingsPerPage);
            totalBookings = await TravelBooking.countDocuments({ userId });
            break;
          case "flight":
            bookings = await TravelBooking.find({
              userId,
              requestType: "flight",
            })
              .populate("bidRequestId requestId tourId agencyId")
              .sort({ createdAt: -1 })
              .skip(skip)
              .limit(bookingsPerPage);
            totalBookings = await TravelBooking.countDocuments({
              userId,
              requestType: "flight",
            });
            break;
          case "tour":
            bookings = await TravelBooking.find({ userId, requestType: "tour" })
              .populate("tourId")
              .sort({ createdAt: -1 })
              .skip(skip)
              .limit(bookingsPerPage);
            totalBookings = await TravelBooking.countDocuments({
              userId,
              requestType: "tour",
            });

            // Calculate remaining seats for each tour booking
            bookings = bookings.map((tourBooking) => {
              const tour = tourBooking.tourId || {};
              const limitedSeats = tour.limitedSeats ?? 0;
              const bookedSeats = tour.bookedSeats ?? 0;
              const remainingSeats = limitedSeats - bookedSeats;

              return {
                ...tourBooking.toObject(),
                remainingSeats,
              };
            });
            break;
          default:
            return res.status(400).json({ message: "Invalid booking type" });
        }
        console.log("totalBookings", totalBookings);
        const totalPages = Math.ceil(totalBookings / bookingsPerPage); // Calculate total pages

        // Determine previous and next page
        const previousPage = page > 1 ? page - 1 : null;
        const nextPage = page < totalPages ? page + 1 : null;

        res.status(200).json({
          bookings,
          totalBookings,
          totalPages,
          currentPage: page,
          previousPage,
          nextPage,
        });
      } catch (error) {
        console.error("Error fetching bookings:", error); // Log error
        return next(error);
      }
    } catch (error) {
      console.error("Unexpected error:", error); // Log unexpected errors
      next(error);
    }
  },

  async updateProfile(req, res, next) {
    const userSchema = Joi.object({
      name: Joi.string().allow(""),
      gender: Joi.string().allow(""),
      spouseOrGuardianName: Joi.string().allow(""),
      childCount: Joi.string().allow(""),
      email: Joi.string().allow(""),
      cnicOrPassNo: Joi.string().allow(""),
      bloodGroup: Joi.string().allow(""),
      city: Joi.string().allow(""),
      country: Joi.string().allow(""),
      qualification: Joi.string().allow(""),
      bankName: Joi.string().allow(""),
      accountHolderName: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      ntnNo: Joi.string().allow(""),
      facebook: Joi.string().allow(""),
      instagram: Joi.string().allow(""),
      linkedin: Joi.string().allow(""),
      youtube: Joi.string().allow(""),
      mrNo: Joi.string().allow(""),
      phone: Joi.string().allow(""),
      dateOfBirth: Joi.string().allow(""),
      userImage: Joi.string().allow(""),
      address: Joi.object().allow(""),
      currentPassword: Joi.string(),
      password: Joi.string().pattern(passwordPattern).messages({
        "string.pattern.base":
          "Password must be 8-25 characters long and include at least one lowercase letter, one uppercase letter, one digit, and one special character.",
      }),
    });

    const { error } = userSchema.validate(req.body);

    if (error) {
      return next(error);
    }
    const {
      name,
      gender,
      spouseOrGuardianName,
      childCount,
      cnicOrPassNo,
      bloodGroup,
      city,
      email,
      country,
      qualification,
      bankName,
      accountHolderName,
      accountNumber,
      ntnNo,
      facebook,
      instagram,
      linkedin,
      youtube,
      mrNo,
      phone,
      dateOfBirth,
      userImage,
      address,
      currentPassword,
      password,
    } = req.body;
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      const error = new Error("User not found!");
      error.status = 404;
      return next(error);
    }

    // Check if only one of currentPassword or password is provided
    if (!phone) {
      if ((currentPassword && !password) || (!currentPassword && password)) {
        return res.status(400).json({
          status: 400,
          message:
            "Both current password and new password are required together",
        });
      }
    }

    // Phone number update logic
    // if (phone && phone !== user.phone) {
    //   if (!currentPassword) {
    //     return res.status(400).json({
    //       status: 400,
    //       message: "Current password is required to update the phone number",
    //     });
    //   }

    //   const match = await bcrypt.compare(currentPassword, user.password);
    //   if (!match) {
    //     return res.status(401).json({
    //       status: 401,
    //       message: "Current password does not match the previous password",
    //     });
    //   }
    // }

    // Password update logic
    if (currentPassword && password) {
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        return res.status(401).json({
          status: 401,
          message: "Invalid current password",
        });
      }

      if (currentPassword === password) {
        return res.status(400).json({
          status: 400,
          message: "New password must be different from the current password",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;

      // Re-validation of the new password after update
      const reMatch = await bcrypt.compare(password, user.password);
      if (!reMatch) {
        return res.status(401).json({
          status: 401,
          message: "Password mismatch after update",
        });
      }
    }

    // Update only the provided fields
    if (
      req.body.hasOwnProperty("name") &&
      req.body.name !== undefined &&
      req.body.name.trim() !== ""
    ) {
      user.name = req.body.name;
    }
    if (
      req.body.hasOwnProperty("gender") &&
      req.body.gender !== undefined &&
      req.body.gender.trim() !== ""
    ) {
      user.gender = req.body.gender; // Update city only if the field is present and the new value is not empty
    }
    if (
      req.body.hasOwnProperty("spouseOrGuardianName") &&
      req.body.spouseOrGuardianName !== undefined &&
      req.body.spouseOrGuardianName.trim() !== ""
    ) {
      user.spouseOrGuardianName = req.body.spouseOrGuardianName; // Update city only if the field is present and the new value is not empty
    }

    if (
      req.body.hasOwnProperty("childCount") &&
      req.body.childCount !== undefined &&
      req.body.childCount.trim() !== ""
    ) {
      user.childCount = req.body.childCount; // Update city only if the field is present and the new value is not empty
    }

    if (
      req.body.hasOwnProperty("cnicOrPassNo") &&
      req.body.cnicOrPassNo !== undefined &&
      req.body.cnicOrPassNo.trim() !== ""
    ) {
      user.cnicOrPassNo = req.body.cnicOrPassNo; // Update city only if the field is present and the new value is not empty
    }
    if (
      req.body.hasOwnProperty("bloodGroup") &&
      req.body.bloodGroup !== undefined &&
      req.body.bloodGroup.trim() !== ""
    ) {
      user.bloodGroup = req.body.bloodGroup; // Update city only if the field is present and the new value is not empty
    }
    if (
      req.body.hasOwnProperty("city") &&
      req.body.city !== undefined &&
      req.body.city.trim() !== ""
    ) {
      user.city = req.body.city; // Update city only if the field is present and the new value is not empty
    }
    if (
      req.body.hasOwnProperty("country") &&
      req.body.country !== undefined &&
      req.body.country.trim() !== ""
    ) {
      user.country = req.body.country; // Update city only if the field is present and the new value is not empty
    }
    if (
      req.body.hasOwnProperty("email") &&
      req.body.email !== undefined &&
      req.body.email.trim() !== ""
    ) {
      user.email = req.body.email; // Update city only if the field is present and the new value is not empty
    }
    if (
      req.body.hasOwnProperty("qualification") &&
      req.body.qualification !== undefined &&
      req.body.qualification.trim() !== ""
    ) {
      user.qualification = req.body.qualification; // Update city only if the field is present and the new value is not empty
    }
    if (
      req.body.hasOwnProperty("bankName") &&
      req.body.bankName !== undefined
    ) {
      user.bankName = req.body.bankName;
    }
    if (
      req.body.hasOwnProperty("accountHolderName") &&
      req.body.accountHolderName !== undefined
    ) {
      user.accountHolderName = req.body.accountHolderName;
    }
    if (
      req.body.hasOwnProperty("accountNumber") &&
      req.body.accountNumber !== undefined
    ) {
      user.accountNumber = req.body.accountNumber;
    }
    if (req.body.hasOwnProperty("ntnNo") && req.body.ntnNo !== undefined) {
      user.ntnNo = req.body.ntnNo;
    }

    if (
      req.body.hasOwnProperty("facebook") &&
      req.body.facebook !== undefined
    ) {
      user.facebook = req.body.facebook;
    }
    if (
      req.body.hasOwnProperty("instagram") &&
      req.body.instagram !== undefined
    ) {
      user.instagram = req.body.instagram;
    }
    if (
      req.body.hasOwnProperty("linkedin") &&
      req.body.linkedin !== undefined
    ) {
      user.linkedin = req.body.linkedin;
    }
    if (req.body.hasOwnProperty("youtube") && req.body.youtube !== undefined) {
      user.youtube = req.body.youtube;
    }
    if (
      req.body.hasOwnProperty("mrNo") &&
      req.body.mrNo !== undefined &&
      req.body.mrNo.trim() !== ""
    ) {
      user.mrNo = req.body.mrNo; // Update city only if the field is present and the new value is not empty
    }
    if (
      req.body.hasOwnProperty("phone") &&
      req.body.phone !== undefined &&
      req.body.phone.trim() !== ""
    ) {
      user.phone = req.body.phone; // Update city only if the field is present and the new value is not empty
    }

    if (
      req.body.hasOwnProperty("dateOfBirth") &&
      req.body.dateOfBirth !== undefined &&
      req.body.dateOfBirth.trim() !== ""
    ) {
      user.dateOfBirth = req.body.dateOfBirth; // Update city only if the field is present and the new value is not empty
    }

    if (
      req.body.hasOwnProperty("userImage") &&
      req.body.userImage !== undefined &&
      req.body.userImage.trim() !== ""
    ) {
      user.userImage = req.body.userImage; // Update city only if the field is present and the new value is not empty
    }

    if (
      req.body.hasOwnProperty("address") &&
      req.body.address !== undefined &&
      Object.keys(req.body.address).length > 0 // Check if address is not an empty object
    ) {
      user.address = req.body.address; // Update address if it's present and not empty
    }
    // Save the updated user
    await user.save();

    return res.status(200).json({
      message: "User updated successfully",
      user: user,
    });
  },

  async authCheck(req, res, next) {
    try {
      const authHeader = req.headers["authorization"];
      const accessToken = authHeader && authHeader.split(" ")[1];
      const ifTokenExists = await AccessToken.find({ token: accessToken });
      console.log("ifTokenExists", ifTokenExists);
      if (ifTokenExists == "") {
        return res.json({ status: false });
      }
      console.log("accessToken", accessToken);
      if (!accessToken) {
        return res.json({ status: false });
      }
      return res.json({ status: true });
    } catch (error) {
      next(error);
    }
  },

  async addPassword(req, res, next) {
    const updatePasswordSchema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().pattern(passwordPattern).required().messages({
        "string.pattern.base":
          "Must include 1 uppercase, 1 special character and 1 digit.",
      }),
    });

    const { error } = updatePasswordSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) {
        return next({
          status: 404,
          message: "User not found with this email.",
        });
      }

      // Hash the new password before saving
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update the user document with the new password
      user.password = hashedPassword;

      // Save the updated user document
      await user.save();

      return res.status(200).json({
        message: "Password updated successfully.",
        user: user,
      });
    } catch (error) {
      return next(error);
    }
  },

  async opdRequest(req, res, next) {
    const opdRequestSchema = Joi.object({
      name: Joi.string().required(),
      phone: Joi.string().required(),
      email: Joi.string().email().allow(""),
      message: Joi.string().allow(""),
    });

    const { error } = opdRequestSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    // Destructure and filter empty strings
    let { name, phone, email, message } = req.body;

    const payload = { name, phone };

    if (email && email.trim() !== "") {
      payload.email = email;
    }

    if (message && message.trim() !== "") {
      payload.message = message;
    }

    const opdRequest = await OPDRequest.create(payload);

    return res
      .status(200)
      .json({ message: "OPD request sent successfully.", opdRequest });
  },
};

module.exports = authController;
