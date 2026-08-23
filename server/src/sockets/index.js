const { Server } = require("socket.io");

const env = require("../config/env");
const logger = require("../utils/logger");
const { createAdapterClients } = require("../config/redis");
const { verifyAccessToken } = require("../utils/jwt");
const { hashToken } = require("../utils/hashing");
const User = require("../models/User");
const Device = require("../models/Device");

let io = null;

// Rooms. A socket is only ever added to rooms derived from its own verified
// identity, so subscribing to someone else's device is not expressible.
const userRoom = (userId) => `user:${userId}`;
const deviceRoom = (deviceId) => `device:${deviceId}`;

// Two kinds of client connect here:
//   - dashboards, which present a user access token and read events;
//   - devices, which present their device token and push telemetry.
const authenticate = async (socket, next) => {
  try {
    const { token, deviceToken } = socket.handshake.auth || {};

    if (deviceToken) {
      const device = await Device.findOne({
        deviceTokenHash: hashToken(deviceToken),
      });

      if (!device) {
        return next(new Error("Unauthorized"));
      }

      socket.data.kind = "device";
      socket.data.deviceId = device._id.toString();
      socket.data.userId = device.userId.toString();

      return next();
    }

    if (!token) {
      return next(new Error("Unauthorized"));
    }

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.userId).select("_id");

    if (!user) {
      return next(new Error("Unauthorized"));
    }

    socket.data.kind = "user";
    socket.data.userId = user._id.toString();

    return next();
  } catch {
    // Never leak whether the token was malformed, expired or simply unknown.
    return next(new Error("Unauthorized"));
  }
};

const initSocketServer = async (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
    // Devices on mobile networks reconnect often; a slightly longer window
    // avoids treating a tunnel or lift as a disconnect.
    pingTimeout: 30000,
    maxHttpBufferSize: 1e5,
  });

  const adapterClients = createAdapterClients();

  if (adapterClients) {
    try {
      const { createAdapter } = require("@socket.io/redis-adapter");

      io.adapter(createAdapter(adapterClients.pubClient, adapterClients.subClient));
      logger.info("Socket.IO Redis adapter enabled");
    } catch (error) {
      logger.warn(`Socket.IO Redis adapter unavailable: ${error.message}`);
    }
  }

  io.use(authenticate);

  // Required here rather than at module scope: the handlers import services,
  // and those services import this module to emit events.
  const registerDeviceHandlers = require("./device.socket");
  const registerLocationHandlers = require("./location.socket");

  io.on("connection", (socket) => {
    const { kind, userId, deviceId } = socket.data;

    socket.join(userRoom(userId));

    if (kind === "device") {
      socket.join(deviceRoom(deviceId));
    }

    logger.debug("socket connected", { kind, userId, deviceId });

    registerDeviceHandlers(io, socket);
    registerLocationHandlers(io, socket);

    socket.on("disconnect", (reason) => {
      logger.debug("socket disconnected", { kind, userId, deviceId, reason });

      if (kind === "device") {
        // Mark the device offline through the service so the same
        // notification and broadcast path runs as for the sweeper.
        require("../services/device.service")
          .markDeviceOffline(deviceId)
          .catch((error) =>
            logger.warn(`failed to mark device offline: ${error.message}`)
          );
      }
    });
  });

  return io;
};

const getIO = () => io;

// Emit helpers are no-ops before the server starts (and in tests), so services
// never have to guard their calls.
const emitToUser = (userId, event, payload) => {
  io?.to(userRoom(userId.toString())).emit(event, payload);
};

const emitToDevice = (deviceId, event, payload) => {
  io?.to(deviceRoom(deviceId.toString())).emit(event, payload);
};

const closeSocketServer = async () => {
  if (!io) {
    return;
  }

  await io.close();
  io = null;
};

module.exports = {
  initSocketServer,
  getIO,
  emitToUser,
  emitToDevice,
  closeSocketServer,
  userRoom,
  deviceRoom,
};
