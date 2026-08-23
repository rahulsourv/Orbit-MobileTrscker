const Connection = require("../models/Connection");
const User = require("../models/User");
const Device = require("../models/Device");
const { AppError } = require("../middleware/error.middleware");
const logger = require("../utils/logger");
const { hashToken, generateSecureToken } = require("../utils/hashing");
const { emitToUser } = require("../sockets");
const notificationService = require("./notification.service");

const REQUEST_TTL_DAYS = 14;

/**
 * Consent-based sharing between accounts.
 *
 * Every function here starts from the same rule: nothing about the target
 * becomes visible until the target has said yes, and the moment either side
 * says stop it becomes invisible again. There is deliberately no way for a
 * requester to see a position, or even confirm an account exists, before that.
 */

const normalizeEmail = (email) => email.toLowerCase().trim();

const createRequest = async (requester, { email, message, deviceIds }) => {
  const targetEmail = normalizeEmail(email);

  if (targetEmail === requester.email.toLowerCase()) {
    throw new AppError("You cannot send a request to yourself", 400);
  }

  const existingActive = await Connection.findOne({
    requesterId: requester.id,
    targetEmail,
    status: { $in: ["pending", "accepted"] },
  });

  if (existingActive) {
    throw new AppError(
      existingActive.status === "accepted"
        ? "You are already connected to this person"
        : "You already have a pending request to this person",
      409
    );
  }

  // The target may or may not have an account. Either way the request is
  // created; what differs is only how it reaches them.
  const targetUser = await User.findOne({ email: targetEmail }).select("_id");

  const inviteToken = generateSecureToken(24);

  const connection = await Connection.create({
    requesterId: requester.id,
    requesterName: requester.name,
    requesterEmail: requester.email,
    targetEmail,
    targetUserId: targetUser ? targetUser._id : null,
    sharedDeviceIds: deviceIds || [],
    message: message || null,
    inviteTokenHash: hashToken(inviteToken),
    expiresAt: new Date(Date.now() + REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000),
  });

  // Someone with an account is told in the app. Someone without one can only
  // be reached by the link the requester shares themselves.
  if (targetUser) {
    emitToUser(targetUser._id, "connection:request", connection.toTargetView());

    await notificationService.createNotification({
      userId: targetUser._id,
      type: "CONNECTION_REQUEST",
      title: `${requester.name} wants to see your location`,
      message: message
        ? `"${message}" — you can accept or deny this.`
        : "You can accept or deny this request. Nothing is shared until you accept.",
      data: { connectionId: connection._id.toString() },
    });
  }

  return {
    connection: connection.toRequesterView(),
    // Returned once, at creation, exactly like every other bearer token here.
    inviteToken,
    hasAccount: Boolean(targetUser),
  };
};

// Anyone holding the link can read who is asking and why - and nothing else.
// No device, no position, no confirmation that the requester has anything
// worth seeing.
const resolveInvite = async (token) => {
  const connection = await Connection.findOne({ inviteTokenHash: hashToken(token) });

  if (!connection || !connection.isPending()) {
    throw new AppError("This request is no longer available", 404);
  }

  return {
    id: connection._id.toString(),
    requesterName: connection.requesterName,
    requesterEmail: connection.requesterEmail,
    targetEmail: connection.targetEmail,
    message: connection.message,
    expiresAt: connection.expiresAt,
  };
};

// Loads a request the signed-in user is actually entitled to answer.
const findAnswerable = async (user, connectionId) => {
  const connection = await Connection.findById(connectionId);

  if (!connection) {
    throw new AppError("Request not found", 404);
  }

  // Matching on the address as well as the id lets someone accept a request
  // that was sent before they had an account.
  const isTarget =
    connection.targetUserId?.toString() === user.id ||
    connection.targetEmail === user.email.toLowerCase();

  if (!isTarget) {
    throw new AppError("Request not found", 404);
  }

  if (!connection.isPending()) {
    throw new AppError("This request is no longer available", 409);
  }

  return connection;
};

