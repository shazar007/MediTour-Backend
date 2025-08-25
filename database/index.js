const mongoose = require("mongoose");

const dbConnect = async (retries = 5, delay = 5000) => {
  try {
    if (!process.env.MONGODB_CONNECTION_STRING) {
      throw new Error("MONGODB_CONNECTION_STRING is not defined");
    }
    mongoose.set("strictQuery", false);
    const conn = await mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
    console.log(`Database connected to host: ${conn.connection.host}`);
  } catch (error) {
    if (retries === 0) {
      console.error("Could not connect to the database. Exiting...");
      process.exit(1);
    } else {
      console.log(`Retrying database connection in ${delay / 1000} seconds...`);
      setTimeout(() => dbConnect(retries - 1, delay), delay);
    }
  }
};

module.exports = dbConnect;
