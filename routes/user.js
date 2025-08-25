const express = require("express");
const userAuthController = require("../controller/User/userAuthController");
const VerificationController = require("../controller/verificationController");
const labTestController = require("../controller/Laboratory/labTestController");
const auth = require("../middlewares/auth");
const multer = require("multer");
const userLabController = require("../controller/User/labController");
const userPharmacyController = require("../controller/User/pharmacyController");
const userDoctorController = require("../controller/User/doctorController");
const generalAppointmentController = require("../controller/All Doctors Controllers/generalAppointmentController.js");
const userHospitalController = require("../controller/User/hospitalController");
const uploadFileController = require("../controller/uploadFileController");
const userInsuranceController = require("../controller/User/insuranceController");
// const userOneWayFlightController = require("../controller/User/userTravelAgencyController");
const notificationController = require("../controller/Notification/notification");
const donationController = require("../controller/User/donationController");
const rentACarController = require("../controller/User/rentACarController");
const travelAgencyController = require("../controller/User/travelAgencyController");
const travelAndTourismController = require("../controller/User/travelAndTourismController");
const specialityController = require("../controller/User/specialityController.js");
const mutualFavController = require("../controller/User/mutualFavController.js");
const ambulanceController = require("../controller/User/ambulanceController.js");
const adminLabController = require("../controller/Admin/adminLabController");
const paramedicController = require("../controller/User/paramedicController.js");
const passport = require("passport");
const upload = multer({ dest: "temp/" });
const router = express.Router();

//............auth...............
router.get(
  "/auth/google/",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: false,
  }),
  (req, res) => {
    if (!req.user) {
      return res.redirect(
        "http://your-frontend-domain.com/login?error=auth_failed"
      );
    }

    const { accessToken } = req.user.token;
    const user = req.user;

    console.log("user is in route");

    // Send the response in the same format as conventional login/signup
    res.status(200).json({
      user: {
        auth_provider: user.auth_provider,
        _id: user._id,
        name: user.name,
        email: user.email,
        gender: user.gender,
        mrNo: user.mrNo,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        password: user.password,
        blocked: user.blocked,
        addresses: user.addresses,
        favourites: user.favourites,
        carRentalDetails: user.carRentalDetails,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        __v: user.__v,
        userImage: user.userImage ? user.userImage : undefined,
      },
      auth: true,
      token: accessToken,
    });
  }
);
router.post("/user/register", userAuthController.register);
router.post("/user/googleAuth", userAuthController.googleAuth);
router.put("/user/addPassword", userAuthController.addPassword);
router.post("/user/opdRequest", userAuthController.opdRequest);
router.post("/user/login", userAuthController.login);
router.post(
  "/user/uploadFile",
  upload.single("file"),
  uploadFileController.uploadFile
);
router.post("/user/logout", auth, userAuthController.logout);
router.post("/user/addAddress", auth, userAuthController.addAddress);
router.get("/user/getAllBooking", auth, userAuthController.getAllBooking);
router.put("/user/updateProfile", auth, userAuthController.updateProfile);
router.get("/user/authCheck", userAuthController.authCheck);

//..........................verification...........................//
router.post("/user/sendCodeToEmail", VerificationController.sendCodeToEmail);
router.post("/user/confirmEmail", VerificationController.confirmEmail);
router.post("/user/ResetLink", VerificationController.ResetLink);
router.post("/user/resetPassword", VerificationController.resetPassword);
router.post("/user/forgotPassword", VerificationController.forgotPassword);
router.post("/user/updatePassword", VerificationController.updatePassword);

//..........................Laboratory.............................//
router.get("/user/getNearbyLabs", userLabController.getNearbyLabs);
router.get("/user/getLab", userLabController.getLab);
router.get("/user/filterLabs", userLabController.filterLabs);
router.get("/user/getTest", labTestController.getTest);
router.get("/user/getAllTests", userLabController.getAllTests);
router.put("/user/addRemoveFav", auth, userLabController.addRemoveFav);
router.get("/user/getAllFav", auth, userLabController.getAllFav);
router.post("/user/addReview", auth, userLabController.addRatingReview);
router.get("/user/getAllRatingReviews", userLabController.getAllRatingReviews);
router.post("/user/addLabOrder", auth, userLabController.addLabOrder);
router.get("/user/getOrder", auth, userLabController.getOrder);
router.get("/user/getAllOrders", auth, userLabController.getAllOrders);
router.get("/user/getAllTestCategory", adminLabController.getAllTestCategory);
router.get("/user/downloadLabOrder", userLabController.downloadLabOrder);
router.post(
  "/user/handleLabAndMedicineRequests",
  auth,
  userLabController.handleLabAndMedicineRequests
);