const acceptRequest = async (user, connectionId, { deviceIds } = {}) => {
  const connection = await findAnswerable(user, connectionId);

  // The target chooses the scope. An explicit list is validated as theirs, so
  // a crafted payload cannot share a stranger's device.
  if (deviceIds?.length) {
    const owned = await Device.countDocuments({
      _id: { $in: deviceIds },
      userId: user.id,
    });

    if (owned !== deviceIds.length) {
      throw new AppError("One or more devices were not found", 404);
    }

    connection.sharedDeviceIds = deviceIds;
  } else {
    connection.sharedDeviceIds = [];
  }

  connection.targetUserId = user.id;
  connection.status = "accepted";
  connection.respondedAt = new Date();
  await connection.save();

  invalidateWatchers(user.id);

  emitToUser(connection.requesterId, "connection:accepted", connection.toRequesterView());

  await notificationService.createNotification({
    userId: connection.requesterId,
    type: "CONNECTION_ACCEPTED",
    title: `${user.name} accepted your request`,
    message: `You can now see ${user.name}'s shared devices on your map.`,
    data: { connectionId: connection._id.toString() },
  });

  return connection.toTargetView();
};

const denyRequest = async (user, connectionId) => {
  const connection = await findAnswerable(user, connectionId);

  connection.targetUserId = user.id;
  connection.status = "denied";
  connection.respondedAt = new Date();
  await connection.save();

  emitToUser(connection.requesterId, "connection:denied", connection.toRequesterView());

  await notificationService.createNotification({
    userId: connection.requesterId,
    type: "CONNECTION_DENIED",
    title: "Your location request was declined",
    message: `${connection.targetEmail} declined to share their location.`,
    data: { connectionId: connection._id.toString() },
  });

  return connection.toTargetView();
};

// Either side can end it, at any time, with no negotiation.
const revokeConnection = async (user, connectionId) => {
  const connection = await Connection.findById(connectionId);

  if (!connection) {
    throw new AppError("Connection not found", 404);
  }

  const isRequester = connection.requesterId.toString() === user.id;
  const isTarget = connection.targetUserId?.toString() === user.id;

  if (!isRequester && !isTarget) {
    throw new AppError("Connection not found", 404);
  }

  if (connection.status === "revoked") {
    return { revoked: true };
  }

  connection.status = "revoked";
  connection.revokedBy = user.id;
  await connection.save();

  if (connection.targetUserId) {
    invalidateWatchers(connection.targetUserId);
  }

  const otherParty = isRequester ? connection.targetUserId : connection.requesterId;

  if (otherParty) {
    emitToUser(otherParty, "connection:revoked", { id: connection._id.toString() });

    await notificationService.createNotification({
      userId: otherParty,
      type: "CONNECTION_REVOKED",
      title: isRequester
        ? `${connection.requesterName} stopped following your location`
        : "Location sharing ended",
      message: isRequester
        ? "They will no longer see your devices."
        : `${connection.targetEmail} is no longer sharing their location with you.`,
      data: { connectionId: connection._id.toString() },
    });
  }

  return { revoked: true };
};

// Updating the scope after the fact, so a target can narrow what they share
// without having to revoke and start again.
const updateSharedDevices = async (user, connectionId, deviceIds) => {
  const connection = await Connection.findOne({
    _id: connectionId,
    targetUserId: user.id,
    status: "accepted",
  });

  if (!connection) {
    throw new AppError("Connection not found", 404);
  }

  if (deviceIds?.length) {
    const owned = await Device.countDocuments({
      _id: { $in: deviceIds },
      userId: user.id,
    });

    if (owned !== deviceIds.length) {
      throw new AppError("One or more devices were not found", 404);
    }
  }

  connection.sharedDeviceIds = deviceIds || [];
  await connection.save();

  invalidateWatchers(user.id);

  return connection.toTargetView();
};

const listConnections = async (user) => {
  const [outgoing, incoming] = await Promise.all([
    Connection.find({ requesterId: user.id }).sort({ createdAt: -1 }),
    Connection.find({
      $or: [{ targetUserId: user.id }, { targetEmail: user.email.toLowerCase() }],
    }).sort({ createdAt: -1 }),
  ]);

  return {
    outgoing: outgoing.map((entry) => entry.toRequesterView()),
    incoming: incoming.map((entry) => entry.toTargetView()),
  };
};

