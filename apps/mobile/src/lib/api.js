import Constants from "expo-constants";

import * as storage from "./storage";

/**
 * The Orbit API as seen from a phone.
 *
 * Two identities live here and they are kept apart on purpose:
 *
 *   - the *user* session (email + password -> access/refresh tokens) is used
 *     only to register or unlink this device;
 *   - the *device* token is what reports positions, and it is all the tracker
 *     ever needs. That is why tracking keeps working for weeks without the
 *     user having to sign in again.
 */
const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.orbitApiUrl ||
  "http://localhost:5000/api";

// Cached so background tasks, which run outside React, do not have to reach
// for storage on every single fix.
let apiUrl = DEFAULT_API_URL;

export const getApiUrl = () => apiUrl;

export const loadApiUrl = async () => {
  const stored = await storage.getApiUrl();

  apiUrl = stored || DEFAULT_API_URL;

  return apiUrl;
};

export const changeApiUrl = async (value) => {
  const trimmed = value.trim().replace(/\/+$/, "");

  apiUrl = trimmed || DEFAULT_API_URL;

  await storage.setApiUrl(apiUrl);

  return apiUrl;
};

export const defaultApiUrl = DEFAULT_API_URL;

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

// A phone is offline often enough that "the network refused" needs to be
// distinguishable from "the server said no".
export class NetworkError extends Error {
  constructor(message = "Could not reach Orbit") {
    super(message);
    this.name = "NetworkError";
  }
}

let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

const request = async (path, { method = "GET", body, headers = {}, timeout = 15000 } = {}) => {
  // Without a timeout a request on a dead network can hang until the OS gives
  // up, which on mobile can be minutes.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        // Tells the API to return the refresh token in the body instead of
        // setting a cookie: there is no cookie jar here, the token goes to
        // SecureStore.
        "x-client-type": "mobile",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new NetworkError(
      error.name === "AbortError" ? "Orbit did not respond in time" : undefined
    );
  } finally {
    clearTimeout(timer);
  }

  const payload =
    response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      payload?.message || "Something went wrong",
      response.status,
      payload?.errors
    );
  }

  return payload?.data ?? payload;
};

