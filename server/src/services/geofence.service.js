const Geofence = require("../models/Geofence");
const Device = require("../models/Device");
const { AppError } = require("../middleware/error.middleware");
const logger = require("../utils/logger");
const { toGeoPoint, fromGeoPoint, isInsideGeofence } = require("../utils/location");
const { emitToUser } = require("../sockets");
const notificationService = require("./notification.service");

// Every device id a geofence names must belong to the caller, otherwise a
// geofence could be pointed at a stranger's device to learn where it goes.
const assertDevicesOwned = async (userId, deviceIds = []) => {
  if (!deviceIds.length) {
    return;
  }

  const owned = await Device.countDocuments({
    _id: { $in: deviceIds },
    userId,
  });

  if (owned !== deviceIds.length) {
    throw new AppError("One or more devices were not found", 404);
  }
};

const createGeofence = async (userId, payload) => {
  const deviceIds = payload.deviceIds || [];

  await assertDevicesOwned(userId, deviceIds);

  const geofence = await Geofence.create({
    userId,
    name: payload.name,
    center: toGeoPoint(payload.latitude, payload.longitude),
    radius: payload.radius,
    deviceIds,
    enterAlert: payload.enterAlert ?? true,
    exitAlert: payload.exitAlert ?? true,
    color: payload.color ?? null,
  });

  return geofence.toPublic();
};

const listGeofences = async (userId) => {
  const geofences = await Geofence.find({ userId }).sort({ createdAt: -1 });

  return geofences.map((geofence) => geofence.toPublic());
};

const getGeofence = async (userId, geofenceId) => {
  const geofence = await Geofence.findOne({ _id: geofenceId, userId });

  if (!geofence) {
    throw new AppError("Geofence not found", 404);
  }

  return geofence.toPublic();
};

const updateGeofence = async (userId, geofenceId, patch) => {
  const geofence = await Geofence.findOne({ _id: geofenceId, userId });

  if (!geofence) {
    throw new AppError("Geofence not found", 404);
  }

  if (patch.deviceIds) {
    await assertDevicesOwned(userId, patch.deviceIds);
    geofence.deviceIds = patch.deviceIds;
    // Membership changed, so remembered enter/exit state is meaningless.
    geofence.deviceStates = [];
  }

  if (patch.name !== undefined) geofence.name = patch.name;
  if (patch.enterAlert !== undefined) geofence.enterAlert = patch.enterAlert;
  if (patch.exitAlert !== undefined) geofence.exitAlert = patch.exitAlert;
  if (patch.active !== undefined) geofence.active = patch.active;
  if (patch.color !== undefined) geofence.color = patch.color;
  if (patch.radius !== undefined) geofence.radius = patch.radius;

  if (patch.latitude !== undefined && patch.longitude !== undefined) {
    geofence.center = toGeoPoint(patch.latitude, patch.longitude);
    geofence.deviceStates = [];
  }

  await geofence.save();

  return geofence.toPublic();
};

const deleteGeofence = async (userId, geofenceId) => {
  const result = await Geofence.deleteOne({ _id: geofenceId, userId });

  if (!result.deletedCount) {
    throw new AppError("Geofence not found", 404);
  }

  return { deleted: true };
};

// Called for every accepted fix. Enter and exit are edge-triggered: an alert
// fires only when membership flips, never on every point inside the circle.
const evaluateForLocation = async (device, point, timestamp) => {
  const geofences = await Geofence.find({
    userId: device.userId,
    active: true,
    $or: [{ deviceIds: { $size: 0 } }, { deviceIds: device._id }],
  });

  const events = [];

  for (const geofence of geofences) {
    const state = geofence.stateFor(device._id);
    const wasInside = state?.inside ?? null;

    const { inside, distance } = isInsideGeofence({
      point,
      center: fromGeoPoint(geofence.center),
      radius: geofence.radius,
      wasInside: wasInside === true,
    });

    if (wasInside === inside) {
      continue;
    }

    if (state) {
      state.inside = inside;
      state.changedAt = timestamp;
    } else {
      geofence.deviceStates.push({
        deviceId: device._id,
        inside,
        changedAt: timestamp,
      });
    }

    try {
      await geofence.save();
    } catch (error) {
      logger.warn(`failed to persist geofence state: ${error.message}`);
      continue;
    }

    // The first fix after a geofence is created establishes a baseline. Firing
    // "entered" for a device that was already sitting at home would be noise.
    if (wasInside === null) {
      continue;
    }

    const wanted = inside ? geofence.enterAlert : geofence.exitAlert;

    if (!wanted) {
      continue;
    }

    const event = {
      geofenceId: geofence._id.toString(),
      geofenceName: geofence.name,
      deviceId: device._id.toString(),
      deviceName: device.name,
      type: inside ? "GEOFENCE_ENTER" : "GEOFENCE_EXIT",
      distance: Math.round(distance),
      at: timestamp,
    };

    events.push(event);

    emitToUser(device.userId, "geofence:triggered", event);

    await notificationService.createNotification({
      userId: device.userId,
      deviceId: device._id,
      type: event.type,
      title: inside
        ? `${device.name} arrived at ${geofence.name}`
        : `${device.name} left ${geofence.name}`,
      message: inside
        ? `${device.name} entered ${geofence.name}.`
        : `${device.name} left ${geofence.name}.`,
      data: { geofenceId: event.geofenceId, geofenceName: geofence.name },
    });
  }

  return events;
};

// When a device is deleted its remembered membership goes with it.
const removeDeviceReferences = (userId, deviceId) =>
  Geofence.updateMany(
    { userId },
    {
      $pull: {
        deviceIds: deviceId,
        deviceStates: { deviceId },
      },
    }
  );

module.exports = {
  createGeofence,
  listGeofences,
  getGeofence,
  updateGeofence,
  deleteGeofence,
  evaluateForLocation,
  removeDeviceReferences,
};
