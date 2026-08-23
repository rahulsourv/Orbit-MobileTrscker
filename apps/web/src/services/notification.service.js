import { api } from "@/lib/api";

export const listNotifications = ({ unreadOnly = false, limit = 50 } = {}) => {
  const params = new URLSearchParams({ limit: String(limit) });

  if (unreadOnly) params.set("unreadOnly", "true");

  return api.get(`/notifications?${params.toString()}`);
};

export const getUnreadCount = () => api.get("/notifications/unread-count");

export const markAsRead = (notificationId) =>
  api.patch(`/notifications/${notificationId}/read`, {});

export const markAllAsRead = () => api.patch("/notifications/read-all", {});

export const deleteNotification = (notificationId) =>
  api.delete(`/notifications/${notificationId}`);

export const clearAll = () => api.delete("/notifications");
