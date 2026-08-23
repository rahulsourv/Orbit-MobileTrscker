import { api, API_URL } from "@/lib/api";

/**
 * The browser acting as a tracked device, not just a dashboard.
 *
 * Without this a laptop can watch every other device and never appear on the
 * map itself, which is why a phone could see nothing for it. Registering here
 * gives the computer the same standing as any phone: it reports its own
 * position, its owner can switch it off, and it shows up for every other device
 * on the account automatically.
 */

const TOKEN_KEY = "orbit.thisDevice.token";
const ID_KEY = "orbit.thisDevice.id";
const IDENTIFIER_KEY = "orbit.thisDevice.identifier";
const QUEUE_KEY = "orbit.thisDevice.queue";

const MAX_QUEUED = 200;

/**
 * The device token lives in localStorage, which is a deliberate exception to
 * the rule that keeps the refresh token out of it.
 *
 * The trade is not close. A stolen device token lets an attacker spoof this one
 * computer's position; a stolen refresh token is the whole account. And the
 * alternative - reporting with the user's access token - would need that token
 * readable by the same script anyway, so it protects nothing and gives up more.
 * The owner can rotate or delete this device from the dashboard at any time.
 */
const read = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key, value) => {
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Private browsing, or storage disabled. Tracking simply will not persist.
  }
};

export const getStoredDevice = () => {
  if (typeof window === "undefined") {
    return { token: null, id: null };
  }

  return { token: read(TOKEN_KEY), id: read(ID_KEY) };
};

export const clearStoredDevice = () => {
  write(TOKEN_KEY, null);
  write(ID_KEY, null);
  write(QUEUE_KEY, null);
};

// Stable per browser profile, and deliberately random rather than a
// fingerprint: it identifies this registration, not this machine.
const getOrCreateIdentifier = () => {
  const existing = read(IDENTIFIER_KEY);

  if (existing) {
    return existing;
  }

  const identifier = `orbit-web-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

  write(IDENTIFIER_KEY, identifier);

  return identifier;
};

const detectPlatform = () => {
  const agent = navigator.userAgent;

  if (/Windows/i.test(agent)) return "windows";
  if (/Mac OS X|Macintosh/i.test(agent)) return "macos";
  if (/Android/i.test(agent)) return "android";
  if (/iPhone|iPad|iPod/i.test(agent)) return "ios";
  if (/Linux|X11/i.test(agent)) return "linux";

  return "web";
};

// A browser cannot tell a laptop from a desktop, so it guesses the common case
// and leaves the owner to correct it - the device's type is editable.
const detectType = () => {
  const agent = navigator.userAgent;

  if (/iPad|Tablet/i.test(agent)) return "tablet";
  if (/Android|iPhone|Mobile/i.test(agent)) return "phone";

  return "laptop";
};

const suggestName = () => {
  const platform = {
    windows: "Windows PC",
    macos: "Mac",
    linux: "Linux PC",
    android: "Android browser",
    ios: "iOS browser",
    web: "This computer",
  }[detectPlatform()];

  return platform;
};

export const defaultDeviceName = suggestName;

export const registerThisBrowser = async (name) => {
  const data = await api.post("/devices", {
    name: name?.trim() || suggestName(),
    type: detectType(),
    platform: detectPlatform(),
    deviceIdentifier: getOrCreateIdentifier(),
  });

  write(TOKEN_KEY, data.deviceToken);
  write(ID_KEY, data.device.id);

  return data.device;
};

/* ------------------------------------------------------------- reporting -- */

// Device-token calls do not go through the shared api client: that one attaches
// the user's session and refreshes it on 401, neither of which applies here.
const deviceFetch = async (path, { method = "GET", body, token } = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      "x-device-token": token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.message || "Request failed");

    error.status = response.status;

    throw error;
  }

  return payload?.data ?? payload;
};

export const fetchDeviceSelf = (token) => deviceFetch("/devices/self", { token });

// Browser geolocation reports accuracy in metres and omits what it cannot
// determine, so the shape is closer to the API's than expo-location's - but
// null still has to become undefined or validation rejects the fix.
export const toFix = (position) => {
  const { coords, timestamp } = position;

  const optional = (value, min = 0) =>
    typeof value === "number" && Number.isFinite(value) && value >= min
      ? Number(value.toFixed(2))
      : undefined;

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: optional(coords.accuracy),
    altitude:
      typeof coords.altitude === "number" && Number.isFinite(coords.altitude)
        ? Number(coords.altitude.toFixed(2))
        : undefined,
    speed: optional(coords.speed),
    heading: optional(coords.heading),
    timestamp: new Date(timestamp).toISOString(),
  };
};

const readQueue = () => {
  try {
    const parsed = JSON.parse(read(QUEUE_KEY) || "[]");

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (items) => write(QUEUE_KEY, JSON.stringify(items));

export const queueSize = () => readQueue().length;

const enqueue = (fix) => {
  const queue = readQueue();

  queue.push(fix);

  const trimmed =
    queue.length > MAX_QUEUED ? queue.slice(queue.length - MAX_QUEUED) : queue;

  writeQueue(trimmed);

  return trimmed.length;
};

// Same contract as the phone's queue: oldest first, so the server replays
// geofence transitions in the order they actually happened.
export const flushQueue = async (token, deviceId) => {
  const queue = readQueue();

  if (!queue.length) {
    return { flushed: 0 };
  }

  const ordered = [...queue].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  try {
    const result = await deviceFetch(`/devices/${deviceId}/locations/batch`, {
      method: "POST",
      token,
      body: { locations: ordered },
    });

    writeQueue([]);

    return { flushed: result.accepted ?? ordered.length };
  } catch (error) {
    // A 4xx will never be accepted, so holding it would block every newer fix.
    if (error.status >= 400 && error.status < 500) {
      writeQueue([]);
    }

    return { flushed: 0 };
  }
};

export const reportFix = async (token, deviceId, position) => {
  const fix = toFix(position);

  try {
    await deviceFetch(`/devices/${deviceId}/locations`, {
      method: "POST",
      token,
      body: fix,
    });

    const { flushed } = await flushQueue(token, deviceId);

    return { status: "sent", fix, flushed };
  } catch (error) {
    // The server already has this exact instant - harmless.
    if (error.status === 409) {
      return { status: "duplicate", fix };
    }

    // The owner switched tracking off. The server decides that, not us.
    if (error.status === 403) {
      return { status: "forbidden", fix, message: error.message };
    }

    if (error.status === 401) {
      return { status: "unauthorized", fix, message: error.message };
    }

    // Offline or server trouble: hold it rather than lose it.
    const queued = enqueue(fix);

    return { status: "queued", fix, queued, message: error.message };
  }
};

export const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser cannot report a location"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 10000,
    });
  });
