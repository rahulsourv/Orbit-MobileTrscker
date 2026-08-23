const env = require("../config/env");
const Location = require("../models/Location");
const Device = require("../models/Device");
const { AppError } = require("../middleware/error.middleware");
const logger = require("../utils/logger");
const { toGeoPoint, metersToRadians } = require("../utils/location");
const { emitToUser } = require("../sockets");
const deviceService = require("./device.service");
const geofenceService = require("./geofence.service");
const connectionService = require("./connection.service");

// A fix dated far in the future is either a broken device clock or an attempt
// to poison history, and one dated before this window is too stale to matter.
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_BACKFILL_MS = 30 * 24 * 60 * 60 * 1000;

const resolveTimestamp = (value) => {
  const timestamp = value ? new Date(value) : new Date();

  if (Number.isNaN(timestamp.getTime())) {
    throw new AppError("Invalid location timestamp", 400);
  }

  const now = Date.now();

  if (timestamp.getTime() > now + MAX_CLOCK_SKEW_MS) {
    throw new AppError("Location timestamp is in the future", 400);
  }

  if (timestamp.getTime() < now - MAX_BACKFILL_MS) {
    throw new AppError("Location timestamp is too old to accept", 400);
  }

  return timestamp;
};

const buildLocationDocument = (device, fix) => ({
  deviceId: device._id,
  userId: device.userId,
  location: toGeoPoint(fix.latitude, fix.longitude),
  accuracy: fix.accuracy ?? null,
  altitude: fix.altitude ?? null,
  speed: fix.speed ?? null,
  heading: fix.heading ?? null,
  battery: fix.battery ?? null,
  timestamp: resolveTimestamp(fix.timestamp),
});

// Mirrors the newest fix onto the device, but only if it really is newer.
// Out-of-order arrivals are normal after an offline stretch and must not drag
// the live marker backwards in time.
const applyToDevice = async (device, document) => {
  const currentTimestamp = device.lastLocation?.timestamp;

  if (currentTimestamp && currentTimestamp >= document.timestamp) {
    return false;
  }

  device.lastLocation = {
    type: "Point",
    coordinates: document.location.coordinates,
    accuracy: document.accuracy,
    battery: document.battery,
    timestamp: document.timestamp,
  };

  return true;
};

const publicFix = (device, document, id = null) => ({
  id,
  deviceId: device._id.toString(),
  deviceName: device.name,
  latitude: document.location.coordinates[1],
  longitude: document.location.coordinates[0],
  accuracy: document.accuracy,
  altitude: document.altitude,
  speed: document.speed,
  heading: document.heading,
  battery: document.battery,
  timestamp: document.timestamp,
});

// Single live fix: store it, move the marker, then evaluate geofences.
const recordLocation = async (device, fix) => {
  if (!device.trackingEnabled) {
    throw new AppError("Tracking is disabled for this device", 403);
  }

  const document = buildLocationDocument(device, fix);

  let saved;

  try {
    saved = await Location.create(document);
  } catch (error) {
    // The unique (device, timestamp) index makes a replayed fix a no-op rather
    // than a duplicate row.
    if (error.code === 11000) {
      throw new AppError("This location was already recorded", 409);
    }

    throw error;
  }

  const moved = await applyToDevice(device, document);

  await deviceService.touchDevice(device, {
    batteryLevel: fix.battery ?? undefined,
  });

  const payload = publicFix(device, document, saved._id.toString());

  if (moved) {
    emitToUser(device.userId, "device:locationUpdated", payload);
    // The same marker moves on the map of anyone the owner shares with.
    await connectionService.emitToWatchers(device, "device:locationUpdated", payload);
  }

  await geofenceService.evaluateForLocation(
    device,
    { latitude: payload.latitude, longitude: payload.longitude },
    document.timestamp
  );

  return payload;
};

