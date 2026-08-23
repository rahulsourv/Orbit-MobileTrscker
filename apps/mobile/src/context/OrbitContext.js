import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import * as Device from "expo-device";

import * as api from "../lib/api";
import * as storage from "../lib/storage";
import { flushQueue, queueSize } from "../lib/queue";
import * as tracker from "../tracking/tracker";

const OrbitContext = createContext(null);

export const useOrbit = () => {
  const context = useContext(OrbitContext);

  if (!context) {
    throw new Error("useOrbit must be used inside <OrbitProvider>");
  }

  return context;
};

// Maps what the OS tells us about itself onto the API's enums, so the device
// shows up on the dashboard as a phone or tablet rather than "other".
const detectPlatform = () => {
  const os = (Device.osName || "").toLowerCase();

  if (os.includes("android")) return "android";
  if (os.includes("ios") || os.includes("ipados")) return "ios";
  if (os.includes("windows")) return "windows";
  if (os.includes("mac")) return "macos";
  if (os.includes("linux")) return "linux";

  return "other";
};

const detectType = () => {
  switch (Device.deviceType) {
    case Device.DeviceType.PHONE:
      return "phone";
    case Device.DeviceType.TABLET:
      return "tablet";
    case Device.DeviceType.DESKTOP:
      return "desktop";
    case Device.DeviceType.TV:
      return "other";
    default:
      return "phone";
  }
};

