const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");

const env = require("./config/env");
const { isRedisReady } = require("./config/redis");
const authRoutes = require("./routes/auth.routes");
const deviceRoutes = require("./routes/device.routes");
const locationRoutes = require("./routes/location.routes");
const geofenceRoutes = require("./routes/geofence.routes");
const notificationRoutes = require("./routes/notification.routes");
const shareRoutes = require("./routes/share.routes");
const connectionRoutes = require("./routes/connection.routes");
const routeRoutes = require("./routes/route.routes");
const { apiLimiter } = require("./middleware/rateLimit.middleware");
const { notFound, errorHandler } = require("./middleware/error.middleware");

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
    // Device clients authenticate with their own header rather than a cookie.
    allowedHeaders: ["Content-Type", "Authorization", "x-device-token", "x-client-type"],
  })
);
// Location batches are the largest thing the API accepts, and even a full
// offline queue is small. Anything past this is not a real client.
app.use(express.json({ limit: "512kb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];

  res.json({
    success: true,
    message: "Orbit API is running",
    services: {
      database: dbStates[mongoose.connection.readyState] || "unknown",
      redis: env.REDIS_URL ? (isRedisReady() ? "connected" : "connecting") : "disabled",
    },
  });
});

// Auth carries its own, stricter limiters per route, so the general ceiling
// starts after it.
app.use("/api/auth", authRoutes);

app.use("/api/devices", apiLimiter, deviceRoutes);
app.use("/api/locations", apiLimiter, locationRoutes);
app.use("/api/geofences", apiLimiter, geofenceRoutes);
app.use("/api/notifications", apiLimiter, notificationRoutes);
app.use("/api/shares", shareRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/routes", apiLimiter, routeRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
