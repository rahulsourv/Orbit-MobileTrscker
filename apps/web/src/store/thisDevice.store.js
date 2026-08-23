"use client";

import { create } from "zustand";

import * as deviceClient from "@/lib/deviceClient";

// Same lesson the phone taught: a watcher alone only fires when the machine
// moves, and a laptop on a desk never does. The timer is the guarantee.
const DEFAULT_INTERVAL_SECONDS = 60;

let reportTimer = null;
let watchId = null;
let inFlight = false;

export const useThisDeviceStore = create((set, get) => ({
  // "unknown" until localStorage has been read, so the UI does not flash
  // "not registered" at a computer that is.
  status: "unknown",
  deviceId: null,
  registered: false,
  tracking: false,
  trackingEnabled: true,
  lastFix: null,
  lastReportedAt: null,
  queued: 0,
  error: null,
  intervalSeconds: DEFAULT_INTERVAL_SECONDS,
  supported: true,

  /**
   * Reads what this browser already holds and checks it against the server.
   *
   * The owner may have deleted or rotated this device from another client, in
   * which case the stored token is dead and the computer has to re-register.
   */
  bootstrap: async () => {
    if (typeof window === "undefined") {
      return;
    }

    const supported = Boolean(navigator.geolocation);
    const { token, id } = deviceClient.getStoredDevice();

    if (!token || !id) {
      set({ status: "unregistered", registered: false, supported });
      return;
    }

    try {
      const data = await deviceClient.fetchDeviceSelf(token);

      set({
        status: "registered",
        registered: true,
        deviceId: data.device.id,
        trackingEnabled: data.device.trackingEnabled,
        queued: deviceClient.queueSize(),
        supported,
        error: null,
      });

      // Resume what the owner already switched on, rather than making them
      // re-enable it after every reload. Never turns tracking on by itself.
      if (
        deviceClient.getTrackingWanted() &&
        data.device.trackingEnabled &&
        supported &&
        !get().tracking
      ) {
        get().start();
      }
    } catch (error) {
      // 401 means the token was rotated or the device deleted elsewhere.
      // Anything else is probably a network blip and must not unregister a
      // perfectly good device.
      if (error.status === 401) {
        deviceClient.clearStoredDevice();
        set({
          status: "unregistered",
          registered: false,
          deviceId: null,
          supported,
          error: "This computer was removed from your account. Add it again to resume.",
        });
      } else {
        set({ status: "registered", registered: true, deviceId: id, supported });
      }
    }
  },

  register: async (name, options) => {
    set({ error: null });

    try {
      const { device, reclaimed } = await deviceClient.registerThisBrowser(
        name,
        options
      );

      set({
        status: "registered",
        registered: true,
        deviceId: device.id,
        trackingEnabled: device.trackingEnabled,
      });

      return { device, reclaimed };
    } catch (error) {
      set({ error: error.message });

      throw error;
    }
  },

  reportOnce: async () => {
    const { token, id } = deviceClient.getStoredDevice();

    if (!token || !id || inFlight) {
      return null;
    }

    inFlight = true;

    try {
      const position = await deviceClient.getCurrentPosition();
      const result = await deviceClient.reportFix(token, id, position);

      set({
        lastFix: result.fix,
        queued: deviceClient.queueSize(),
        ...(result.status === "sent"
          ? { lastReportedAt: new Date().toISOString(), error: null }
          : {}),
      });

      // The server is the authority on whether tracking is permitted, so a
      // refusal stops the loop rather than retrying forever.
      if (result.status === "forbidden") {
        get().stop({ remember: false });
        set({ trackingEnabled: false, error: result.message });
      }

      if (result.status === "unauthorized") {
        get().stop();
        deviceClient.clearStoredDevice();
        set({
          status: "unregistered",
          registered: false,
          error: "This computer's token is no longer valid.",
        });
      }

      return result;
    } catch (error) {
      // Permission denied, or no fix available.
      set({ error: error.message || "Could not read this computer's location" });

      return null;
    } finally {
      inFlight = false;
    }
  },

  start: async () => {
    const { intervalSeconds, reportOnce } = get();
    const { token } = deviceClient.getStoredDevice();

    if (!token) {
      set({ error: "Register this computer first" });
      return false;
    }

    if (!navigator.geolocation) {
      set({ error: "This browser cannot report a location", supported: false });
      return false;
    }

    // Ask the server before starting: the owner may have switched this device
    // off from their phone.
    try {
      const data = await deviceClient.fetchDeviceSelf(token);

      if (!data.device.trackingEnabled) {
        set({
          trackingEnabled: false,
          error: "Tracking is switched off for this computer in your account.",
        });

        return false;
      }

      set({ trackingEnabled: true });
    } catch {
      // Offline. Let it try - the report itself will report the real problem.
    }

    get().stop({ remember: false });

    // Movement-driven, so a laptop carried to another room updates promptly.
    watchId = navigator.geolocation.watchPosition(
      () => {
        reportOnce();
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 25000 }
    );

    reportTimer = setInterval(reportOnce, intervalSeconds * 1000);

    deviceClient.setTrackingWanted(true);
    set({ tracking: true, error: null });

    await reportOnce();

    return true;
  },

  stop: ({ remember = true } = {}) => {
    // A deliberate stop is durable; an internal restart (changing the interval)
    // passes remember:false so it does not read as the owner switching off.
    if (remember) {
      deviceClient.setTrackingWanted(false);
    }

    if (reportTimer) {
      clearInterval(reportTimer);
      reportTimer = null;
    }

    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    set({ tracking: false });
  },

  setInterval: (seconds) => {
    set({ intervalSeconds: seconds });

    if (get().tracking) {
      get().stop({ remember: false });
      get().start();
    }
  },

  forget: () => {
    get().stop();
    deviceClient.clearStoredDevice();
    set({
      status: "unregistered",
      registered: false,
      deviceId: null,
      lastFix: null,
      lastReportedAt: null,
      queued: 0,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));
