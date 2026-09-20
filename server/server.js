require('dotenv').config();
const app = require('./app');
const { connectDB, closeDB } = require('./config/db');
const { startExpiryCron, stopExpiryCron } = require('./services/cronService');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Assert production secret requirements
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error('FATAL: JWT_SECRET environment variable must be set with at least 32 characters in production.');
      }
    }

    await connectDB();

    // Start background auto-expiry cron task
    startExpiryCron();

    const server = app.listen(PORT, () => {
      console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });

    const gracefulShutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      stopExpiryCron();
      server.close(async () => {
        await closeDB();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (error) {
    console.error(`Failed to initialize application: ${error.message}`);
    process.exit(1);
  }
};

startServer();
