const mongoose = require("mongoose");

const env = require("./env");
const logger = require("../utils/logger");

const connectDB = async () => {
  try {
    // Strict query keeps unknown fields out of filters, so a stray key can
    // never silently widen a query into someone else's data.
    mongoose.set("strictQuery", true);

    const connection = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    logger.info(`MongoDB connected: ${connection.connection.host}`);

    return connection;
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

const disconnectDB = () => mongoose.disconnect();

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.disconnectDB = disconnectDB;
