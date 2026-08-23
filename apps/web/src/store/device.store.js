"use client";

import { create } from "zustand";

import * as deviceService from "@/services/device.service";

// Sorted so the list never reshuffles under the user: online first, then the
// most recently seen.
const sortDevices = (devices) =>
  [...devices].sort((a, b) => {
    if (a.isOnline !== b.isOnline) {
      return a.isOnline ? -1 : 1;
    }

    return new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0);
  });

export const useDeviceStore = create((set, get) => ({
  devices: [],
  loading: true,
  error: null,

  fetchDevices: async () => {
    set({ loading: true, error: null });

    try {
      const data = await deviceService.listDevices();

      set({ devices: sortDevices(data.devices), loading: false });

      return data.devices;
    } catch (error) {
      set({ error: error.message, loading: false });

      return [];
    }
  },

  getDevice: (deviceId) => get().devices.find((device) => device.id === deviceId),

  stats: () => {
    const devices = get().devices;
    const online = devices.filter((device) => device.isOnline).length;

    return { total: devices.length, online, offline: devices.length - online };
  },

  // Socket updates arrive as partial patches; a full replace would wipe fields
  // the event does not carry.
  patchDevice: (deviceId, patch) =>
    set((state) => ({
      devices: sortDevices(
        state.devices.map((device) =>
          device.id === deviceId ? { ...device, ...patch } : device
        )
      ),
    })),

  upsertDevice: (device) =>
    set((state) => {
      const exists = state.devices.some((entry) => entry.id === device.id);

      return {
        devices: sortDevices(
          exists
            ? state.devices.map((entry) =>
                entry.id === device.id ? { ...entry, ...device } : entry
              )
            : [...state.devices, device]
        ),
      };
    }),

  removeDevice: (deviceId) =>
    set((state) => ({
      devices: state.devices.filter((device) => device.id !== deviceId),
    })),

  // device:locationUpdated carries the fix, not the whole device.
  applyLocation: (fix) =>
    set((state) => ({
      devices: sortDevices(
        state.devices.map((device) =>
          device.id === fix.deviceId
            ? {
                ...device,
                isOnline: true,
                lastSeen: fix.timestamp,
                batteryLevel: fix.battery ?? device.batteryLevel,
                lastLocation: {
                  latitude: fix.latitude,
                  longitude: fix.longitude,
                  accuracy: fix.accuracy ?? null,
                  battery: fix.battery ?? null,
                  timestamp: fix.timestamp,
                },
              }
            : device
        )
      ),
    })),

  reset: () => set({ devices: [], loading: true, error: null }),
}));