//...........................Pharmacy..............................//
router.get(
  "/user/getNearbyPharmacies",
  userPharmacyController.getNearbyPharmacies
);
router.get("/user/getPharmacy", userPharmacyController.getPharmacy);
router.get("/user/filterPharmacies", userPharmacyController.filterPharmacies);
router.post("/user/addToCart", auth, userPharmacyController.addToCart);
router.get("/user/getCart", auth, userPharmacyController.getCart);
router.get("/user/getAllMeds", userPharmacyController.getAllMeds);
router.post(
  "/user/addPharmacyOrder",
  auth,
  userPharmacyController.addPharmacyOrder
);
router.put(
  "/user/addRemoveFavPharmacy",
  auth,
  userPharmacyController.addRemoveFavPharmacy
);
router.get(
  "/user/getAllFavPharmacies",
  auth,
  userPharmacyController.getAllFavPharmacies
);
router.get(
  "/user/getMedicineRequests",
  auth,
  userPharmacyController.getMedicineRequests
);
router.get(
  "/user/getMedicineRequest",
  auth,
  userPharmacyController.getMedicineRequest
);

//............................Doctors..............................//
router.get("/user/getNearbyDocs", userDoctorController.getNearbyDocs);
router.get("/user/filterDocs", userDoctorController.filterDocs);
router.get("/user/getDoc", userDoctorController.getDoc);
router.get(
  "/user/getHospitalAvailabilityPrice",
  userDoctorController.getHospitalAvailabilityPrice
);
router.get("/user/getAvailability", userDoctorController.getAvailability);
router.post(
  "/user/addAppointmentRequest",
  auth,
  userDoctorController.addAppointmentRequest
);
router.get("/user/getAppointment", userDoctorController.getAppointment);
router.get(
  "/user/getUpcomingAppointment",
  auth,
  userDoctorController.getUpcomingAppointment
);
router.get(
  "/user/getAllUpcomingAppointments",
  auth,
  userDoctorController.getAllUpcomingAppointments
);

// router.post(
//   "/user/addPrescription",
//   auth,
//   userDoctorController.addPrescription
// );
// router.post("/user/addHistory", auth, userDoctorController.addHistory);
router.get("/user/getPatientData", userDoctorController.getPatientData);
router.get(
  "/user/getNearbyMedicalServices",
  userDoctorController.getNearbyMedicalServices
);
router.get("/user/getAllRecords", auth, userDoctorController.getAllRecords);
router.put("/user/saveTestResult", auth, userDoctorController.saveTestResult);
router.get("/user/downloadFile", userDoctorController.downloadFile);
router.get("/user/getOpdDoc", userDoctorController.getOpdDoc);
router.get("/user/getRefferal", auth, userDoctorController.getRefferal);
router.put(
  "/user/remainingDocPayment",
  auth,
  userDoctorController.doctorRemainingPayment
);
router.get("/user/getDocListing", userDoctorController.getDocListing);
router.post(
  "/user/addMedicineRequest",
  auth,
  userDoctorController.addMedicineRequest
);
router.get(
  "/user/getTreatmentCategories",
  generalAppointmentController.getTreatmentCategories
);
router.get("/user/getTreatmentDocs", userDoctorController.getTreatmentDocs);
router.get("/user/getCategoryDocs", userDoctorController.getCategoryDocs);
router.get("/user/getSubCategories", userDoctorController.getSubCategories);
router.get(
  "/user/getTreatmentMainCategories",
  generalAppointmentController.getTreatmentMainCategories
);
router.get(
  "/user/treatmentsByCategory",
  generalAppointmentController.treatmentsByCategory
);
router.post(
  "/user/addConsultancyForm",
  auth,
  userDoctorController.addConsultancyForm
);

