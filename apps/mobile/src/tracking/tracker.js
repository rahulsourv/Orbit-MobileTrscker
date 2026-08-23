import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Battery from "expo-battery";

import * as storage from "../lib/storage";
import * as api from "../lib/api";
import { NetworkError } from "../lib/api";
import { enqueue, flushQueue } from "../lib/queue";
import { toFix } from "../lib/fix";

export const LOCATION_TASK = "orbit-location-task";

/**
 * The tracker.
 *
 * Everything here has to work from two very different places: the app's React
 * tree, and the background task, which the OS runs in a separate JavaScript
 * context with no access to component state. So configuration is always read
 * from storage rather than passed in, and nothing here touches React.
 */

const readBattery = async () => {
  try {
    const level = await Battery.getBatteryLevelAsync();

    // -1 means the platform could not tell us.
    return level >= 0 ? Math.round(level * 100) : null;
  } catch {
    return null;
  }
};

/**
 * Anyone who wants to know as soon as a fix is reported.
 *
 * Without this the screen could only show what it last pulled from storage,
 * which is why it used to need a manual refresh to move. Listeners only fire
 * in the app's own JS context — the background task runs in a separate one and
 * cannot reach them, so the UI still re-reads storage when it regains focus.
 */
const fixListeners = new Set();

export const onFixReported = (listener) => {
  fixListeners.add(listener);

  return () => fixListeners.delete(listener);
};

const notifyFixReported = (payload) => {
  for (const listener of fixListeners) {
    try {
      listener(payload);
    } catch {
      // A broken listener must never break reporting.
    }
  }
};

/**
 * Reports one fix, falling back to the queue when the network is gone.
 *
 * Returns what happened so the UI can say so honestly rather than implying
 * everything reached the server.
 */
export const reportFix = async (location) => {
  const [deviceToken, deviceId] = await Promise.all([
    storage.getDeviceToken(),
    storage.getDeviceId(),
  ]);

  if (!deviceToken || !deviceId) {
    return { status: "unlinked" };
  }

  const batteryLevel = await readBattery();
  const fix = toFix(location, batteryLevel);

  const report = (result) => {
    notifyFixReported(result);

    return result;
  };

  try {
    await api.sendLocation(deviceToken, deviceId, fix);
    await storage.setLastSync(new Date().toISOString());

    // A successful send proves the network is back, so this is the natural
    // moment to drain anything that piled up while it was gone.
    const { flushed } = await flushQueue(deviceToken, deviceId);

    return report({ status: "sent", fix, flushed });
  } catch (error) {
    if (error instanceof NetworkError) {
      const queued = await enqueue(fix);

      return report({ status: "queued", fix, queued });
    }

    // 409 is the server saying it already has this exact fix - harmless, and
    // never worth queueing a retry for.
    if (error.status === 409) {
      return report({ status: "duplicate", fix });
    }

    // 403 means the owner switched tracking off. The server is the authority
    // on that, so the device stops rather than arguing.
    if (error.status === 403) {
      await stopTracking();

      return report({ status: "forbidden", fix, message: error.message });
    }

    if (error.status === 401) {
      return report({ status: "unauthorized", fix, message: error.message });
    }

    // Server-side trouble: hold the fix rather than losing it.
    const queued = await enqueue(fix);

    return report({ status: "queued", fix, queued, message: error.message });
  }
};

export const sendHeartbeat = async () => {
  const [deviceToken, deviceId] = await Promise.all([
    storage.getDeviceToken(),
    storage.getDeviceId(),
  ]);

  if (!deviceToken || !deviceId) {
    return null;
  }

  try {
    const batteryLevel = await readBattery();

    return await api.sendHeartbeat(deviceToken, deviceId, batteryLevel);
  } catch {
    return null;
  }
};

/* ----------------------------------------------------------- permissions -- */

/**
 * Android 13+ hides the foreground-service notification unless notifications
 * are permitted - and that notification is the whole reason Orbit cannot track
 * quietly. Being refused is not fatal, so it is asked for but never blocks.
 */
