const mongoose = require("mongoose");

const vendorRatesSchema = new mongoose.Schema({
  vendorType: {
    type: String,
    required: true,
    enum: [
      "Hospital",
      "Clinic",
      "Lab",
      "Hotel",
      "Doctor",
      "Travel Agency",
      "Company",
      "Other",
    ],
  },
  rate: {
    type: Number,
    required: true,
  }
});

const ratesSchema = new mongoose.Schema({
  nationalRates: {
    type: [vendorRatesSchema],
    required: true,
  },
  internationalRates: {
    type: [vendorRatesSchema],
    required: true,
  },
});

module.exports = mongoose.model(
  "CountryWiseCharges",
  ratesSchema,
  "country wise charges"
);
