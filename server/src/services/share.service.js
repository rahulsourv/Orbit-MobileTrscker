const env = require("../config/env");
const LocationShare = require("../models/LocationShare");
const { AppError } = require("../middleware/error.middleware");
const { hashToken, generateSecureToken } = require("../utils/hashing");
const deviceService = require("./device.service");

// A share link is a bearer credential handed to someone outside the account, so
// it gets the same treatment as a refresh token: high-entropy, stored only as a
// hash, always expiring, always revocable.
const createShare = async (userId, { deviceId, expiresInMinutes, label }) => {
  const device = await deviceService.findOwnedDevice(userId, deviceId);

  const maxMinutes = env.SHARE_MAX_TTL_HOURS * 60;

  if (expiresInMinutes > maxMinutes) {
    throw new AppError(
      `A share link may last at most ${env.SHARE_MAX_TTL_HOURS} hours`,
      400
    );
  }

  const token = generateSecureToken(32);

  const share = await LocationShare.create({
    userId,
    deviceId: device._id,
    tokenHash: hashToken(token),
    label: label ?? null,
    expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000),
  });

  // The raw token is returned once, at creation. Listing shares later shows
  // metadata only, never a working link.
  return { share: share.toPublic(), token };
};

const listShares = async (userId, { deviceId } = {}) => {
  const filter = { userId };

  if (deviceId) {
    filter.deviceId = deviceId;
  }

  const shares = await LocationShare.find(filter).sort({ createdAt: -1 });

  return shares.map((share) => share.toPublic());
};

const revokeShare = async (userId, shareId) => {
  const share = await LocationShare.findOne({ _id: shareId, userId });

  if (!share) {
    throw new AppError("Share not found", 404);
  }

  if (!share.revokedAt) {
    share.revokedAt = new Date();
    await share.save();
  }

  return share.toPublic();
};

const revokeAllSharesForDevice = async (userId, deviceId) => {
  const result = await LocationShare.updateMany(
    { userId, deviceId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  return { revoked: result.modifiedCount };
};

// The public endpoint. It runs unauthenticated, so the response is deliberately
// minimal: the device's display name, where it is now, and when that was
// measured. No account details, no device id, no history, no battery trend.
const resolveShare = async (token) => {
  if (!token) {
    throw new AppError("Share link not found", 404);
  }

  const share = await LocationShare.findOne({ tokenHash: hashToken(token) });

  // Expired, revoked and never-existed all answer identically, so a link that
  // stopped working reveals nothing about why.
  if (!share || !share.isActive()) {
    throw new AppError("This share link is no longer available", 404);
  }

  const device = await deviceService
    .findOwnedDevice(share.userId, share.deviceId)
    .catch(() => null);

  if (!device) {
    throw new AppError("This share link is no longer available", 404);
  }

  // Counting views is best-effort telemetry for the owner; a failure here must
  // not break the recipient's page.
  LocationShare.updateOne(
    { _id: share._id },
    { $inc: { viewCount: 1 }, $set: { lastViewedAt: new Date() } }
  ).catch(() => {});

  const location = device.lastLocation
    ? {
        latitude: device.lastLocation.coordinates[1],
        longitude: device.lastLocation.coordinates[0],
        accuracy: device.lastLocation.accuracy,
        timestamp: device.lastLocation.timestamp,
      }
    : null;

  return {
    deviceName: device.name,
    deviceType: device.type,
    isOnline: device.isOnline,
    trackingEnabled: device.trackingEnabled,
    location,
    expiresAt: share.expiresAt,
  };
};

module.exports = {
  createShare,
  listShares,
  revokeShare,
  revokeAllSharesForDevice,
  resolveShare,
};