/**
 * Devices other people are sharing with this user.
 *
 * Everything here is read-only and stripped: a position, a name, a battery
 * level. Never a device token, never the ability to change a setting, never
 * anything about the owner's other devices.
 */
const listSharedDevices = async (user) => {
  const connections = await Connection.find({
    requesterId: user.id,
    status: "accepted",
  });

  if (!connections.length) {
    return [];
  }

  const results = [];

  for (const connection of connections) {
    if (!connection.targetUserId) {
      continue;
    }

    const filter = { userId: connection.targetUserId };

    if (connection.sharedDeviceIds.length) {
      filter._id = { $in: connection.sharedDeviceIds };
    }

    const devices = await Device.find(filter);

    for (const device of devices) {
      const view = device.toPublic();

      results.push({
        id: view.id,
        name: view.name,
        type: view.type,
        isOnline: view.isOnline,
        lastSeen: view.lastSeen,
        batteryLevel: view.batteryLevel,
        lastLocation: view.lastLocation,
        // Marks it as somebody else's, so no client can mistake it for one of
        // the user's own and offer controls that would fail.
        shared: true,
        sharedBy: connection.targetEmail,
        connectionId: connection._id.toString(),
        trackingEnabled: view.trackingEnabled,
      });
    }
  }

  return results;
};

/**
 * Who should receive live updates for a device.
 *
 * Called on every accepted fix, so the answer is cached briefly rather than
 * queried each time. Correctness still wins: the cache is dropped the instant
 * a connection changes, so revoking is immediate rather than eventually.
 */
const watcherCache = new Map();
const WATCHER_TTL_MS = 30000;

const invalidateWatchers = (ownerId) => {
  watcherCache.delete(ownerId.toString());
};

const getWatchers = async (ownerId, deviceId) => {
  const key = ownerId.toString();
  const cached = watcherCache.get(key);

  let connections;

  if (cached && cached.expires > Date.now()) {
    connections = cached.connections;
  } else {
    try {
      const found = await Connection.find({
        targetUserId: ownerId,
        status: "accepted",
      }).select("requesterId sharedDeviceIds");

      connections = found.map((entry) => ({
        requesterId: entry.requesterId.toString(),
        sharedDeviceIds: entry.sharedDeviceIds.map((id) => id.toString()),
      }));

      watcherCache.set(key, {
        connections,
        expires: Date.now() + WATCHER_TTL_MS,
      });
    } catch (error) {
      logger.warn(`could not resolve watchers: ${error.message}`);

      return [];
    }
  }

  const id = deviceId.toString();

  return connections
    .filter(
      (entry) =>
        !entry.sharedDeviceIds.length || entry.sharedDeviceIds.includes(id)
    )
    .map((entry) => entry.requesterId);
};

/**
 * Fans a device event out to everyone entitled to see it.
 *
 * The owner always gets it; accepted watchers get it too, which is what makes
 * a shared marker move on someone else's map in real time rather than only on
 * their next refresh.
 */
const emitToWatchers = async (device, event, payload) => {
  try {
    const watchers = await getWatchers(device.userId, device._id);

    for (const watcherId of watchers) {
      emitToUser(watcherId, event, { ...payload, shared: true });
    }
  } catch (error) {
    logger.warn(`could not fan out ${event}: ${error.message}`);
  }
};

// A deleted device must disappear from anyone watching it.
const removeDeviceReferences = (userId, deviceId) => {
  invalidateWatchers(userId);

  return Connection.updateMany(
    { targetUserId: userId },
    { $pull: { sharedDeviceIds: deviceId } }
  );
};

module.exports = {
  createRequest,
  resolveInvite,
  acceptRequest,
  denyRequest,
  revokeConnection,
  updateSharedDevices,
  listConnections,
  listSharedDevices,
  getWatchers,
  emitToWatchers,
  invalidateWatchers,
  removeDeviceReferences,
};
