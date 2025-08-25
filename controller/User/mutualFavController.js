const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Joi = require("joi");
const geolib = require("geolib");
const Laboratory = require("../../models/Laboratory/laboratory");
const Hospitals = require("../../models/Hospital/hospital");
const doctors = require("../../models/Doctor/doctors");
const Pharmacy = require("../../models/Pharmacy/pharmacy");
const User = require("../../models/User/user");
const Tour = require("../../models/Travel Agency/tour");
const BnB = require("../../models/Hotel/bnbInfo");
// const Room = require("../../models/Hotel/room.js");
const Apartment = require("../../models/Hotel/appartmentInfo.js");
const familyPlan = require("../../models/Insurance/familyHealthInsurance.js");
const TravelIns = require("../../models/Insurance/familyTravelInsurance.js");
const IndHealthIns = require("../../models/Insurance/individualHealthInsurance.js");
const IndTravelInsurance = require("../../models/Insurance/individualTravelInsurance.js");
const ParentsHealthInsurance = require("../../models/Insurance/parentsHealthInsurance.js");
const Home = require("../../models/Hotel/homeInfo");
// Import the correct model
const RentACar = require("../../models/Rent A Car/rentCar");
const Package = require("../../models/Donation/package");
const Donation = require("../../models/Donation/donationCompany.js");

