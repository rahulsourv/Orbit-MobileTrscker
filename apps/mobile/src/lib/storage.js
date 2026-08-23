import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

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
 * A stable identifier for this installation.
 *
 * Deliberately random rather than derived from hardware ids: those are not
 * reliably unique, are restricted on modern Android and iOS, and using them
 * would make the identifier a fingerprint of the phone rather than of this
 * app's registration.
 */
export const getOrCreateDeviceIdentifier = async () => {
  const existing = await plainGet(PLAIN_KEYS.deviceIdentifier);

  if (existing) {
    return existing;
  }

  const identifier = `orbit-${Crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

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
  ]);
};
