const notificationService = require("../services/notification.service");

const listNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.listNotifications(
      req.user.id,
      req.validated?.query || {}
    );

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await notificationService.getUnreadCount(req.user.id);

    return res.status(200).json({ success: true, data: { unreadCount } });
  } catch (error) {
    return next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(
      req.user.id,
      req.params.notificationId
    );

    return res.status(200).json({ success: true, data: { notification } });
  } catch (error) {
    return next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllAsRead(req.user.id);

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    await notificationService.deleteNotification(
      req.user.id,
      req.params.notificationId
    );

    return res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (error) {
    return next(error);
  }
};

const clearNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.clearNotifications(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Notifications cleared",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearNotifications,
};