const requestNotificationPermission = async () => {
  try {
    // Required lazily rather than imported: this module is evaluated by the
    // background task at bundle load, and expo-notifications is restricted in
    // Expo Go on Android. A missing or unhappy module should cost us a badge,
    // not the whole app.
    const Notifications = require("expo-notifications");

    const existing = await Notifications.getPermissionsAsync();

    if (existing.granted) {
      return true;
    }

    const asked = await Notifications.requestPermissionsAsync();

    return asked.granted;
  } catch {
    return false;
  }
};

export const requestPermissions = async ({ background = true } = {}) => {
  const foreground = await Location.requestForegroundPermissionsAsync();

  if (foreground.status !== "granted") {
    return {
      granted: false,
      background: false,
      notifications: false,
      message:
        "Orbit needs location access to report where this device is. You can grant it in Settings.",
    };
  }

  if (!background) {
    return { granted: true, background: false, notifications: false };
  }

  // Asked before the background grant: the notification is what makes
  // background tracking visible, so it should exist by the time it starts.
  const notifications = await requestNotificationPermission();

  // Both platforms require the foreground grant first, and Android 11+ sends
  // the user to Settings rather than showing a second dialog. Being refused
  // here is not fatal: tracking still works while the app is open.
  const always = await Location.requestBackgroundPermissionsAsync();

  return {
    granted: true,
    background: always.status === "granted",
    notifications,
    message:
      always.status !== "granted"
        ? "Background location was not granted, so Orbit can only report while the app is open."
        : notifications
          ? undefined
          : "Notifications are blocked, so Android will hide the badge that shows tracking is running. Orbit will still report.",
  };
};

export const getPermissionState = async () => {
  const [foreground, background, servicesEnabled] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
    Location.hasServicesEnabledAsync(),
  ]);

  return {
    foreground: foreground.status === "granted",
    background: background.status === "granted",
    servicesEnabled,
  };
};

/* -------------------------------------------------------------- tracking -- */

/**
 * Whether this runtime can run a background task at all.
 *
 * False in Expo Go on Android, and background execution is unsupported there
 * on iOS too. Asking the capability directly is more honest than trying to
 * infer the environment: `executionEnvironment` reports StoreClient for both
 * Expo Go and a dev-client build, so it cannot tell them apart.
 */
export const isBackgroundAvailable = async () => {
  try {
    if (typeof TaskManager.isAvailableAsync === "function") {
      return await TaskManager.isAvailableAsync();
    }
  } catch {
    // Fall through and assume it might work; startTracking will find out.
  }

  return true;
};

// When the background task is unavailable we fall back to watching from the
// app's own JS context. That only survives while the app is open, which is
// exactly the limitation Expo Go has - so the UI is told, rather than the app
// quietly pretending it is still reporting.
let foregroundWatch = null;
let foregroundTimer = null;
let activeIntervalMs = 0;
let lastReportAt = 0;

/**
 * Two mechanisms, because neither is sufficient alone.
 *
 * watchPositionAsync only fires when the device *moves*: its distanceInterval
 * is a threshold, and its timeInterval is Android-only. A phone sitting on a
 * desk therefore reports nothing at all, which is the bug this exists to fix.
 *
 * So a plain timer asks for a position on a schedule, which is deterministic on
 * both platforms and works standing still. The watcher is kept alongside it
 * purely for responsiveness, so movement shows up without waiting for the next
 * tick, and a throttle stops the two from double-reporting.
 */
const reportThrottled = async (location) => {
  const minimumGap = activeIntervalMs * 0.6;

  if (Date.now() - lastReportAt < minimumGap) {
    return;
  }

  lastReportAt = Date.now();

  try {
    await reportFix(location);
  } catch {
    // reportFix already queues anything it could not send.
  }
};

// Acquiring a fix can outlast the interval on a cold GPS lock, so ticks are
// skipped rather than allowed to pile up on top of each other.
let fixInFlight = false;

const reportCurrentPosition = async () => {
  if (fixInFlight) {
    return;
  }

  fixInFlight = true;

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    lastReportAt = Date.now();
    await reportFix(location);
  } catch {
    // No fix available right now - the next tick will try again.
  } finally {
    fixInFlight = false;
  }
};

