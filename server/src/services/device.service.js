const env = require("../config/env");
const Device = require("../models/Device");
const Location = require("../models/Location");
const LocationShare = require("../models/LocationShare");
const { AppError } = require("../middleware/error.middleware");
const logger = require("../utils/logger");
const { hashToken, generateSecureToken } = require("../utils/hashing");
const { getRedis, isRedisReady } = require("../config/redis");
const { emitToUser } = require("../sockets");
const notificationService = require("./notification.service");
const geofenceService = require("./geofence.service");
const connectionService = require("./connection.service");

const issueDeviceToken = () => {
  const deviceToken = generateSecureToken(32);

  return { deviceToken, deviceTokenHash: hashToken(deviceToken) };
};

// Hot device state (battery, online, last fix) is written through to Redis so
// the dashboard's first paint does not have to wait on Mongo. Mongo stays the
// source of truth; a cache miss simply reads from it.
const DEVICE_STATE_TTL_SECONDS = 900;

const cacheDeviceState = async (device) => {
  if (!isRedisReady()) {
    return;
  }

  try {
    await getRedis().set(
      `orbit:device:${device._id}`,
      JSON.stringify({
        isOnline: device.isOnline,
        batteryLevel: device.batteryLevel,
        lastSeen: device.lastSeen,
      }),
      "EX",
      DEVICE_STATE_TTL_SECONDS
    );
  } catch (error) {
    logger.debug(`device state cache write failed: ${error.message}`);
  }
};

const registerDevice = async (userId, payload) => {
  const existing = await Device.findOne({
    userId,
    deviceIdentifier: payload.deviceIdentifier,
  });

  if (existing) {
    throw new AppError("This device is already registered", 409);
  }

  const { deviceToken, deviceTokenHash } = issueDeviceToken();

  try {
    const device = await Device.create({
      userId,
      name: payload.name,
      type: payload.type,
      platform: payload.platform,
      model: payload.model ?? null,
      deviceIdentifier: payload.deviceIdentifier,
      deviceTokenHash,
      trackingEnabled: payload.trackingEnabled ?? true,
    });

    emitToUser(userId, "device:added", device.toPublic());

    // The raw token is returned exactly once. It is never stored in a
    // retrievable form, so losing it means rotating rather than re-reading.
    return { device: device.toPublic(), deviceToken };
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError("This device is already registered", 409);
    }

    throw error;
  }
};

const listDevices = async (userId) => {
  const devices = await Device.find({ userId }).sort({ createdAt: 1 });

  return devices.map((device) => device.toPublic());
};

// Every read of a single device goes through this, so ownership is enforced in
// one place. A device belonging to someone else is reported as missing rather
// than forbidden, which keeps ids from being probed.
const findOwnedDevice = async (userId, deviceId) => {
  const device = await Device.findOne({ _id: deviceId, userId });

  if (!device) {
    throw new AppError("Device not found", 404);
  }

  return device;
};

const getDevice = async (userId, deviceId) => {
  const device = await findOwnedDevice(userId, deviceId);

  return device.toPublic();
};

const updateDevice = async (userId, deviceId, patch) => {
  const device = await findOwnedDevice(userId, deviceId);

  if (patch.name !== undefined) device.name = patch.name;
  if (patch.type !== undefined) device.type = patch.type;
  if (patch.model !== undefined) device.model = patch.model;

  if (patch.trackingEnabled !== undefined) {
    device.trackingEnabled = patch.trackingEnabled;
  }

  await device.save();

  const publicDevice = device.toPublic();

  emitToUser(userId, "device:updated", publicDevice);

  return publicDevice;
};

const setTracking = (userId, deviceId, trackingEnabled) =>
  updateDevice(userId, deviceId, { trackingEnabled });

// Rotation invalidates the old token immediately, which is the response to a
// lost or reinstalled device.
const rotateDeviceToken = async (userId, deviceId) => {
  const device = await findOwnedDevice(userId, deviceId);
  const { deviceToken, deviceTokenHash } = issueDeviceToken();

  device.deviceTokenHash = deviceTokenHash;
  device.tokenIssuedAt = new Date();
  await device.save();

  return { device: device.toPublic(), deviceToken };
};

// Removing a device removes its history and any share links pointing at it.
// Leaving orphaned location rows behind would keep tracking data alive after
// the user believed they had deleted it.
const deleteDevice = async (userId, deviceId) => {
  const device = await findOwnedDevice(userId, deviceId);

  await Promise.all([
    Location.deleteMany({ deviceId: device._id }),
    LocationShare.deleteMany({ deviceId: device._id }),
    geofenceService.removeDeviceReferences(userId, device._id),
    connectionService.removeDeviceReferences(userId, device._id),
  ]);

  await device.deleteOne();

  emitToUser(userId, "device:removed", { id: device._id.toString() });

  return { deleted: true };
};

