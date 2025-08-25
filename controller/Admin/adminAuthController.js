const Joi = require("joi");
const bcrypt = require("bcryptjs");
const AdminDTO = require("../../dto/admin.js");
const JWTService = require("../../services/JWTService.js");
const RefreshToken = require("../../models/token.js");
const AccessToken = require("../../models/accessToken.js");

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?/\\|-])[a-zA-Z\d!@#$%^&*()_+{}\[\]:;<>,.?/\\|-]{8,25}$/;

const { sendchatNotification } = require("../../firebase/service");
const Admin = require("../../models/Admin/Admin.js");

const adminAuthController = {
  async register(req, res, next) {
    const adminRegisterSchema = Joi.object({
      name: Joi.string().required(),
      email: Joi.string().required(),
      phone: Joi.string().required(),
      password: Joi.string()
        .pattern(passwordPattern)
        .message("Must include 1 uppercase, 1 special character and 1 digit.")
        .required(),
      fcmToken: Joi.string(),
    });

    const { error } = adminRegisterSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const { name, email, phone, password, fcmToken } = req.body;
    const emailRegex = new RegExp(email, "i");
    const emailExists = await Admin.findOne({ email: { $regex: emailRegex } });

    if (emailExists) {
      const error = {
        status: 409,
        message: "Email Already Registered",
      };

      return next(error);
    }

    let accessToken;
    let refreshToken;
    const hashedPassword = await bcrypt.hash(password, 10);

    let admin;
    try {
      const adminToRegister = new Admin({
        name,
        email,
        phone,
        password: hashedPassword,
        fcmToken,
      });

      admin = await adminToRegister.save();

      // Token generation
      accessToken = JWTService.signAccessToken({ _id: admin._id }, "365d");
      refreshToken = JWTService.signRefreshToken({ _id: admin._id }, "365d");
    } catch (error) {
      return next(error);
    }
    await JWTService.storeRefreshToken(refreshToken, admin._id);
    await JWTService.storeAccessToken(accessToken, admin._id);

    // Response send
    return res.status(201).json({ admin, auth: true, token: accessToken });
  },

  async login(req, res, next) {
    const adminLoginSchema = Joi.object({
      email: Joi.string().required(),
      password: Joi.string(),
      fcmToken: Joi.string(),
    });

    const { error } = adminLoginSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    const { email, password, fcmToken } = req.body;

    let admin;
    try {
      // match adminname
      const emailRegex = new RegExp(email, "i");
      admin = await Admin.findOne({ email: { $regex: emailRegex } });

      if (!admin) {
        const error = {
          status: 400,
          message: "Incorrect email or password.",
        };

        return next(error);
      } else {
        //update fcmToken
        if (fcmToken && admin?.fcmToken !== fcmToken) {
          Object.keys(admin).map((key) => (admin["fcmToken"] = fcmToken));

          let update = await admin.save();
        } else {
          console.log("same Token");
        }
      }
      if (admin.isVerified == false) {
        const error = {
          status: 403,
          message: "Admin not verified",
        };

        return next(error);
      }

      // match password

      const match = await bcrypt.compare(password, admin.password);

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

    const accessToken = JWTService.signAccessToken({ _id: admin._id }, "365d");
    const refreshToken = JWTService.signRefreshToken(
      { _id: admin._id },
      "365d"
    );
    // update refresh token in database
    try {
      await RefreshToken.updateOne(
        {
          adminId: admin._id,
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
          userId: admin._id,
        },
        { token: accessToken },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }

    const adminDto = new AdminDTO(admin);

    return res
      .status(200)
      .json({ admin: adminDto, auth: true, token: accessToken });
  },

  async logout(req, res, next) {
    const adminId = req.user._id;
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];

    try {
      await RefreshToken.deleteOne({ adminId });
      await AccessToken.deleteOne({ token: accessToken });
      await Admin.findByIdAndUpdate(adminId, { $unset: { fcmToken: "" } });

      res.status(200).json({ admin: null, auth: false });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = adminAuthController;