// Offline sync. The device uploads whatever it queued while it had no network;
// the batch is applied oldest-first so geofence transitions replay in the order
// they actually happened, and duplicates from an interrupted upload are dropped
// by the unique index rather than rejected as a whole.
const recordLocationBatch = async (device, fixes) => {
  if (!device.trackingEnabled) {
    throw new AppError("Tracking is disabled for this device", 403);
  }

  if (!fixes.length) {
    return { accepted: 0, duplicates: 0, rejected: 0, latest: null };
  }

  if (fixes.length > env.LOCATION_BATCH_MAX) {
    throw new AppError(
      `A batch may contain at most ${env.LOCATION_BATCH_MAX} locations`,
      400
    );
  }

  const documents = [];
  let rejected = 0;

  for (const fix of fixes) {
    try {
      documents.push(buildLocationDocument(device, fix));
    } catch {
      // One bad point should not sink an entire queue that took hours to
      // collect, so it is counted and skipped.
      rejected += 1;
    }
  }

  documents.sort((a, b) => a.timestamp - b.timestamp);

  let inserted = [];

  try {
    inserted = await Location.insertMany(documents, { ordered: false });
  } catch (error) {
    // With ordered:false the write continues past duplicates; the successful
    // inserts come back on the error object.
    inserted = error.insertedDocs || [];

    if (!error.writeErrors && !error.insertedDocs) {
      throw error;
    }
  }

  const duplicates = documents.length - inserted.length;
  const latestDocument = documents[documents.length - 1];

  const moved = await applyToDevice(device, latestDocument);

  await deviceService.touchDevice(device, {
    batteryLevel: latestDocument.battery ?? undefined,
  });

  const payload = publicFix(device, latestDocument);

  if (moved) {
    emitToUser(device.userId, "device:locationUpdated", payload);
    await connectionService.emitToWatchers(device, "device:locationUpdated", payload);
  }

  // Geofences are replayed in order across the whole queue so a trip that
  // happened while offline still produces its enter and exit alerts.
  for (const document of documents) {
    await geofenceService.evaluateForLocation(
      device,
      {
        latitude: document.location.coordinates[1],
        longitude: document.location.coordinates[0],
      },
      document.timestamp
    );
  }

  logger.info("batch location sync", {
    deviceId: device._id.toString(),
    accepted: inserted.length,
    duplicates,
    rejected,
  });

  return {
    accepted: inserted.length,
    duplicates,
    rejected,
    latest: payload,
  };
};

const getHistory = async (userId, deviceId, { from, to, limit = 200, before } = {}) => {
  // Ownership is proven before any history is read.
  await deviceService.findOwnedDevice(userId, deviceId);

  const filter = { deviceId, userId };

  if (from || to || before) {
    filter.timestamp = {};

    if (from) filter.timestamp.$gte = from;
    if (to) filter.timestamp.$lte = to;
    if (before) filter.timestamp.$lt = before;
  }

  const locations = await Location.find(filter)
    .sort({ timestamp: -1 })
    .limit(limit);

  return {
    locations: locations.map((location) => location.toPublic()),
    nextCursor:
      locations.length === limit
        ? locations[locations.length - 1].timestamp
        : null,
  };
};

const getLatestLocation = async (userId, deviceId) => {
  await deviceService.findOwnedDevice(userId, deviceId);

  const location = await Location.findOne({ deviceId, userId }).sort({
    timestamp: -1,
  });

  return location ? location.toPublic() : null;
};

// Every device the user owns that has ever reported, in one payload - this is
// what the live map renders on first load.
const getLiveSnapshot = async (userId) => {
  const devices = await Device.find({ userId }).sort({ name: 1 });

  return devices
    .map((device) => device.toPublic())
    .filter((device) => device.lastLocation !== null);
};

// Geospatial query against the device's current position, the reason
// lastLocation carries a 2dsphere index.
const findDevicesNear = async (userId, { latitude, longitude, radius }) => {
  const devices = await Device.find({
    userId,
    lastLocation: {
      $geoWithin: {
        $centerSphere: [[longitude, latitude], metersToRadians(radius)],
      },
    },
  });

  return devices.map((device) => device.toPublic());
};

const deleteHistory = async (userId, deviceId, { before } = {}) => {
  await deviceService.findOwnedDevice(userId, deviceId);

  const filter = { deviceId, userId };

  if (before) {
    filter.timestamp = { $lt: before };
  }

  const result = await Location.deleteMany(filter);

  return { deleted: result.deletedCount };
};

module.exports = {
  recordLocation,
  recordLocationBatch,
  getHistory,
  getLatestLocation,
  getLiveSnapshot,
  findDevicesNear,
  deleteHistory,
};
