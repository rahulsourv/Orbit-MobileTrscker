const Notification = require("../models/Notification");
const { AppError } = require("../middleware/error.middleware");
const logger = require("../utils/logger");
const { emitToUser } = require("../sockets");

// Notifications are a side effect of something the user actually asked for
// (a location arriving, a login succeeding). A failure to record one must never
// fail the operation that triggered it, so every raise is caught here.
const createNotification = async ({
  userId,
  deviceId = null,
  type,
  title,
  message,
  data = {},
}) => {
  try {
    const notification = await Notification.create({
      userId,
      deviceId,
      type,
      title,
      message,
      data,
    });

    emitToUser(userId, "notification:new", notification.toPublic());

    return notification;
  } catch (error) {
    logger.error(`failed to create notification: ${error.message}`, { type });
    return null;
  }
};

const listNotifications = async (userId, { unreadOnly = false, limit = 30, before } = {}) => {
  const filter = { userId };

  if (unreadOnly) {
    filter.read = false;
  }

  if (before) {
    filter.createdAt = { $lt: before };
  }

  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit);

  const unreadCount = await Notification.countDocuments({ userId, read: false });

  return {
    notifications: notifications.map((item) => item.toPublic()),
    unreadCount,
    nextCursor:
      notifications.length === limit
        ? notifications[notifications.length - 1].createdAt
        : null,
  };
};

const getUnreadCount = (userId) =>
  Notification.countDocuments({ userId, read: false });

const markAsRead = async (userId, notificationId) => {
  // The owner filter is part of the query, not a check after the fact, so a
  // guessed id simply matches nothing.
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { read: true } },
    { new: true }
  );

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  return notification.toPublic();
};

const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { userId, read: false },
    { $set: { read: true } }
  );

  return { updated: result.modifiedCount };
};

const deleteNotification = async (userId, notificationId) => {
  const result = await Notification.deleteOne({ _id: notificationId, userId });

  if (!result.deletedCount) {
    throw new AppError("Notification not found", 404);
  }

  return { deleted: true };
};

const clearNotifications = async (userId) => {
  const result = await Notification.deleteMany({ userId });

  return { deleted: result.deletedCount };
};

module.exports = {
  createNotification,
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearNotifications,
};
