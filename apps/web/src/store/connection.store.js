"use client";

import { create } from "zustand";

import * as connectionService from "@/services/connection.service";

// Someone else's devices are kept in their own list, never merged into the
// user's. Mixing them would invite a UI that offers controls the API will
// always refuse.
export const useConnectionStore = create((set, get) => ({
  incoming: [],
  outgoing: [],
  sharedDevices: [],
  loading: true,

  pendingIncoming: () =>
    get().incoming.filter((entry) => entry.status === "pending"),

  fetchAll: async () => {
    try {
      const [connections, shared] = await Promise.all([
        connectionService.listConnections(),
        connectionService.listSharedDevices(),
      ]);

      set({
        incoming: connections.incoming,
        outgoing: connections.outgoing,
        sharedDevices: shared.devices,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  // A request arriving over the socket, for the person being asked.
  pushIncoming: (connection) =>
    set((state) => ({
      incoming: state.incoming.some((entry) => entry.id === connection.id)
        ? state.incoming.map((entry) =>
            entry.id === connection.id ? connection : entry
          )
        : [connection, ...state.incoming],
    })),

  patchOutgoing: (connection) =>
    set((state) => ({
      outgoing: state.outgoing.map((entry) =>
        entry.id === connection.id ? { ...entry, ...connection } : entry
      ),
    })),

  markRevoked: (connectionId) =>
    set((state) => ({
      incoming: state.incoming.map((entry) =>
        entry.id === connectionId ? { ...entry, status: "revoked" } : entry
      ),
      outgoing: state.outgoing.map((entry) =>
        entry.id === connectionId ? { ...entry, status: "revoked" } : entry
      ),
      // Whatever they were sharing stops being visible immediately, rather
      // than lingering until the next fetch.
      sharedDevices: state.sharedDevices.filter(
        (device) => device.connectionId !== connectionId
      ),
    })),

  applySharedLocation: (fix) =>
    set((state) => ({
      sharedDevices: state.sharedDevices.map((device) =>
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
      ),
    })),

  patchSharedDevice: (deviceId, patch) =>
    set((state) => ({
      sharedDevices: state.sharedDevices.map((device) =>
        device.id === deviceId ? { ...device, ...patch } : device
      ),
    })),

  reset: () =>
    set({ incoming: [], outgoing: [], sharedDevices: [], loading: true }),
}));
