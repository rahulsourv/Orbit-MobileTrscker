const http = require("http");

const env = require("./config/env");
const logger = require("./utils/logger");
const { connectDB, disconnectDB } = require("./config/database");
const { connectRedis, closeRedis } = require("./config/redis");

// Redis is connected before the app is required, because the rate limiters
// pick their store at module load: connecting afterwards would silently leave
// every instance counting in its own memory.
connectRedis();

const app = require("./app");
const { initSocketServer, closeSocketServer } = require("./sockets");
const deviceService = require("./services/device.service");

const httpServer = http.createServer(app);

let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info(`${signal} received - shutting down`);

  // Stop accepting work first, then release connections, so in-flight requests
  // finish against a database that is still there.
  const forceExit = setTimeout(() => {
    logger.error("shutdown timed out - forcing exit");
    process.exit(1);
  }, 10000);

  forceExit.unref();

  try {
    deviceService.stopOfflineSweeper();
    await closeSocketServer();
    await new Promise((resolve) => httpServer.close(resolve));
    await disconnectDB();
    await closeRedis();

    logger.info("shutdown complete");
    process.exit(0);
  } catch (error) {
    logger.error(`error during shutdown: ${error.message}`);
    process.exit(1);
  }
};

const startServer = async () => {
  await connectDB();
  await initSocketServer(httpServer);

  // Devices never announce that they have gone silent, so a periodic sweep is
  // what turns "stopped reporting" into an offline status and an alert.
  deviceService.startOfflineSweeper();

  httpServer.listen(env.PORT, () => {
    logger.info(`Orbit API running on http://localhost:${env.PORT}`);
    logger.info(`environment: ${env.NODE_ENV}`);
  });
};

["SIGINT", "SIGTERM"].forEach((signal) =>
  process.on(signal, () => shutdown(signal))
);

// An unhandled rejection means some path forgot its error handling. Log it and
// keep serving rather than dying mid-request.
process.on("unhandledRejection", (reason) => {
  logger.error("unhandled promise rejection", { reason });
});

process.on("uncaughtException", (error) => {
  logger.error("uncaught exception", { error });
  shutdown("uncaughtException");
});

startServer().catch((error) => {
  logger.error(`failed to start server: ${error.message}`);
  process.exit(1);
});
