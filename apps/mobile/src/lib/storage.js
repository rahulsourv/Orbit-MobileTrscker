import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

/**
 * Two tiers of storage, chosen by sensitivity.
 *
 * SecureStore (Keychain / Keystore) holds anything that authenticates us: the
 * refresh token and the device token. AsyncStorage holds ordinary config and
 * the offline queue, which are not secrets.
 */
const SECURE_KEYS = {
  refreshToken: "orbit.refreshToken",
  deviceToken: "orbit.deviceToken",
};

const PLAIN_KEYS = {
  apiUrl: "orbit.apiUrl",
  deviceId: "orbit.deviceId",
  deviceIdentifier: "orbit.deviceIdentifier",
  deviceName: "orbit.deviceName",
  user: "orbit.user",
  queue: "orbit.queue",
  lastSync: "orbit.lastSync",
  reportInterval: "orbit.reportInterval",
  trackingWanted: "orbit.trackingWanted",
};

// How often a tracking device reports, in seconds. Frequent enough to feel
// live, sparse enough not to eat the battery.
export const DEFAULT_REPORT_INTERVAL = 30;

// SecureStore throws on some devices rather than returning null; a missing
// value and an unreadable keystore should both read as "not signed in".
const secureGet = async (key) => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

const secureSet = async (key, value) => {
  if (value === null || value === undefined) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Deleting something that was never there is not a failure.
    }
    return;
  }

  await SecureStore.setItemAsync(key, value);
};

export const getRefreshToken = () => secureGet(SECURE_KEYS.refreshToken);
export const setRefreshToken = (value) => secureSet(SECURE_KEYS.refreshToken, value);

export const getDeviceToken = () => secureGet(SECURE_KEYS.deviceToken);
export const setDeviceToken = (value) => secureSet(SECURE_KEYS.deviceToken, value);

const plainGet = async (key) => {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

const plainSet = async (key, value) => {
  if (value === null || value === undefined) {
    await AsyncStorage.removeItem(key);
    return;
  }

  await AsyncStorage.setItem(key, value);
};

export const getApiUrl = () => plainGet(PLAIN_KEYS.apiUrl);
export const setApiUrl = (value) => plainSet(PLAIN_KEYS.apiUrl, value);

export const getDeviceId = () => plainGet(PLAIN_KEYS.deviceId);
export const setDeviceId = (value) => plainSet(PLAIN_KEYS.deviceId, value);

export const getDeviceName = () => plainGet(PLAIN_KEYS.deviceName);
export const setDeviceName = (value) => plainSet(PLAIN_KEYS.deviceName, value);

/**
 * Whether the owner has tracking switched on.
 *
 * Remembered so the choice survives a restart: having to re-enable tracking
 * every launch means a device is silently not reporting exactly when you most
 * need it to be. This is only the owner's *intent* - the server still decides
 * whether reporting is permitted, and every indicator still shows while it runs.
 */
export const getTrackingWanted = async () =>
  (await plainGet(PLAIN_KEYS.trackingWanted)) === "true";

export const setTrackingWanted = (wanted) =>
  plainSet(PLAIN_KEYS.trackingWanted, wanted ? "true" : "false");

export const getReportInterval = async () => {
  const raw = await plainGet(PLAIN_KEYS.reportInterval);
  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed >= 10 ? parsed : DEFAULT_REPORT_INTERVAL;
};

export const setReportInterval = (seconds) =>
  plainSet(PLAIN_KEYS.reportInterval, String(seconds));

export const getLastSync = () => plainGet(PLAIN_KEYS.lastSync);
export const setLastSync = (value) => plainSet(PLAIN_KEYS.lastSync, value);

export const getUser = async () => {
  const raw = await plainGet(PLAIN_KEYS.user);

  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setUser = (user) =>
  plainSet(PLAIN_KEYS.user, user ? JSON.stringify(user) : null);

/**
 * A stable identifier for this physical device.
 *
 * IMEI is not an option: Android 10+ restricts it to system and carrier apps,
 * and iOS has never exposed it or any hardware serial. What each platform does
 * offer is the closest legitimate equivalent:
 *
 *   Android  Settings.Secure.ANDROID_ID - unique per device, user and signing
 *            key, and crucially it survives reinstalling the app. It changes
 *            only on a factory reset or a change of signing key.
 *   iOS      identifierForVendor - stable while any app from this vendor is
 *            installed, and regenerated once they are all removed.
 *
 * Both are what Apple and Google actually intend apps to use, and both mean a
 * reinstall reconnects the existing device instead of creating a duplicate.
 *
 * The random fallback remains for anything that offers neither, and is cached
 * so it stays put for as long as storage does.
 */
export const getOrCreateDeviceIdentifier = async () => {
  const cached = await plainGet(PLAIN_KEYS.deviceIdentifier);

  if (cached) {
    return cached;
  }

  let hardware = null;

  try {
    const Application = require("expo-application");

    if (Platform.OS === "android") {
      hardware = Application.getAndroidId();
    } else if (Platform.OS === "ios") {
      hardware = await Application.getIosIdForVendorAsync();
    }
  } catch {
    // Not available in this runtime - fall through to the random identifier.
  }

  const identifier = hardware
    ? `orbit-${hardware.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32)}`
    : `orbit-${Crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

  await plainSet(PLAIN_KEYS.deviceIdentifier, identifier);

  return identifier;
};

export const readQueue = async () => {
  const raw = await plainGet(PLAIN_KEYS.queue);

  try {
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeQueue = (items) =>
  plainSet(PLAIN_KEYS.queue, JSON.stringify(items));

// Used when signing out or unlinking: everything identifying goes, including
// any positions still waiting to be uploaded.
export const clearAll = async () => {
  await Promise.all([
    secureSet(SECURE_KEYS.refreshToken, null),
    secureSet(SECURE_KEYS.deviceToken, null),
    plainSet(PLAIN_KEYS.deviceId, null),
    plainSet(PLAIN_KEYS.deviceName, null),
    plainSet(PLAIN_KEYS.user, null),
    plainSet(PLAIN_KEYS.queue, null),
    plainSet(PLAIN_KEYS.lastSync, null),
    plainSet(PLAIN_KEYS.trackingWanted, null),
  ]);

  // The identifier itself is deliberately kept. On a hardware-backed platform
  // it would be re-derived identically anyway, and keeping it means unlinking
  // and re-adding reconnects the same device rather than orphaning its history.
};
