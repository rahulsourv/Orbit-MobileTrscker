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
import { io } from "socket.io-client";

import * as api from "../lib/api";
import { useOrbit } from "./OrbitContext";

const DashboardContext = createContext(null);

export const useDashboard = () => {
  const context = useContext(DashboardContext);

  if (!context) {
    throw new Error("useDashboard must be used inside <DashboardProvider>");
  }

  return context;
};

// Online first, then most recently seen — so the list does not reshuffle under
// a thumb every time a position arrives.
const sortDevices = (devices) =>
  [...devices].sort((a, b) => {
    if (a.isOnline !== b.isOnline) {
      return a.isOnline ? -1 : 1;
    }

    return new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0);
  });

/**
 * Everything the phone needs to act as a dashboard rather than just a tracked
 * device: all of the user's devices, their geofences and their alerts, kept
 * live over the same Socket.IO stream the web app uses.
 */
export const DashboardProvider = ({ children }) => {
  const { user } = useOrbit();

  const [devices, setDevices] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [notifications, setNotifications] = useState([]);
  // Other people's devices stay in their own list: merging them into the
  // user's would invite a UI offering controls the API always refuses.
  const [sharedDevices, setSharedDevices] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const [deviceData, geofenceData, notificationData, connectionData, sharedData] =
        await Promise.all([
          api.listDevices(),
          api.listGeofences(),
          api.listNotifications({ limit: 50 }),
          api.listConnections(),
          api.listSharedDevices(),
        ]);

      setDevices(sortDevices(deviceData.devices));
      setGeofences(geofenceData.geofences);
      setNotifications(notificationData.notifications);
      setUnreadCount(notificationData.unreadCount);
      setIncoming(connectionData.incoming);
      setOutgoing(connectionData.outgoing);
      setSharedDevices(sharedData.devices);
      setError(null);
    } catch (refreshError) {
      setError(refreshError.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setDevices([]);
      setGeofences([]);
      setNotifications([]);
      setSharedDevices([]);
      setIncoming([]);
      setOutgoing([]);
      setUnreadCount(0);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        const [
          deviceData,
          geofenceData,
          notificationData,
          connectionData,
          sharedData,
        ] = await Promise.all([
          api.listDevices(),
          api.listGeofences(),
          api.listNotifications({ limit: 50 }),
          api.listConnections(),
          api.listSharedDevices(),
        ]);

        if (cancelled) {
          return;
        }

        setDevices(sortDevices(deviceData.devices));
        setGeofences(geofenceData.geofences);
        setNotifications(notificationData.notifications);
        setUnreadCount(notificationData.unreadCount);
        setIncoming(connectionData.incoming);
        setOutgoing(connectionData.outgoing);
        setSharedDevices(sharedData.devices);
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  /**
   * The same event stream the web dashboard listens to.
   *
   * The socket server lives at the API origin rather than under /api, and it
   * authenticates in the handshake with the user's access token — the device
   * token would only subscribe this phone to itself.
   */
  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const socketUrl = api.getApiUrl().replace(/\/api\/?$/, "");

    const socket = io(socketUrl, {
      // A function, so a reconnect after the access token rotated picks up the
      // current one instead of replaying a stale token.
      auth: (callback) => callback({ token: api.getAccessToken() }),
      // Transports are deliberately left at the default (polling, then an
      // upgrade to websocket). Pinning this to websocket-only fails most of the
      // time behind Render's proxy, and socket.io only attempts the first
      // transport in an explicit list, so naming both is not a fallback.
    });

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    // The server marks events for somebody else's device with shared:true.
    socket.on("device:locationUpdated", (fix) => {
      if (fix.shared) {
        setSharedDevices((current) =>
          current.map((device) =>
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
        );

        return;
      }

      setDevices((current) =>
        sortDevices(
          current.map((device) =>
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
        )
      );
    });

    socket.on("device:statusChanged", (payload) => {
      if (payload.shared) {
        setSharedDevices((current) =>
          current.map((device) =>
            device.id === payload.id
              ? {
                  ...device,
                  isOnline: payload.isOnline,
                  lastSeen: payload.lastSeen,
                  batteryLevel: payload.batteryLevel ?? device.batteryLevel,
                }
              : device
          )
        );

        return;
      }

      setDevices((current) =>
        sortDevices(
          current.map((device) =>
            device.id === payload.id
              ? {
                  ...device,
                  isOnline: payload.isOnline,
                  lastSeen: payload.lastSeen,
                  batteryLevel: payload.batteryLevel ?? device.batteryLevel,
                }
              : device
          )
        )
      );
    });

    socket.on("device:batteryUpdated", (payload) => {
      setDevices((current) =>
        current.map((device) =>
          device.id === payload.id
            ? { ...device, batteryLevel: payload.batteryLevel }
            : device
        )
      );
    });

    socket.on("device:added", (device) =>
      setDevices((current) =>
        sortDevices(
          current.some((entry) => entry.id === device.id)
            ? current.map((entry) => (entry.id === device.id ? device : entry))
            : [...current, device]
        )
      )
    );

    socket.on("device:updated", (device) =>
      setDevices((current) =>
        sortDevices(
          current.map((entry) =>
            entry.id === device.id ? { ...entry, ...device } : entry
          )
        )
      )
    );

    socket.on("device:removed", ({ id }) =>
      setDevices((current) => current.filter((device) => device.id !== id))
    );

    /* ----------------------------------------------------------- sharing -- */

    socket.on("connection:request", (connection) => {
      setIncoming((current) =>
        current.some((entry) => entry.id === connection.id)
          ? current.map((entry) => (entry.id === connection.id ? connection : entry))
          : [connection, ...current]
      );
    });

    socket.on("connection:accepted", (connection) => {
      setOutgoing((current) =>
        current.map((entry) =>
          entry.id === connection.id ? { ...entry, ...connection } : entry
        )
      );
      // Their devices only exist for us now, so the list has to be re-read.
      api
        .listSharedDevices()
        .then((data) => setSharedDevices(data.devices))
        .catch(() => {});
    });

    socket.on("connection:denied", (connection) => {
      setOutgoing((current) =>
        current.map((entry) =>
          entry.id === connection.id ? { ...entry, ...connection } : entry
        )
      );
    });

    socket.on("connection:revoked", ({ id }) => {
      setIncoming((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, status: "revoked" } : entry
        )
      );
      setOutgoing((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, status: "revoked" } : entry
        )
      );
      // Whatever they were sharing stops being visible immediately.
      setSharedDevices((current) =>
        current.filter((device) => device.connectionId !== id)
      );
    });

    socket.on("notification:new", (notification) => {
      setNotifications((current) =>
        current.some((entry) => entry.id === notification.id)
          ? current
          : [notification, ...current].slice(0, 100)
      );
      setUnreadCount((current) => current + 1);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user]);

  // A phone suspends its socket in the background, so returning to the app is
  // the moment to make sure nothing was missed while it was asleep.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        refresh();
      }
    });

    return () => subscription.remove();
  }, [refresh]);

  /* ------------------------------------------------------------- actions -- */

  const setDeviceTracking = useCallback(async (deviceId, trackingEnabled) => {
    // Optimistic: a kill switch should feel immediate.
    setDevices((current) =>
      current.map((device) =>
        device.id === deviceId ? { ...device, trackingEnabled } : device
      )
    );

    try {
      const data = await api.setDeviceTracking(deviceId, trackingEnabled);

      setDevices((current) =>
        current.map((device) =>
          device.id === deviceId ? { ...device, ...data.device } : device
        )
      );
    } catch (actionError) {
      setDevices((current) =>
        current.map((device) =>
          device.id === deviceId
            ? { ...device, trackingEnabled: !trackingEnabled }
            : device
        )
      );

      throw actionError;
    }
  }, []);

  const renameDevice = useCallback(async (deviceId, name) => {
    const data = await api.updateDevice(deviceId, { name });

    setDevices((current) =>
      current.map((device) =>
        device.id === deviceId ? { ...device, ...data.device } : device
      )
    );
  }, []);

  const removeDevice = useCallback(async (deviceId) => {
    await api.deleteDevice(deviceId);
    setDevices((current) => current.filter((device) => device.id !== deviceId));
  }, []);

  const addGeofence = useCallback(async (payload) => {
    const data = await api.createGeofence(payload);

    setGeofences((current) => [data.geofence, ...current]);

    return data.geofence;
  }, []);

  const toggleGeofence = useCallback(async (geofenceId, active) => {
    setGeofences((current) =>
      current.map((fence) =>
        fence.id === geofenceId ? { ...fence, active } : fence
      )
    );

    try {
      await api.updateGeofence(geofenceId, { active });
    } catch (actionError) {
      setGeofences((current) =>
        current.map((fence) =>
          fence.id === geofenceId ? { ...fence, active: !active } : fence
        )
      );

      throw actionError;
    }
  }, []);

  const removeGeofence = useCallback(async (geofenceId) => {
    await api.deleteGeofence(geofenceId);
    setGeofences((current) => current.filter((fence) => fence.id !== geofenceId));
  }, []);

  const sendConnectionRequest = useCallback(async (payload) => {
    const data = await api.sendConnectionRequest(payload);

    setOutgoing((current) => [data.connection, ...current]);

    return data;
  }, []);

  const acceptConnection = useCallback(async (connectionId, deviceIds) => {
    const data = await api.acceptConnection(connectionId, deviceIds);

    setIncoming((current) =>
      current.map((entry) =>
        entry.id === connectionId ? { ...entry, ...data.connection } : entry
      )
    );

    return data.connection;
  }, []);

  const denyConnection = useCallback(async (connectionId) => {
    const data = await api.denyConnection(connectionId);

    setIncoming((current) =>
      current.map((entry) =>
        entry.id === connectionId ? { ...entry, ...data.connection } : entry
      )
    );
  }, []);

  const revokeConnection = useCallback(async (connectionId) => {
    await api.revokeConnection(connectionId);

    setIncoming((current) =>
      current.map((entry) =>
        entry.id === connectionId ? { ...entry, status: "revoked" } : entry
      )
    );
    setOutgoing((current) =>
      current.map((entry) =>
        entry.id === connectionId ? { ...entry, status: "revoked" } : entry
      )
    );
    setSharedDevices((current) =>
      current.filter((device) => device.connectionId !== connectionId)
    );
  }, []);

  const markRead = useCallback(async (notificationId) => {
    setNotifications((current) =>
      current.map((entry) =>
        entry.id === notificationId ? { ...entry, read: true } : entry
      )
    );
    setUnreadCount((current) => Math.max(0, current - 1));

    try {
      await api.markNotificationRead(notificationId);
    } catch {
      refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setNotifications((current) => current.map((entry) => ({ ...entry, read: true })));
    setUnreadCount(0);

    try {
      await api.markAllNotificationsRead();
    } catch {
      refresh();
    }
  }, [refresh]);

  const clearAlerts = useCallback(async () => {
    setNotifications([]);
    setUnreadCount(0);

    try {
      await api.clearNotifications();
    } catch {
      refresh();
    }
  }, [refresh]);

  const value = useMemo(
    () => ({
      devices,
      sharedDevices,
      incoming,
      outgoing,
      geofences,
      notifications,
      unreadCount,
      loading,
      connected,
      error,
      refresh,
      sendConnectionRequest,
      acceptConnection,
      denyConnection,
      revokeConnection,
      setDeviceTracking,
      renameDevice,
      removeDevice,
      addGeofence,
      toggleGeofence,
      removeGeofence,
      markRead,
      markAllRead,
      clearAlerts,
    }),
    [
      devices,
      sharedDevices,
      incoming,
      outgoing,
      geofences,
      notifications,
      unreadCount,
      loading,
      connected,
      error,
      refresh,
      sendConnectionRequest,
      acceptConnection,
      denyConnection,
      revokeConnection,
      setDeviceTracking,
      renameDevice,
      removeDevice,
      addGeofence,
      toggleGeofence,
      removeGeofence,
      markRead,
      markAllRead,
      clearAlerts,
    ]
  );

  return (
    <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
  );
};