//...........................paramedic.............................//
router.post(
  "/user/addParamedicRequest",
  auth,
  paramedicController.addParamedicRequest
);
router.get(
  "/user/getParamedicRequests",
  auth,
  paramedicController.getParamedicRequests
);

//...........................hospitals.............................//
router.get(
  "/user/getNearbyHospitals",
  userHospitalController.getNearbyHospitals
);
router.get("/user/filterHospitals", userHospitalController.filterHospitals);
router.get("/user/getHospital", userHospitalController.getHospital);
router.get("/user/getHospitalDocs", userHospitalController.getHospitalDocs);
router.get(
  "/user/getHospLabsAndPharm",
  userHospitalController.getHospLabsAndPharm
);
router.get("/user/getAllDepartments", userHospitalController.getAllDepartments);
router.get(
  "/user/filterSimilarHospitals",
  userHospitalController.filterSimilarHospitals
);
router.get("/user/getDepartDocs", userHospitalController.getDepartDocs);

//................................. rent a car........................................//

router.get("/user/getNearbyRentCars", rentACarController.getNearbyRentCars);
router.get("/user/rentACarDetail", auth, rentACarController.rentACarDetail);
router.get("/user/getVehicle", rentACarController.getVehicle);
router.post(
  "/user/sendVehicleBooking",
  auth,
  rentACarController.sendVehicleBooking
);
router.post("/user/timeClash", rentACarController.timeClash);
router.put("/user/addRemoveFavCars", auth, rentACarController.addRemoveFavCars);
router.get(
  "/user/getAllfavouriteRentACars",
  auth,
  rentACarController.getAllfavouriteRentACars
);
router.delete("/user/cancelRequest", auth, rentACarController.cancelRequest);
router.put(
  "/user/rentCarRemainingPayment",
  rentACarController.rentCarRemainingPayment
);

// router.get("/user/calculateAge", userRentACarController.calculateAge);
// router.get("/user/extractCityFromAddress", userRentACarController.extractCityFromAddress);
// router.get("/user/getrentACar", userRentACarController.getrentACar);
// router.post("/user/addOtherPersonInfo",auth, userRentACarController.addOtherPersonInfo);
// rouetr.post("/user/addcarRentalDetails", auth, userRentACarController.carRentalDetails);

//........................notifications......................//
router.get("/user/getNotifications", notificationController.getNotifications);

//............donations...//

router.get(
  "/user/getRegisteredCompanies",
  donationController.getRegisteredCompanies
);
router.get("/user/getNgoCompany", donationController.getNgoCompany);
router.get("/user/getAllCriterion", donationController.getAllCriterion);
router.get(
  "/user/getCategoryPackageDetails",
  donationController.getCategoryPackageDetails
);
router.get("/user/getPackageDetails", donationController.getPackageDetails);
router.get("/user/getRecentDonors", donationController.getRecentDonors);
router.post("/user/addDonation", auth, donationController.addDonation);
router.get("/user/getDonorProgresses", donationController.getDonorProgresses);
router.put(
  "/user/addRemoveFavPackages",
  auth,
  donationController.addRemoveFavPackages
);
router.get(
  "/user/getAllFavPackages",
  auth,
  donationController.getAllFavPackages
);

//.................insurance.................. ...//
//.....Travel Agency..//
//..flights../
//  router.post("/user/getAllFlightTypeTickets",travelAgencyController.getAllFlightTypeTickets);
//  router.get("/user/getFlightTicket",travelAgencyController.getFlightTicket);
//  router.post("/user/addFlightBookings",auth,travelAgencyController.addFlightBookings);
//  router.get("/user/fetchFlightRoutes", travelAgencyController.fetchFlightRoutes);
router.post(
  "/user/addFlightRequest",
  auth,
  travelAgencyController.addFlightRequest
);
router.delete(
  "/user/deleteFlightRequest",
  auth,
  travelAgencyController.deleteFlightRequest
);
router.get("/user/getBidRequests", auth, travelAgencyController.getBidRequests);
router.get("/user/getBidRequest", auth, travelAgencyController.getBidRequest);
router.post(
  "/user/rejectBidRequest",
  auth,
  travelAgencyController.rejectBidRequest
);
router.post(
  "/user/acceptBidRequest",
  auth,
  travelAgencyController.acceptBidRequest
);
router.post(
  "/user/getAllFlightRequests",
  auth,
  travelAgencyController.getAllFlightRequests
);