// Shared by REST heartbeats, socket heartbeats and location ingestion: any
// contact from a device proves it is alive.
const touchDevice = async (device, { batteryLevel } = {}) => {
  const wasOnline = device.isOnline;
  const previousBattery = device.batteryLevel;
  const now = new Date();

  device.isOnline = true;
  device.lastSeen = now;

  if (batteryLevel !== undefined && batteryLevel !== null) {
    device.batteryLevel = batteryLevel;
  }

  await device.save();
  await cacheDeviceState(device);

  const publicDevice = device.toPublic();

  const statusPayload = {
    id: publicDevice.id,
    isOnline: true,
    lastSeen: now,
    batteryLevel: publicDevice.batteryLevel,
  };

  emitToUser(device.userId, "device:statusChanged", statusPayload);
  // Anyone the owner has agreed to share with sees the same change.
  await connectionService.emitToWatchers(device, "device:statusChanged", statusPayload);

  if (!wasOnline) {
    await notificationService.createNotification({
      userId: device.userId,
      deviceId: device._id,
      type: "DEVICE_ONLINE",
      title: `${device.name} is back online`,
      message: `${device.name} reconnected to Orbit.`,
    });
  }

  if (batteryLevel !== undefined && batteryLevel !== null) {
    const batteryPayload = { id: publicDevice.id, batteryLevel };

    emitToUser(device.userId, "device:batteryUpdated", batteryPayload);
    await connectionService.emitToWatchers(device, "device:batteryUpdated", batteryPayload);

    // Edge-triggered on the way down only, so a device sitting at 12% does not
    // generate an alert with every fix it reports.
    const threshold = env.LOW_BATTERY_THRESHOLD;
    const crossedDown =
      batteryLevel < threshold &&
      (previousBattery === null || previousBattery >= threshold);

    if (crossedDown) {
      await notificationService.createNotification({
        userId: device.userId,
        deviceId: device._id,
        type: "LOW_BATTERY",
        title: `${device.name} battery is low`,
        message: `${device.name} battery is at ${batteryLevel}%.`,
        data: { batteryLevel },
      });
    }
  }

  return publicDevice;
};

const markDeviceOffline = async (deviceId) => {
  const device = await Device.findById(deviceId);

  if (!device || !device.isOnline) {
    return null;
  }

  device.isOnline = false;
  await device.save();
  await cacheDeviceState(device);

  const offlinePayload = {
    id: device._id.toString(),
    isOnline: false,
    lastSeen: device.lastSeen,
    batteryLevel: device.batteryLevel,
  };

  emitToUser(device.userId, "device:statusChanged", offlinePayload);
  await connectionService.emitToWatchers(device, "device:statusChanged", offlinePayload);

  return device;
};

// A device that stops reporting never announces it, so staleness has to be
// swept for. Devices are marked offline once they pass the configured silence
// window, and the owner is told once per transition.
const sweepOfflineDevices = async () => {
  const cutoff = new Date(Date.now() - env.offlineAfterMs);

  const stale = await Device.find({
    isOnline: true,
    $or: [{ lastSeen: { $lt: cutoff } }, { lastSeen: null }],
  });

  for (const device of stale) {
    device.isOnline = false;
    await device.save();
    await cacheDeviceState(device);

    emitToUser(device.userId, "device:statusChanged", {
      id: device._id.toString(),
      isOnline: false,
      lastSeen: device.lastSeen,
      batteryLevel: device.batteryLevel,
    });

    await notificationService.createNotification({
      userId: device.userId,
      deviceId: device._id,
      type: "DEVICE_OFFLINE",
      title: `${device.name} went offline`,
      message: `${device.name} has not reported in for ${env.DEVICE_OFFLINE_AFTER_MINUTES} minutes.`,
    });
  }

  if (stale.length) {
    logger.info(`marked ${stale.length} device(s) offline`);
  }

  return stale.length;
};

let sweeperTimer = null;

const startOfflineSweeper = () => {
  if (sweeperTimer) {
    return sweeperTimer;
  }

  // Checked more often than the window itself, so the reported "went offline"
  // time is close to when it actually happened.
  const interval = Math.max(30000, Math.floor(env.offlineAfterMs / 3));

  sweeperTimer = setInterval(() => {
    sweepOfflineDevices().catch((error) =>
      logger.error(`offline sweep failed: ${error.message}`)
    );
  }, interval);

  // Never hold the process open just for the sweeper.
  sweeperTimer.unref?.();

  logger.info(`offline sweeper running every ${Math.round(interval / 1000)}s`);

  return sweeperTimer;
};

const stopOfflineSweeper = () => {
  if (sweeperTimer) {
    clearInterval(sweeperTimer);
    sweeperTimer = null;
  }
};

const getDeviceStats = async (userId) => {
  const [total, online] = await Promise.all([
    Device.countDocuments({ userId }),
    Device.countDocuments({ userId, isOnline: true }),
  ]);

  return { total, online, offline: total - online };
};

module.exports = {
  registerDevice,
  listDevices,
  getDevice,
  findOwnedDevice,
  updateDevice,
  setTracking,
  rotateDeviceToken,
  deleteDevice,
  touchDevice,
  markDeviceOffline,
  sweepOfflineDevices,
  startOfflineSweeper,
  stopOfflineSweeper,
  getDeviceStats,
};
