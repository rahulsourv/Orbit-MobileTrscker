const logger = require("../utils/logger");
const Device = require("../models/Device");
const deviceService = require("../services/device.service");

// Acknowledgement helper. Socket callbacks are optional on the client, so every
// use is guarded.
const reply = (ack, payload) => {
  if (typeof ack === "function") {
    ack(payload);
  }
};

const registerDeviceHandlers = (io, socket) => {
  const { kind, userId, deviceId } = socket.data;

  // Dashboards ask for the current picture on connect rather than waiting for
  // the next event, which is what makes a reload feel instant.
  socket.on("devices:snapshot", async (payload, ack) => {
    try {
      const devices = await Device.find({ userId }).sort({ name: 1 });

      reply(ack, {
        success: true,
        devices: devices.map((device) => device.toPublic()),
      });
    } catch (error) {
      logger.warn(`devices:snapshot failed: ${error.message}`);
      reply(ack, { success: false, message: "Could not load devices" });
    }
  });

  if (kind !== "device") {
    return;
  }

  // Devices keep their online flag fresh without uploading a position, which
  // matters when the user has tracking switched off but still wants to know the
  // device is reachable.
  socket.on("device:heartbeat", async (payload = {}, ack) => {
    try {
      const device = await Device.findById(deviceId);

      if (!device) {
        return reply(ack, { success: false, message: "Device not found" });
      }

      const batteryLevel =
        typeof payload.batteryLevel === "number" &&
        payload.batteryLevel >= 0 &&
        payload.batteryLevel <= 100
          ? Math.round(payload.batteryLevel)
          : undefined;

      await deviceService.touchDevice(device, { batteryLevel });

      return reply(ack, {
        success: true,
        trackingEnabled: device.trackingEnabled,
      });
    } catch (error) {
      logger.warn(`device:heartbeat failed: ${error.message}`);
      return reply(ack, { success: false, message: "Heartbeat failed" });
    }
  });
};

module.exports = registerDeviceHandlers;