//...tours..//
router.get(
  "/user/getAllTourPackages",
  travelAgencyController.getAllTourPackages
);
router.get("/user/getTourDetails", travelAgencyController.getTourDetails);
router.get(
  "/user/getAllUpcomingSchedules",
  travelAgencyController.getAllUpcomingSchedules
);
// router.post("/user/addRemoveFavTour",auth,travelAgencyController.addRemoveFavTour);
// router.get("/user/getAllFavTourPackages",auth,travelAgencyController.getAllFavTourPackages);
// router.post("/user/addtourRatingReview", auth, travelAgencyController.addtourRatingReview);
// router.get("/user/getAllTourRatingReviews", auth, travelAgencyController.getAllTourRatingReviews);
router.post(
  "/user/addBookingsTour",
  auth,
  travelAgencyController.addBookingsTour
);
router.put(
  "/user/payRemainingTourAmount",
  auth,
  travelAgencyController.payRemainingTourAmount
);
//.................insurance.....................//
router.get(
  "/user/getNearbyInsuranceCompanies",
  userInsuranceController.getNearbyInsuranceCompanies
);
router.post(
  "/user/searchHealthInsurance",
  userInsuranceController.searchHealthInsurance
);
router.get(
  "/user/fetchHospitalizationLimit",
  userInsuranceController.fetchHospitalizationLimit
);
router.get("/user/getInsurance", userInsuranceController.getInsurance);
router.post(
  "/user/sendInsuranceRequest",
  auth,
  userInsuranceController.sendInsuranceRequest
);
router.post(
  "/user/searchTravelInsurance",
  userInsuranceController.searchTravelInsurance
);
router.get(
  "/user/downloadPolicyDoc",
  userInsuranceController.downloadPolicyDoc
);
//....Travel and tourism...//

router.get("/user/searchHotel", travelAndTourismController.searchHotel),
  router.get(
    "/user/listProperties",
    auth,
    travelAndTourismController.listProperties
  ),
  router.put(
    "/user/cancelReservation",
    auth,
    travelAndTourismController.cancelReservation
  ),
  router.post(
    "/user/addHotelBooking",
    auth,
    travelAndTourismController.addHotelBooking
  ),
  router.post(
    "/user/addHotelRequest",
    auth,
    travelAndTourismController.addHotelRequest
  ),
  router.post(
    "/user/hotelRemainingPayment",
    travelAndTourismController.hotelRemainingPayment
  ),
  router.get("/user/getHotelInfo", travelAndTourismController.getHotelInfo),
  //.. speciality doctors   ..///
  router.get(
    "/user/getNearbySpecialityDoctors",
    specialityController.getNearbySpecialityDoctors
  );
router.get(
  "/user/getAllSpecialityDoctors",
  specialityController.getAllSpecialityDoctors
);
router.get("/user/getSpecialities", specialityController.getSpecialities);
router.get(
  "/user/searchSpecialityDoctors",
  specialityController.searchSpecialityDoctors
);
router.get(
  "/user/filterSpecialityDocs",
  specialityController.filterSpecialityDocs
);
//.......Ambulance Request.................//

router.post(
  "/user/addAmbulanceRequest",
  auth,
  ambulanceController.addAmbulanceRequest
);
router.get("/user/getUserRequests", auth, ambulanceController.getUserRequests);
router.get("/user/getAmbBidRequests", auth, ambulanceController.getBidRequests);
router.post(
  "/user/rejectAmbBidRequest",
  auth,
  ambulanceController.rejectBidRequest
);
router.delete(
  "/user/deleteUserRequest",
  auth,
  ambulanceController.deleteUserRequest
);
router.post(
  "/user/acceptAmbBidRequest",
  auth,
  ambulanceController.acceptBidRequest
);

//... mutual all favourites
router.put("/user/addRemoveAllFav", auth, mutualFavController.addRemoveAllFav);
router.get(
  "/user/getAllFavourites",
  auth,
  mutualFavController.getAllFavourites
);

module.exports = router;
