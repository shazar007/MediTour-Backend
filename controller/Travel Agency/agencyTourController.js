const express = require("express");
const app = express();
const TourDTO = require("../../dto/travel agency/tour");
const Tour = require("../../models/Travel Agency/tour");
const TravelAgency = require("../../models/Travel Agency/travelAgency");
const Joi = require("joi");

const agencyOneWayFlightController = {
  async addTour(req, res, next) {
    const tourSchema = Joi.object({
      packageName: Joi.string().required(),
      region: Joi.string().required(),
      stay: Joi.object({
        day: Joi.number().required(),
        night: Joi.number().required(),
      }).required(),
      from: Joi.string().required(),
      to: Joi.string().required(),
      pickUpDropOff: Joi.string().required(),
      departTime: Joi.string().required(),
      returnTime: Joi.string().required(),
      departDate: Joi.date().required(),
      returnDate: Joi.date().required(),
      limitedSeats: Joi.number().required(),
      className: Joi.string().required(),
      images: Joi.array().items(Joi.string()).required(),
      breakfast: Joi.boolean().required(),
      lunch: Joi.boolean().required(),
      dinner: Joi.boolean().required(),
      dayByDayPlans: Joi.array().items(Joi.string()).required(),
      pricePerHead: Joi.string().required(),
      pricePerCouple: Joi.string().required(),
      accommodations: Joi.string().required(),
      transportation: Joi.string().required(),
      ourTeam: Joi.string().required(),
      cancellationPolicy: Joi.string().required(),

      // Repetition validation
      repetition: Joi.object({
        type: Joi.string().valid("once", "repeat").required(),
        dates: Joi.when("type", {
          is: "repeat",
          then: Joi.array()
            .items(
              Joi.object({
                departTime: Joi.string().required(),
                returnTime: Joi.string().required(),
                departDate: Joi.date().required(),
                returnDate: Joi.date().required(),
              })
            )
            .required(),
          otherwise: Joi.forbidden(), // if type is "once", don't allow dates
        }),
      }).required(),
    });

    const { error } = tourSchema.validate(req.body);
    if (error) return next(error);

    const {
      packageName,
      region,
      stay,
      from,
      to,
      pickUpDropOff,
      departTime,
      returnTime,
      departDate,
      returnDate,
      className,
      images,
      limitedSeats,
      breakfast,
      lunch,
      dinner,
      dayByDayPlans,
      pricePerHead,
      pricePerCouple,
      accommodations,
      transportation,
      ourTeam,
      cancellationPolicy,
      repetition,
    } = req.body;

    const agencyId = req.user._id;

    try {
      const travelAgency = await TravelAgency.findById(agencyId);
      if (!travelAgency) {
        return next({ status: 404, message: "Travel agency not found" });
      }

      const tourToRegister = new Tour({
        agencyId,
        packageName,
        region,
        stay,
        from,
        to,
        pickUpDropOff,
        departTime,
        returnTime,
        departDate,
        returnDate,
        className,
        images,
        limitedSeats,
        breakfast,
        lunch,
        dinner,
        dayByDayPlans,
        pricePerHead,
        pricePerCouple,
        accommodations,
        transportation,
        ourTeam,
        cancellationPolicy,
        repetition,
      });

      const tour = await tourToRegister.save();
      const tourDto = new TourDTO(tour);

      return res.status(201).json({ tour: tourDto, auth: true });
    } catch (error) {
      return next(error);
    }
  },

  // update
  async editTour(req, res, next) {
    const tourSchema = Joi.object({
      packageName: Joi.string(),
      region: Joi.string(),
      stay: Joi.object({
        day: Joi.number(),
        night: Joi.number(),
      }),
      from: Joi.string(),
      to: Joi.string(),
      pickUpDropOff: Joi.string(),
      departTime: Joi.string(),
      returnTime: Joi.string(),
      departDate: Joi.date(),
      returnDate: Joi.date(),
      limitedSeats: Joi.number(),
      className: Joi.string(),
      images: Joi.array().items(Joi.string()),
      breakfast: Joi.boolean(),
      lunch: Joi.boolean(),
      dinner: Joi.boolean(),
      dayByDayPlans: Joi.array().items(Joi.string()),
      pricePerHead: Joi.string(),
      pricePerCouple: Joi.string(),
      accommodations: Joi.string(),
      transportation: Joi.string(),
      ourTeam: Joi.string(),
      cancellationPolicy: Joi.string(),
      repetition: Joi.object({
        type: Joi.string().valid("once", "repeat"),
        dates: Joi.when("type", {
          is: "repeat",
          then: Joi.array().items(
            Joi.object({
              departTime: Joi.string().required(),
              returnTime: Joi.string().required(),
              departDate: Joi.date().required(),
              returnDate: Joi.date().required(),
            })
          ),
          otherwise: Joi.forbidden(),
        }),
      }),
    });

    const { error } = tourSchema.validate(req.body);
    if (error) return next(error);

    const tourId = req.query.tourId;
    const existingTour = await Tour.findById(tourId);
    if (!existingTour) {
      return res.status(404).json({ message: "Tour not found" });
    }

    const updatableFields = [
      "packageName",
      "region",
      "stay",
      "from",
      "to",
      "pickUpDropOff",
      "departTime",
      "returnTime",
      "departDate",
      "returnDate",
      "limitedSeats",
      "className",
      "images",
      "breakfast",
      "lunch",
      "dinner",
      "dayByDayPlans",
      "pricePerHead",
      "pricePerCouple",
      "accommodations",
      "transportation",
      "ourTeam",
      "cancellationPolicy",
      "repetition",
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        existingTour[field] = req.body[field];
      }
    });

    await existingTour.save();

    return res.status(200).json({
      message: "Tour updated successfully",
      tour: existingTour,
    });
  },

  async deleteTour(req, res, next) {
    const tourId = req.query.tourId;
    const existingTour = await Tour.findById(tourId);

    if (!existingTour) {
      return res.status(404).json([]); // Send empty response
    }
    await Tour.deleteOne({ _id: tourId });
    return res.status(200).json({ message: "Tour deleted successfully" });
  },

  async getTour(req, res, next) {
    try {
      const tourId = req.query.tourId;
      const tour = await Tour.findById(tourId);

      if (!tour) {
        return res.status(404).json([]); // Send empty response
      }
      return res.status(200).json({ tour });
    } catch (error) {
      return next(error);
    }
  },

  async getAllTour(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1; // Get the page number from the query parameter
      const toursPerPage = 10;
      const agencyId = req.user._id;
      const totalTours = await Tour.countDocuments({ agencyId }); // Get the total number of posts for the user
      const totalPages = Math.ceil(totalTours / toursPerPage); // Calculate the total number of pages

      const skip = (page - 1) * toursPerPage; // Calculate the number of posts to skip based on the current page

      const tours = await Tour.find({ agencyId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(toursPerPage);

      let previousPage = page > 1 ? page - 1 : null;
      let nextPage = page < totalPages ? page + 1 : null;

      return res.status(200).json({
        tours: tours,
        totalTours: totalTours, // Add the total count of tours to the response
        auth: true,
        totalPages,
        previousPage: previousPage,
        nextPage: nextPage,
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = agencyOneWayFlightController;