export const OrbitProvider = ({ children }) => {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [device, setDevice] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [permissions, setPermissions] = useState({
    foreground: false,
    background: false,
    servicesEnabled: true,
  });
  const [queued, setQueued] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [lastFix, setLastFix] = useState(null);
  const [apiUrl, setApiUrlState] = useState(api.defaultApiUrl);
  const [reportInterval, setReportIntervalState] = useState(
    storage.DEFAULT_REPORT_INTERVAL
  );
  const [banner, setBanner] = useState(null);
  // "background" | "foreground" | null - what the runtime actually supports.
  const [trackingMode, setTrackingMode] = useState(null);

  const appState = useRef(AppState.currentState);

  const refreshLocalState = useCallback(async () => {
    const [running, permissionState, size, sync, interval] = await Promise.all([
      tracker.isTracking(),
      tracker.getPermissionState(),
      queueSize(),
      storage.getLastSync(),
      storage.getReportInterval(),
    ]);

    setReportIntervalState(interval);

    setTracking(running);
    setTrackingMode(running ? (tracker.isForegroundOnly() ? "foreground" : "background") : null);
    setPermissions(permissionState);
    setQueued(size);
    setLastSync(sync);
  }, []);

  /**
   * Cold start.
   *
   * The device token is what matters most: with it, this phone can keep
   * reporting even if the user session has long expired. So it is read first,
   * and a failed session restore is not treated as a reason to stop tracking.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const url = await api.loadApiUrl();

      if (!cancelled) {
        setApiUrlState(url);
      }

      const [deviceToken, deviceId, deviceName, storedUser] = await Promise.all([
        storage.getDeviceToken(),
        storage.getDeviceId(),
        storage.getDeviceName(),
        storage.getUser(),
      ]);

      if (!cancelled && storedUser) {
        setUser(storedUser);
      }

      if (!cancelled && deviceToken && deviceId) {
        setDevice({ id: deviceId, name: deviceName, trackingEnabled: true });

        // The owner may have switched tracking off, renamed the device or
        // deleted it while this app was closed. The server is the authority.
        try {
          const self = await api.fetchDeviceSelf(deviceToken);

          if (!cancelled) {
            setDevice({
              id: self.device.id,
              name: self.device.name,
              type: self.device.type,
              trackingEnabled: self.device.trackingEnabled,
            });

            await storage.setDeviceName(self.device.name);

            if (!self.device.trackingEnabled) {
              await tracker.stopTracking();
              setBanner({
                tone: "warning",
                message: "Tracking is switched off for this device in your account.",
              });
            }
          }
        } catch (error) {
          // 401 means the token was rotated or the device deleted from the
          // dashboard. Anything else is probably just no signal, and must not
          // be allowed to unlink a perfectly good device.
          if (error.status === 401 && !cancelled) {
            await tracker.teardown();
            await storage.setDeviceToken(null);
            await storage.setDeviceId(null);
            setDevice(null);
            setBanner({
              tone: "danger",
              message:
                "This device was unlinked from your Orbit account. Register it again to resume.",
            });
          }
        }
      }

      try {
        const restored = await api.restoreSession();

        if (!cancelled && restored) {
          setUser(restored);
        }
      } catch {
        // Signed out, or offline. Tracking does not depend on this.
      }

      if (!cancelled) {
        await refreshLocalState();
        setBooting(false);
      }

      /**
       * Resume what the owner already switched on.
       *
       * Starting every launch in the "off" state meant a device silently
       * stopped reporting after any restart - precisely when you would most
       * want it reporting. This only honours a choice already made: it never
       * turns tracking on by itself, and the server still has the final say.
       */
      if (!cancelled && deviceToken && deviceId) {
        try {
          const wanted = await storage.getTrackingWanted();

          if (wanted && !(await tracker.isTracking())) {
            const permissions = await tracker.getPermissionState();

            // Never prompt on launch. If the grant was withdrawn, the owner
            // reinstates it deliberately from the tracking screen.
            if (permissions.foreground) {
              await tracker.startTracking();

              if (!cancelled) {
                await refreshLocalState();
              }
            }
          }
        } catch {
          // Tracking disabled server-side, or no permission. The screen
          // reflects reality either way.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshLocalState]);

  /**
   * Live updates from the tracker itself.
   *
   * This is what removes the need to pull-to-refresh: as soon as a position is
   * reported the screen moves, rather than waiting for the next poll.
   */
  useEffect(() => {
    const unsubscribe = tracker.onFixReported((result) => {
      if (result.fix) {
        setLastFix({ ...result.fix, status: result.status });
      }

      if (result.status === "sent") {
        setLastSync(new Date().toISOString());
        setQueued((current) => Math.max(0, current - (result.flushed || 0)));
      }

      if (result.status === "queued" && typeof result.queued === "number") {
        setQueued(result.queued);
      }

      // The server refused: the owner turned tracking off, or the token died.
      if (result.status === "forbidden" || result.status === "unauthorized") {
        setTracking(false);
        setTrackingMode(null);
        setBanner({ tone: "warning", message: result.message });
      }
    });

    return unsubscribe;
  }, []);

  // A slow backstop. The background task reports from a JS context this one
  // cannot hear, so its writes are only visible by re-reading storage.
  useEffect(() => {
    if (!tracking) {
      return undefined;
    }

    const timer = setInterval(refreshLocalState, 15000);

    return () => clearInterval(timer);
  }, [tracking, refreshLocalState]);

  const signIn = useCallback(async (email, password) => {
    const signedIn = await api.login(email, password);

    setUser(signedIn);

    return signedIn;
  }, []);

  const signOut = useCallback(async () => {
    // Signing out stops the tracker but deliberately leaves the device
    // registered: unlinking is a separate, explicit choice.
    await tracker.stopTracking();
    await api.logout();
    await storage.setRefreshToken(null);
    await storage.setUser(null);

    setUser(null);
    await refreshLocalState();
  }, [refreshLocalState]);

  const registerThisDevice = useCallback(
    async (name) => {
      const deviceIdentifier = await storage.getOrCreateDeviceIdentifier();

      const data = await api.registerDevice({
        name: name.trim(),
        type: detectType(),
        platform: detectPlatform(),
        model: Device.modelName || undefined,
        deviceIdentifier,
      });

      // The raw token exists only in this response.
      await storage.setDeviceToken(data.deviceToken);
      await storage.setDeviceId(data.device.id);
      await storage.setDeviceName(data.device.name);

      setDevice({
        id: data.device.id,
        name: data.device.name,
        type: data.device.type,
        trackingEnabled: data.device.trackingEnabled,
      });

      return data.device;
    },
    []
  );

  const unlinkDevice = useCallback(async () => {
    const deviceId = await storage.getDeviceId();

    await tracker.teardown();

    if (deviceId) {
      try {
        await api.deleteDevice(deviceId);
      } catch {
        // Already gone from the dashboard, or offline. Either way this phone
        // is done with it.
      }
    }

    await storage.setDeviceToken(null);
    await storage.setDeviceId(null);
    await storage.setDeviceName(null);
    await storage.writeQueue([]);

    setDevice(null);
    await refreshLocalState();
  }, [refreshLocalState]);

  const start = useCallback(async () => {
    setBanner(null);

    const permission = await tracker.requestPermissions({ background: true });

    if (!permission.granted) {
      setBanner({ tone: "danger", message: permission.message });
      await refreshLocalState();

      return false;
    }

    if (permission.message) {
      setBanner({ tone: "warning", message: permission.message });
    }

    try {
      const started = await tracker.startTracking();

      // Recorded before the first report, so a crash mid-start still leaves the
      // owner's choice on disk to be resumed.
      await storage.setTrackingWanted(true);

      if (started.mode === "foreground") {
        setBanner({
          tone: "warning",
          message:
            "This build can only report while Orbit is open — Expo Go cannot run background location. Build with expo run:android for background tracking.",
        });
      }

      // Report once immediately so the dashboard reacts now rather than at the
      // next interval.
      const position = await tracker.getCurrentPosition();
      const result = await tracker.reportFix(position);

      setLastFix({ ...tracker.toFix(position, null), status: result.status });
      await refreshLocalState();
      setTracking(true);

      return true;
    } catch (error) {
      setBanner({ tone: "danger", message: error.message });
      await refreshLocalState();

      return false;
    }
  }, [refreshLocalState]);

  const stop = useCallback(async () => {
    // Turning it off is equally durable: it must not creep back on at the next
    // launch just because it was on before.
    await storage.setTrackingWanted(false);
    await tracker.stopTracking();
    setTracking(false);
    await refreshLocalState();
  }, [refreshLocalState]);

  const syncNow = useCallback(async () => {
    const [deviceToken, deviceId] = await Promise.all([
      storage.getDeviceToken(),
      storage.getDeviceId(),
    ]);

    if (!deviceToken || !deviceId) {
      return { flushed: 0, remaining: 0 };
    }

    const result = await flushQueue(deviceToken, deviceId);

    await refreshLocalState();

    return result;
  }, [refreshLocalState]);

  const reportOnce = useCallback(async () => {
    const position = await tracker.getCurrentPosition();
    const result = await tracker.reportFix(position);
    const battery = await tracker.readBatteryLevel();

    setLastFix({ ...tracker.toFix(position, battery), status: result.status });
    await refreshLocalState();

    return result;
  }, [refreshLocalState]);

  // Coming back to the foreground is the cheapest reliable moment to drain the
  // queue and re-read state the OS may have changed behind our back. Declared
  // after syncNow so the dependency is a real binding rather than a hoisting
  // accident.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      const returning =
        appState.current.match(/inactive|background/) && next === "active";

      appState.current = next;

      if (returning) {
        refreshLocalState();
        syncNow().catch(() => {});
      }
    });

    return () => subscription.remove();
  }, [refreshLocalState, syncNow]);

  // Changing the cadence restarts whichever mechanism is running, so it takes
  // effect now rather than at the next start.
  const changeReportInterval = useCallback(
    async (seconds) => {
      await storage.setReportInterval(seconds);
      setReportIntervalState(seconds);

      await tracker.restartTracking();
      await refreshLocalState();
    },
    [refreshLocalState]
  );

  const changeApiUrl = useCallback(async (value) => {
    const next = await api.changeApiUrl(value);

    setApiUrlState(next);

    return next;
  }, []);

  const value = useMemo(
    () => ({
      booting,
      user,
      device,
      tracking,
      trackingMode,
      permissions,
      queued,
      lastSync,
      lastFix,
      apiUrl,
      reportInterval,
      changeReportInterval,
      banner,
      setBanner,
      signIn,
      signOut,
      registerThisDevice,
      unlinkDevice,
      start,
      stop,
      syncNow,
      reportOnce,
      changeApiUrl,
      refreshLocalState,
    }),
    [
      booting,
      user,
      device,
      tracking,
      trackingMode,
      permissions,
      queued,
      lastSync,
      lastFix,
      apiUrl,
      reportInterval,
      changeReportInterval,
      banner,
      signIn,
      signOut,
      registerThisDevice,
      unlinkDevice,
      start,
      stop,
      syncNow,
      reportOnce,
      changeApiUrl,
      refreshLocalState,
    ]
  );

  return <OrbitContext.Provider value={value}>{children}</OrbitContext.Provider>;
};
