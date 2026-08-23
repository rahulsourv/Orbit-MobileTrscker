const logger = require("../utils/logger");
const Device = require("../models/Device");
const locationService = require("../services/location.service");

const reply = (ack, payload) => {
  if (typeof ack === "function") {
    ack(payload);
  }
};

// Socket.IO is a transport for events, not a source of location. The device's
// own OS APIs produce the fix; this only carries it, and only for a socket that
// already proved which device it is.
const registerLocationHandlers = (io, socket) => {
  const { kind, userId, deviceId } = socket.data;

  if (kind === "user") {
    // A dashboard can ask for the live snapshot over the same connection it
    // will receive updates on.
    socket.on("location:snapshot", async (payload, ack) => {
      try {
        const devices = await locationService.getLiveSnapshot(userId);

        reply(ack, { success: true, devices });
      } catch (error) {
        logger.warn(`location:snapshot failed: ${error.message}`);
        reply(ack, { success: false, message: "Could not load locations" });
      }
    });

    return;
  }

  socket.on("location:update", async (payload = {}, ack) => {
    try {
      const device = await Device.findById(deviceId);

      if (!device) {
        return reply(ack, { success: false, message: "Device not found" });
      }

      // recordLocation re-checks trackingEnabled and validates the fix, so a
      // socket path cannot bypass what the REST path enforces.
      const location = await locationService.recordLocation(device, payload);

      return reply(ack, { success: true, location });
    } catch (error) {
      const message = error.isOperational
        ? error.message
        : "Could not record location";

      if (!error.isOperational) {
        logger.error(`location:update failed: ${error.message}`);
      }

      return reply(ack, { success: false, message });
    }
  });
};

module.exports = registerLocationHandlers;