const mutualFavController = {
  async addRemoveAllFav(req, res, next) {
    try {
      const { type, itemId } = req.body;
      const userId = req.user._id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json([]); // Send empty response
      }

      let favFieldName, model;
      //flights add krny hain
      switch (type) {
        case "laboratory":
          favFieldName = "favouriteLabs";
          model = Laboratory;
          break;
        case "tour":
          favFieldName = "favouriteTours";
          model = Tour;
          break;
        case "family plan":
          favFieldName = "favouriteFamilyHealthInsurances";
          model = familyPlan;
          break;
        case "family travel":
          favFieldName = "favouriteTravelIns";
          model = TravelIns;
          break;
        case "individual plan":
          favFieldName = "favouriteIndHealthIns";
          model = IndHealthIns;
          break;
        case "individual travel":
          favFieldName = "favouriteIndTravelInsurance";
          model = IndTravelInsurance;
          break;
        case "parents plan":
          favFieldName = "favouriteParentsHealthInsurance";
          model = ParentsHealthInsurance;
          break;

        case "pharmacy":
          favFieldName = "favouritePharmacies";
          model = Pharmacy;
          break;
        case "donation":
          favFieldName = "favouritePackages";
          model = Package;
          break;
        case "rent a car":
          favFieldName = "favouriteRentACars";
          model = RentACar;
          break;
        case "doctor":
          favFieldName = "favouriteDoctors";
          model = doctors;
          break;
        case "hospitals":
          favFieldName = "favouriteDoctors";
          model = Hospitals;
          break;
        case "hotel":
          favFieldName = "favouriteHotels";
          model = BnB;
          break;
        case "apartment":
          favFieldName = "favouriteApartments";
          model = Apartment;
          break;
        case "home":
          favFieldName = "favouriteHomes";
          model = Home;
          break;

        default:
          const error = new Error("Invalid type provided!");
          error.status = 400;
          throw error;
      }

      const item = await model.findById(itemId);
      if (!item) {
        return res.status(404).json([]);
      }

      // Check if the item already exists in user's favourites
      const favIndex = user.favourites.findIndex(
        (fav) =>
          fav.favModel === type && fav.itemId.toString() === itemId.toString()
      );
      let message;
      if (favIndex !== -1) {
        // If the item already exists, remove it
        user.favourites.splice(favIndex, 1);
        message = `${type} removed from favourites.`;
      } else {
        // If the item does not exist, add it
        user.favourites.push({ favModel: type, itemId });
        message = `${type} added to favourites.`;
      }

      // Save the updated user document
      await user.save();

      return res.status(200).json({ user, message });
    } catch (error) {
      return next(error);
    }
  },
  async getAllFavourites(req, res, next) {
    try {
      const userId = req.user._id;
      const favType = req.query.favType;
      const page = parseInt(req.query.page) || 1; // Current page number
      const limit = parseInt(req.query.limit) || 10; // Number of items per page
      const skip = (page - 1) * limit;
      // Find the user and populate the favourites field
      const user = await User.findById(userId).populate("favourites.itemId");
      if (!user) {
        return res.status(404).json([]); // Send empty response
      }


      const populatedFavourites = [];

      // Reverse the order of favourites to start from the most recently added
      const reversedFavourites = user.favourites.slice().reverse();

      // Apply pagination to the reversedFavourites array
      const paginatedFavourites = reversedFavourites.slice(skip, skip + limit);

      for (const favourite of paginatedFavourites) {
        let model;
    
        if (favType === "hotels") {
          if (favourite.favModel === "hotel") {
            model = await BnB.findById(favourite.itemId);
          } else if (favourite.favModel === "apartment") {
            model = await Apartment.findById(favourite.itemId);
          } else if (favourite.favModel === "home") {
            model = await Home.findById(favourite.itemId);
          }
        } else if (favType === "insurance") {
          if (favourite.favModel === "family plan") {
            model = await familyPlan.findById(favourite.itemId);
          } else if (favourite.favModel === "family travel") {
            model = await TravelIns.findById(favourite.itemId);
          } else if (favourite.favModel === "individual plan") {
            model = await IndHealthIns.findById(favourite.itemId);
          } else if (favourite.favModel === "individual travel") {
            model = await IndTravelInsurance.findById(favourite.itemId);
          } else if (favourite.favModel === "parents plan") {
            model = await ParentsHealthInsurance.findById(favourite.itemId);
          }
        } else if (favType === "laboratory") {
          if (favourite.favModel === "laboratory") {
            model = await Laboratory.findById(favourite.itemId);
          }
        } else if (favType === "doctors") {
          if (favourite.favModel === "doctor") {
            model = await doctors.findById(favourite.itemId);
          }
        } else if (favType === "pharmacy") {
          if (favourite.favModel === "pharmacy") {
            model = await Pharmacy.findById(favourite.itemId);
          }
        } else if (favType === "donation") {
          if (favourite.favModel === "donation") {
              model = await Package.findById(favourite.itemId);
      
              // If the model has a donationId, populate the donation details
              if (model && model.donationId) {
                  // Fetch the related donation details from the Donation model
                  const donationDetails = await Donation.findById(model.donationId).lean(); // Fetch as a plain object
                  if (donationDetails) {
                      // Add donation details to the model
                      model = {
                          ...model.toObject(),  // Convert Mongoose object to plain JS object
                          donationDetails,      // Add the populated donation details
                      };
                  }
              }
          }
      }
       else if (favType === "hospitals") {
          if (favourite.favModel === "hospitals") {
            model = await Hospitals.findById(favourite.itemId);
          }
        } else if (favType === "rent a car") {
          if (favourite.favModel === "rent a car") {
            model = await RentACar.findById(favourite.itemId);
          }
        } else if (favType === "tour") {
          if (favourite.favModel === "tour") {
            model = await Tour.findById(favourite.itemId);
          }
        }
        if (model) {
          populatedFavourites.push({ type: favourite.favModel, item: model });
        } else {
          console.error(
            "Model not found for favModel:",
            favourite.favModel,
            "or favType not matched:",
            favType
          );
        }
      }

      // Calculate total number of pages
      const totalFavourites = user.favourites.length;
      const totalPages = Math.ceil(totalFavourites / limit);
      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        user: user,
        favourites: populatedFavourites,
        currentPage: page,
        totalPages: totalPages,
        totalFavourites: totalFavourites,
        previousPage,
        nextPage,
      });
    } catch (error) {
      console.error(error.message);
      return res.status(error.status || 500).json({ error: error.message });
    }
  },
};
module.exports = mutualFavController;
