const mongoose = require("mongoose");

const countrySchema = new mongoose.Schema({
  countries: {
    type: [String],
    required: true,
    enum: [
      "Brazil",
      "Canada",
      "Cambodia",
      "Costa Rica",
      "England",
      "Germany",
      "Malaysia",
      "Mexico",
      "Pakistan",
      "Switzerland",
      "Spain",
      "South Korea",
      "Singapore",
      "Turkey",
      "Thailand",
      "USA",
      "UAE",
    ],
  },
});

module.exports = mongoose.model("CountryList", countrySchema, "countries");
