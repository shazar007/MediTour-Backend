const PaymentPercentage = require("../models/paymentPercentage");

const userLabController = {
  async addPaymentPercentage(req, res, next) {
    try {
      const {
        doctor,
        hospital,
        ambulance,
        psychologist,
        paramedic,
        physiotherapist,
        nutrition,
        donation,
        hotel,
        rentCar,
        travelAgency,
        insurance,
      } = req.body;

      if (
        !doctor ||
        !hospital ||
        !ambulance ||
        !psychologist ||
        !paramedic ||
        !physiotherapist ||
        !nutrition ||
        !donation ||
        !hotel ||
        !rentCar ||
        !travelAgency ||
        !insurance
      ) {
        const error = new Error("Missing Parameters!");
        error.status = 400;
        return next(error);
      }
      const existingPaymentPercentage = await PaymentPercentage.findOne();
      if (existingPaymentPercentage) {
        const error = new Error("Payment percentage already exists!");
        error.status = 409;
        return next(error);
      }
      const paymentPercentage = new PaymentPercentage({
        doctor,
        hospital,
        ambulance,
        psychologist,
        paramedic,
        physiotherapist,
        nutrition,
        donation,
        hotel,
        rentCar,
        travelAgency,
        insurance,
      });

      await paymentPercentage.save();

      res
        .status(201)
        .json({
          message: "Payment percentage added successfully",
          paymentPercentage: paymentPercentage,
        });
    } catch (error) {
      next(error);
    }
  },

  async getPaymentPercentage(req, res, next) {
    try {
      const percentages = await PaymentPercentage.find();
      res.status(200).json(percentages);
    } catch (error) {
      next(error);
    }
  },

  async updatePaymentPercentage(req, res, next) {
    try {
      const {
        doctor,
        hospital,
        ambulance,
        psychologist,
        paramedic,
        physiotherapist,
        nutrition,
        donation,
        hotel,
        rentCar,
        travelAgency,
        insurance,
      } = req.body;

      const updatedFields = {
        doctor,
        hospital,
        ambulance,
        psychologist,
        paramedic,
        physiotherapist,
        nutrition,
        donation,
        hotel,
        rentCar,
        travelAgency,
        insurance,
      };

      const updatedPercentage = await PaymentPercentage.findByIdAndUpdate(
        req.query.id, // Assuming you're passing the ID as a URL parameter
        { $set: updatedFields },
        { new: true, runValidators: true }
      );

      if (!updatedPercentage) {
        const error = new Error("Payment percentage not found!");
        error.status = 404;
        return next(error);
      }

      res
        .status(200)
        .json({
          message: "Payment percentage updated successfully",
          updatedPercentage,
        });
    } catch (error) {
      next(error);
    }
  },

  async deletePaymentPercentage(req, res, next) {
    try {
      const deletedPercentage = await PaymentPercentage.findByIdAndDelete(
        req.query.id
      );

      if (!deletedPercentage) {
        const error = new Error("Payment percentage not found!");
        error.status = 404;
        return next(error);
      }

      res
        .status(200)
        .json({ message: "Payment percentage deleted successfully" });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = userLabController;
