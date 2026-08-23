const deviceService = require("../services/device.service");

// Ownership always comes from req.user.id, which the auth middleware derived
// from a verified token - never from anything the client sent.
const registerDevice = async (req, res, next) => {
  try {
    const { device, deviceToken } = await deviceService.registerDevice(
      req.user.id,
      req.body
    );

    return res.status(201).json({
      success: true,
      message: "Device registered. Store the device token securely - it is shown only once.",
      data: { device, deviceToken },
    });
  } catch (error) {
    return next(error);
  }
};

const listDevices = async (req, res, next) => {
  try {
    const [devices, stats] = await Promise.all([
      deviceService.listDevices(req.user.id),
      deviceService.getDeviceStats(req.user.id),
    ]);

    return res.status(200).json({ success: true, data: { devices, stats } });
  } catch (error) {
    return next(error);
  }
};

const getDevice = async (req, res, next) => {
  try {
    const device = await deviceService.getDevice(req.user.id, req.params.deviceId);

    return res.status(200).json({ success: true, data: { device } });
  } catch (error) {
    return next(error);
  }
};

const updateDevice = async (req, res, next) => {
  try {
    const device = await deviceService.updateDevice(
      req.user.id,
      req.params.deviceId,
      req.body
    );

    return res.status(200).json({ success: true, data: { device } });
  } catch (error) {
    return next(error);
  }
};

const setTracking = async (req, res, next) => {
  try {
    const device = await deviceService.setTracking(
      req.user.id,
      req.params.deviceId,
      req.body.trackingEnabled
    );

    return res.status(200).json({
      success: true,
      message: device.trackingEnabled
        ? "Tracking enabled for this device"
        : "Tracking disabled for this device",
      data: { device },
    });
  } catch (error) {
    return next(error);
  }
};

const rotateToken = async (req, res, next) => {
  try {
    const { device, deviceToken } = await deviceService.rotateDeviceToken(
      req.user.id,
      req.params.deviceId
    );

    return res.status(200).json({
      success: true,
      message: "Device token rotated. The previous token no longer works.",
      data: { device, deviceToken },
    });
  } catch (error) {
    return next(error);
  }
};

const deleteDevice = async (req, res, next) => {
  try {
    await deviceService.deleteDevice(req.user.id, req.params.deviceId);

    return res.status(200).json({
      success: true,
      message: "Device and its location history were deleted",
    });
  } catch (error) {
    return next(error);
  }
};

// Called by the device itself with its own token, not by the dashboard.
const heartbeat = async (req, res, next) => {
  try {
    const device = await deviceService.touchDevice(req.device, {
      batteryLevel: req.body.batteryLevel,
    });

    return res.status(200).json({
      success: true,
      data: {
        device: {
          id: device.id,
          trackingEnabled: device.trackingEnabled,
          lastSeen: device.lastSeen,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Lets a freshly installed client confirm its token works and learn whether the
// owner currently permits tracking.
const getDeviceSelf = async (req, res) =>
  res.status(200).json({
    success: true,
    data: {
      device: {
        id: req.device._id.toString(),
        name: req.device.name,
        type: req.device.type,
        platform: req.device.platform,
        trackingEnabled: req.device.trackingEnabled,
      },
    },
  });

module.exports = {
  registerDevice,
  listDevices,
  getDevice,
  updateDevice,
  setTracking,
  rotateToken,
  deleteDevice,
  heartbeat,
  getDeviceSelf,
};