const authed = (path, options = {}) =>
  request(path, {
    ...options,
    headers: {
      ...options.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

const withDeviceToken = (deviceToken, path, options = {}) =>
  request(path, {
    ...options,
    headers: { ...options.headers, "x-device-token": deviceToken },
  });

/* ------------------------------------------------------------------ user -- */

export const login = async (email, password) => {
  const data = await request("/auth/login", {
    method: "POST",
    body: { email, password },
  });

  accessToken = data.accessToken;

  // Refresh tokens rotate on every use, so the stored copy has to be replaced
  // each time. Keeping a stale one would look like a replayed token to the
  // server, which treats that as theft and ends every session on the account.
  await storage.setRefreshToken(data.refreshToken);
  await storage.setUser(data.user);

  return data.user;
};

// Creating an account, then signing straight in - the API deliberately does
// not start a session on register, so the first session goes through the
// normal login path.
export const signUp = async ({ name, email, password }) => {
  await request("/auth/register", {
    method: "POST",
    body: { name: name.trim(), email: email.trim(), password },
  });

  return login(email.trim(), password);
};

export const updateProfile = (name) =>
  authed("/auth/me", { method: "PATCH", body: { name } });

export const changePassword = async (currentPassword, newPassword) => {
  const data = await authed("/auth/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
  });

  // Changing a password revokes every session, so the fresh pair returned here
  // has to replace what is stored or this app signs itself out.
  accessToken = data.accessToken;
  await storage.setRefreshToken(data.refreshToken);
  await storage.setUser(data.user);

  return data.user;
};

export const restoreSession = async () => {
  const refreshToken = await storage.getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  const data = await request("/auth/refresh", {
    method: "POST",
    body: { refreshToken },
  });

  accessToken = data.accessToken;

  await storage.setRefreshToken(data.refreshToken);
  await storage.setUser(data.user);

  return data.user;
};

export const logout = async () => {
  const refreshToken = await storage.getRefreshToken();

  try {
    if (refreshToken) {
      await request("/auth/logout", { method: "POST", body: { refreshToken } });
    }
  } catch {
    // The user asked to sign out; local state is cleared either way.
  }

  accessToken = null;
};

/* ---------------------------------------------------------------- device -- */

export const registerDevice = (payload) =>
  authed("/devices", { method: "POST", body: payload });

export const deleteDevice = (deviceId) =>
  authed(`/devices/${deviceId}`, { method: "DELETE" });

export const listDevices = () => authed("/devices");

export const getDevice = (deviceId) => authed(`/devices/${deviceId}`);

export const updateDevice = (deviceId, patch) =>
  authed(`/devices/${deviceId}`, { method: "PATCH", body: patch });

export const setDeviceTracking = (deviceId, trackingEnabled) =>
  authed(`/devices/${deviceId}/tracking`, {
    method: "PUT",
    body: { trackingEnabled },
  });

/* -------------------------------------------------------------- locations -- */

// Everything with a known position, for the map's first paint. Updates after
// that arrive over the socket.
export const getLiveSnapshot = () => authed("/locations/live");

export const getHistory = (deviceId, { from, limit = 500 } = {}) => {
  const params = new URLSearchParams({ limit: String(limit) });

  if (from) {
    params.set("from", new Date(from).toISOString());
  }

  return authed(`/devices/${deviceId}/locations?${params.toString()}`);
};

/* -------------------------------------------------------------- geofences -- */

export const listGeofences = () => authed("/geofences");

export const createGeofence = (payload) =>
  authed("/geofences", { method: "POST", body: payload });

export const updateGeofence = (geofenceId, patch) =>
  authed(`/geofences/${geofenceId}`, { method: "PATCH", body: patch });

export const deleteGeofence = (geofenceId) =>
  authed(`/geofences/${geofenceId}`, { method: "DELETE" });

/* ---------------------------------------------------------- notifications -- */

export const listNotifications = ({ limit = 50 } = {}) =>
  authed(`/notifications?limit=${limit}`);

export const markNotificationRead = (notificationId) =>
  authed(`/notifications/${notificationId}/read`, { method: "PATCH" });

export const markAllNotificationsRead = () =>
  authed("/notifications/read-all", { method: "PATCH" });

export const clearNotifications = () =>
  authed("/notifications", { method: "DELETE" });

/* ------------------------------------------------------------ connections -- */

// Consent-based sharing between accounts. Nothing here reveals anything about
// the other person until they have accepted; the API enforces that.
export const listConnections = () => authed("/connections");

export const listSharedDevices = () => authed("/connections/shared-devices");

export const sendConnectionRequest = (payload) =>
  authed("/connections", { method: "POST", body: payload });

export const acceptConnection = (connectionId, deviceIds) =>
  authed(`/connections/${connectionId}/accept`, {
    method: "POST",
    body: { deviceIds },
  });

export const denyConnection = (connectionId) =>
  authed(`/connections/${connectionId}/deny`, { method: "POST", body: {} });

export const revokeConnection = (connectionId) =>
  authed(`/connections/${connectionId}`, { method: "DELETE" });

export const updateSharedDevices = (connectionId, deviceIds) =>
  authed(`/connections/${connectionId}/devices`, {
    method: "PUT",
    body: { deviceIds },
  });

/* ---------------------------------------------------------------- routing -- */

// Proxied by the API rather than called from the phone, so the provider can
// change without an app update and both clients report identical numbers.
export const getDirections = ({ from, to, mode = "driving" }) => {
  const params = new URLSearchParams({
    fromLat: String(from.latitude),
    fromLng: String(from.longitude),
    toLat: String(to.latitude),
    toLng: String(to.longitude),
    mode,
  });

  return authed(`/routes/directions?${params.toString()}`, { timeout: 20000 });
};

/* --------------------------------------------------------------- sharing -- */

export const listShares = (deviceId) =>
  authed(`/shares${deviceId ? `?deviceId=${deviceId}` : ""}`);

export const createShare = (payload) =>
  authed("/shares", { method: "POST", body: payload });

export const revokeShare = (shareId) =>
  authed(`/shares/${shareId}`, { method: "DELETE" });

/* -------------------------------------------------- device-authenticated -- */

// Confirms the token still works and reports whether the owner currently
// permits tracking. The owner's switch lives on the server, so this is the
// only honest source for it.
export const fetchDeviceSelf = (deviceToken) =>
  withDeviceToken(deviceToken, "/devices/self");

export const sendHeartbeat = (deviceToken, deviceId, batteryLevel) =>
  withDeviceToken(deviceToken, `/devices/${deviceId}/heartbeat`, {
    method: "POST",
    body: batteryLevel === null ? {} : { batteryLevel },
  });

export const sendLocation = (deviceToken, deviceId, fix) =>
  withDeviceToken(deviceToken, `/devices/${deviceId}/locations`, {
    method: "POST",
    body: fix,
  });

// The offline-sync endpoint. Returns { accepted, duplicates, rejected } so the
// caller knows exactly how much of its local queue it may discard.
export const sendLocationBatch = (deviceToken, deviceId, locations) =>
  withDeviceToken(deviceToken, `/devices/${deviceId}/locations/batch`, {
    method: "POST",
    body: { locations },
    timeout: 30000,
  });

export const checkHealth = () => request("/health", { timeout: 8000 });
