const dotenv = require("dotenv").config();

const exchangeRateApi = async function totalAmount(totalAmount) {
  try {
    const apiKey = process.env.exchangeRateApiKey;
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/PKR`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch exchange rates");
    }

    const data = await response.json();
    const exchangeRate = data.conversion_rates.USD;

    const dollarAmount = (totalAmount * exchangeRate).toFixed(2);

    return dollarAmount;
  } catch (error) {
    console.error("Error:", error.message);
    throw error;
  }
};
 
module.exports = exchangeRateApi;
