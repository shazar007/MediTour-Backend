const JWTService = require("../services/JWTService");
const User = require("../models/User/user");
const labDto = require("../dto/lab");
const pharmDto = require("../dto/pharm");
const docDto = require("../dto/doctor");
const hospDto = require("../dto/hospital");
const ambulanceDto = require("../dto/ambulanceCompany");
const agencyDto = require("../dto/travel agency/travelAgency");
const rentCarDTO = require("../dto/rentCar");

const auth = async (req, res, next) => {
  try {
    // 1. refresh, access token validation
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];
    const ifTokenExists = await AccessToken.find({ token: accessToken });
    if (!accessToken) {
      console.log("thisthis");
      const error = {
        status: 401,
        message: "Unauthorized",
      };

      return next(error);
    }
    if (ifTokenExists == "") {
      console.log("this");
      const error = {
        status: 401,
        message: "Your session has ended. Please log in again to continue",
      };
      return next(error);
    }
    console.log("company");

    let _id;

    try {
      _id = JWTService.verifyAccessToken(accessToken)._id;
      console.log("_id", _id);
    } catch (error) {
      return next(error);
    }
    let user;
    if (req.originalUrl.includes("/lab")) {
      try {
        user = await Laboratory.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const LabDto = new labDto(user);

      req.user = LabDto;

      next();
      return;
    } else if (req.originalUrl.includes("/pharmaceu")) {
      try {
        user = await Pharmaceutical.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const PharmaceuticalDto = new pharmaceuticalDto(user);

      req.user = PharmaceuticalDto;
      req.user = user;
      next();
      return;
    } else if (req.originalUrl.includes("/pharm")) {
      try {
        user = await Pharmacy.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const PharmDto = new pharmDto(user);

      req.user = PharmDto;
      next();
      return;
    } else if (req.originalUrl.includes("/docCompany")) {
      try {
        console.log("dfghjk");
        user = await DocCompany.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const userDto = new docCompanyDto(user);

      req.user = userDto;

      next();
      return;
    } else if (req.originalUrl.includes("/doc")) {
      try {
        user = await Doctor.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const docDTO = new docDto(user);

      req.user = docDTO;

      next();
      return;
    } else if (req.originalUrl.includes("/hosp")) {
      try {
        user = await Hospital.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const hospDTO = new hospDto(user);

      req.user = hospDTO;

      next();
      return;
    } else if (req.originalUrl.includes("/ambulance")) {
      try {
        user = await AmbulanceCompany.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }

      const ambulanceDTO = new ambulanceDto(user);

      req.user = ambulanceDTO;

      next();
      return;
    } else if (req.originalUrl.includes("/physio")) {
      try {
        user = await Physiotherapist.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const physioDTO = new physioDto(user);

      req.user = physioDTO;

      next();
      return;
    } else if (req.originalUrl.includes("/nutritionist")) {
      try {
        user = await Nutritionist.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const nutritionistDTO = new nutritionistDto(user);

      req.user = nutritionistDTO;

      next();
      return;
    } else if (req.originalUrl.includes("/paramedic")) {
      try {
        user = await Paramedic.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const paramedicDTO = new paramedicDto(user);

      req.user = paramedicDTO;

      next();
      return;
    } else if (req.originalUrl.includes("/psychologist")) {
      try {
        user = await Psychologist.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const psychologistDTO = new psychologistDto(user);

      req.user = psychologistDTO;

      next();
      return;
    } else if (req.originalUrl.includes("/agency")) {
      try {
        user = await Agency.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const agencyDTO = new agencyDto(user);

      req.user = agencyDTO;

      next();
      return;
    } else if (req.originalUrl.includes("/payment")) {
      try {
        user = await paymentToVendors.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }

      next();
      return;
    } else if (req.originalUrl.includes("/rentCar")) {
      try {
        user = await RentCar.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const rentCarDto = new rentCarDTO(user);

      req.user = rentCarDto;

      next();
      return;
    } else if (req.originalUrl.includes("/donation")) {
      try {
        user = await Donation.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const donationDto = new donationDTO(user);

      req.user = donationDto;

      next();
      return;
    } else if (req.originalUrl.includes("/hotel")) {
      try {
        user = await Hotel.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const hotelDto = new hotelDTO(user);

      req.user = hotelDto;

      next();
      return;
    } else if (req.originalUrl.includes("/insurance")) {
      try {
        user = await Insurance.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const insuranceDto = new insuranceDTO(user);

      req.user = insuranceDto;

      next();
      return;
    } else if (req.originalUrl.includes("/user")) {
      try {
        user = await User.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const userDto = new userDTO(user);

      req.user = userDto;

      next();
      return;
    } else if (req.originalUrl.includes("/admin")) {
      try {
        user = await Admin.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const userDto = new userDTO(user);

      req.user = userDto;

      next();
      return;
    } else if (req.originalUrl.includes("/travComp")) {
      try {
        console.log("travCompany");
        user = await TravelCompany.findOne({ _id: _id });
      } catch (error) {
        return next(error);
      }
      const userDto = new travCompanyDto(user);

      req.user = userDto;

      next();
      return;
    }
  } catch (error) {
    return next(error);
  }
};

module.exports = auth;