const startForegroundWatch = async ({ intervalSeconds }) => {
  await stopForegroundWatch();

  activeIntervalMs = intervalSeconds * 1000;
  lastReportAt = 0;

  // distanceInterval 0 so movement is reported as it happens rather than only
  // after some arbitrary threshold.
  foregroundWatch = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: activeIntervalMs,
      distanceInterval: 0,
    },
    (location) => {
      reportThrottled(location);
    }
  );

  // The guarantee: a report every interval whether or not anything moved.
  foregroundTimer = setInterval(reportCurrentPosition, activeIntervalMs);
};

const stopForegroundWatch = async () => {
  if (foregroundWatch) {
    foregroundWatch.remove();
    foregroundWatch = null;
  }

  if (foregroundTimer) {
    clearInterval(foregroundTimer);
    foregroundTimer = null;
  }
};

export const isForegroundOnly = () => foregroundWatch !== null;

export const isTracking = async () => {
  if (foregroundWatch) {
    return true;
  }

  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    return false;
  }
};

/**
 * Starts reporting.
 *
 * The Android foreground-service notification is not optional here, and not
 * only because the platform requires it: a tracker that can run invisibly is
 * exactly what Orbit refuses to be. While this is on, the phone says so.
 */
export const startTracking = async (options = {}) => {
  // The owner's chosen cadence, not a hard-coded one.
  const intervalSeconds =
    options.intervalSeconds || (await storage.getReportInterval());

  const deviceToken = await storage.getDeviceToken();

  if (!deviceToken) {
    throw new Error("This device is not linked to an Orbit account yet");
  }

  // The owner's switch beats anything stored locally.
  const self = await api.fetchDeviceSelf(deviceToken);

  if (!self.device.trackingEnabled) {
    throw new Error(
      "Tracking is switched off for this device in your Orbit account"
    );
  }

  const permissions = await getPermissionState();

  if (!permissions.foreground) {
    throw new Error("Location permission has not been granted");
  }

  if (await isTracking()) {
    return { alreadyRunning: true };
  }

  if (await isBackgroundAvailable()) {
    try {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: intervalSeconds * 1000,
        // Zero, not a distance threshold: a device left on a desk must still
        // report, otherwise it silently looks offline.
        distanceInterval: 0,
        // Batching lets Android sleep the radio between fixes, which is the
        // difference between a day of battery and an afternoon.
        deferredUpdatesInterval: intervalSeconds * 1000,
        deferredUpdatesDistance: 0,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "Orbit is sharing this device's location",
          notificationBody: "Tap to open Orbit and stop.",
          notificationColor: "#22d3ee",
          killServiceOnDestroy: false,
        },
      });

      return {
        alreadyRunning: false,
        mode: "background",
        background: permissions.background,
        intervalSeconds,
      };
    } catch {
      // Some runtimes report the task API as available and still refuse to
      // start it. Reporting while open beats not reporting at all.
    }
  }

  await startForegroundWatch({ intervalSeconds });

  return {
    alreadyRunning: false,
    mode: "foreground",
    background: false,
    intervalSeconds,
  };
};

export const stopTracking = async () => {
  await stopForegroundWatch();

  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch {
    // Already stopped, or the task was never registered.
  }
};

// Called when the device is unlinked or the app signs out: the OS keeps the
// background task running otherwise, and it would keep trying with a token
// that no longer exists.
// Changing the cadence means restarting whichever mechanism is running.
export const restartTracking = async () => {
  if (!(await isTracking())) {
    return null;
  }

  await stopTracking();

  return startTracking();
};

export const teardown = async () => {
  await stopTracking();

  try {
    if (await TaskManager.isTaskRegisteredAsync(LOCATION_TASK)) {
      await TaskManager.unregisterTaskAsync(LOCATION_TASK);
    }
  } catch {
    // Nothing registered.
  }
};

export const getCurrentPosition = async () => {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return location;
};

export const readBatteryLevel = readBattery;

export { toFix };
