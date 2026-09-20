const mongoose = require('mongoose');
const baseSchemaPlugin = require('../utils/baseSchemaPlugin');

// Apply base schema conventions across all Mongoose models
mongoose.plugin(baseSchemaPlugin);

/**
 * Connect to MongoDB instance using MONGODB_URI environment variable.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    const errorMsg = 'FATAL: MONGODB_URI environment variable is not defined.';
    console.error(errorMsg);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw new Error(errorMsg);
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host} | Database: ${conn.connection.name}`);

    // Listen to connection runtime events
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB runtime connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB connection disconnected.');
    });

    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
};

/**
 * Close MongoDB connection gracefully (useful for tests or graceful shutdown).
 */
const closeDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close(false);
    console.log('MongoDB connection closed successfully.');
  }
};

module.exports = { connectDB, closeDB };
