const { default: mongoose } = require("mongoose");
// const User = require("../../models/User/user.js");
const User = require("../../models/User/user");
const Laboratory = require("../../models/Laboratory/laboratory.js");
const Pharmacy = require("../../models/Pharmacy/pharmacy.js");
const Doctor = require("../../models/Doctor/doctors.js");
const ambulance = require("../../models/Ambulance/ambulanceCompany.js");
const RentACar = require("../../models/Rent A Car/rentCar.js");
const TravelAgency = require("../../models/Travel Agency/travelAgency.js");
const DoctorCompany = require("../../models/DoctorCompany/docCompany.js");
const TravelCompany = require("../../models/Travel Company/travelCompany.js");

const {
  TEXT_MESSAGE,
  QUATATION,
  IMAGES,
  DOCUMENTS,
} = require("../Notifications/chatNotificationTypes");
const Admin = require("../../models/Admin/Admin.js");
const donationCompany = require("../../models/Donation/donationCompany.js");
const Hotel = require("../../models/Hotel/hotel.js");
const insurance = require("../../models/Insurance/insurance.js");
const hospital = require("../../models/Hospital/hospital.js");
const PaymentToVendors = require("../../models/Admin/paymentToVendors.js");
const pharmaceutical = require("../../models/Pharmaceutical/pharmaceutical.js");

async function getVendors() {
  const vendorTypes = [
    "Users",
    "Laboratory",
    "Pharmacy",
    "Doctor",
    "Hospital",
    "Ambulance Company",
    "Donation Company",
    "Hotel",
    "Rent A Car",
    "Travel Agency",
    "Insurance",
    "Pharmaceutical",
    "Doctor Company",
    "Travel Company"
  ];

  for (const vendorType of vendorTypes) {
    const vendors = await PaymentToVendors.find({
      vendorModelType: vendorType,
    }).populate("vendorId");
  }
}
const chatnotificationsCategories = {
  [TEXT_MESSAGE]: {
    type: "%Name%",
    template: "%messagedata%",
    path: "/chatDetailScreen",
  },
  [IMAGES]: {
    type: "%Name%",
    template: "sent a Image!",
    path: "/chatDetailScreen",
  },
  [DOCUMENTS]: {
    type: "%Name%",
    template: "sent a document!",
    path: "/chatDetailScreen",
  },
  [QUATATION]: {
    type: "%Name%",
    template: "sent a quotation!",
    path: "/chatDetailScreen",
  },
};

async function getFcmTokenForChat(userId, type) {
  try {
    let gettingDeviceToken = null;

    if (type == "lab") {
      gettingDeviceToken = await Laboratory.findById({ _id: userId });
    }
    if (type == "pharmacy") {
      gettingDeviceToken = await Pharmacy.findById({ _id: userId });
    }

    if (type == "Doctor") {
      gettingDeviceToken = await Doctor.findById({ _id: userId });
    }
    if (type == "Donation") {
      gettingDeviceToken = await donationCompany.findById({ _id: userId });
    }
    if (type == "rentACar") {
      gettingDeviceToken = await RentACar.findById({ _id: userId });
    }
    if (type == "insurance") {
      gettingDeviceToken = await insurance.findById({ _id: userId });
    }
    if (type == "user") {
      gettingDeviceToken = await User.findById({ _id: userId });
    }
    if (type == "agency") {
      gettingDeviceToken = await TravelAgency.find({ _id: userId });
    }
    if (type == "Ambulance Company") {
      gettingDeviceToken = await ambulance.find({ _id: userId });
    }
    if (type == "travel") {
      gettingDeviceToken = await Hotel.findById({ _id: userId });
    }
    if (type == "Hospital") {
      gettingDeviceToken = await hospital.findById({ _id: userId });
    }
    if (type == "Pharmaceutical") {
      gettingDeviceToken = await pharmaceutical.findById({ _id: userId });
    }
    if (type == "Doctor Company") {
      gettingDeviceToken = await DoctorCompany.findById({ _id: userId });
    }
    if (type == "Travel Company") {
      gettingDeviceToken = await TravelCompany.findById({ _id: userId });
    }
    if (type == "admin") {
      gettingDeviceToken = await Admin.find({});
    } else if (type == "vendorModelType") {
      await getVendors(); // Sab vendors ko baari baari retrieve karega
      return;
    }
    
    let deviceToken;
    if (gettingDeviceToken.fcmToken) {
      deviceToken = gettingDeviceToken.fcmToken;
    }
    if (deviceToken) {
      return deviceToken;
    } else {
      console.log("users device token does not exist");
    }
  } catch (err) {
    console.log("error retreiving FCM token:", err);
    throw err;
  }
}

module.exports = { chatnotificationsCategories, getFcmTokenForChat };
