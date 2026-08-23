const { AppError } = require("./error.middleware");
const { hashToken } = require("../utils/hashing");
const Device = require("../models/Device");

// Devices authenticate with their own long-lived token, not the owner's access
// token, so a phone never has to hold user credentials. Accepted as either
// "Authorization: Device <token>" or the x-device-token header.
const readDeviceToken = (req) => {
  const header = req.headers.authorization || "";

  if (header.startsWith("Device ")) {
    return header.slice(7).trim();
  }

  const custom = req.get("x-device-token");

  return custom ? custom.trim() : null;
};

const requireDevice = async (req, res, next) => {
  try {
    const token = readDeviceToken(req);

    if (!token) {
      throw new AppError("Device authentication required", 401);
    }

    // The lookup is by hash, so the raw token never has to be compared in
    // application code and the index does the work.
    const device = await Device.findOne({ deviceTokenHash: hashToken(token) });

    if (!device) {
      throw new AppError("Invalid device token", 401);
    }

    // The route may still name a device in the path. It must be this one:
    // holding a valid token for device A grants nothing over device B.
    const requested = req.params.deviceId;

    if (requested && requested !== device._id.toString()) {
      throw new AppError("Device token does not match this device", 403);
    }

    req.device = device;

    return next();
  } catch (error) {
    return next(error);
  }
};

// Tracking is the owner's switch. When it is off the backend refuses telemetry
// outright rather than relying on the client to stop sending.
const requireTrackingEnabled = (req, res, next) => {
  if (!req.device?.trackingEnabled) {
    return next(
      new AppError("Tracking is disabled for this device by its owner", 403)
    );
  }

  return next();
};

module.exports = { requireDevice, requireTrackingEnabled };
