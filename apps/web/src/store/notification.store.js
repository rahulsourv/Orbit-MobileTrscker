"use client";

import { create } from "zustand";

import * as notificationService from "@/services/notification.service";

const MAX_HELD = 100;

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: true,

  fetchNotifications: async () => {
    set({ loading: true });

    try {
      const data = await notificationService.listNotifications({ limit: 50 });

      set({
        notifications: data.notifications,
        unreadCount: data.unreadCount,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  // Pushed live over the socket. Guarded against the same alert arriving twice
  // when a fetch and an event race.
  push: (notification) =>
    set((state) => {
      if (state.notifications.some((entry) => entry.id === notification.id)) {
        return state;
      }

      return {
        notifications: [notification, ...state.notifications].slice(0, MAX_HELD),
        unreadCount: state.unreadCount + 1,
      };
    }),

  markAsRead: async (notificationId) => {
    const target = get().notifications.find((entry) => entry.id === notificationId);

    if (!target || target.read) {
      return;
    }

    // Optimistic: the tray should tick down the instant it is clicked.
    set((state) => ({
      notifications: state.notifications.map((entry) =>
        entry.id === notificationId ? { ...entry, read: true } : entry
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));

    try {
      await notificationService.markAsRead(notificationId);
    } catch {
      get().fetchNotifications();
    }
  },

  markAllAsRead: async () => {
    set((state) => ({
      notifications: state.notifications.map((entry) => ({ ...entry, read: true })),
      unreadCount: 0,
    }));

    try {
      await notificationService.markAllAsRead();
    } catch {
      get().fetchNotifications();
    }
  },

  remove: async (notificationId) => {
    const target = get().notifications.find((entry) => entry.id === notificationId);

    set((state) => ({
      notifications: state.notifications.filter(
        (entry) => entry.id !== notificationId
      ),
      unreadCount:
        target && !target.read
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
    }));

    try {
      await notificationService.deleteNotification(notificationId);
    } catch {
      get().fetchNotifications();
    }
  },

  clearAll: async () => {
    set({ notifications: [], unreadCount: 0 });

    try {
      await notificationService.clearAll();
    } catch {
      get().fetchNotifications();
    }
  },

  reset: () => set({ notifications: [], unreadCount: 0, loading: true }),
}));
