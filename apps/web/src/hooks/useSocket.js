"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";

import { API_URL, getAccessToken } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { useDeviceStore } from "@/store/device.store";
import { useNotificationStore } from "@/store/notification.store";
import { useConnectionStore } from "@/store/connection.store";
import { notificationMeta } from "@/lib/constants";

// The socket server sits at the API origin, not under /api.
const SOCKET_URL = API_URL.replace(/\/api\/?$/, "");

/**
 * One socket for the whole signed-in app, mounted by the dashboard layout.
 *
 * Events land in the stores rather than in component state, so any page reading
 * a store gets live updates without subscribing to anything itself.
 */
export const useSocket = () => {
  const status = useAuthStore((state) => state.status);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (status !== "authenticated") {
      return undefined;
    }

    const socket = io(SOCKET_URL, {
      // A function, not a value: on reconnect the token is read again, so a
      // socket that drops after the access token rotated still comes back.
      auth: (callback) => callback({ token: getAccessToken() }),
      // Transports are deliberately left at the default (polling, then an
      // upgrade to websocket). Pinning this to websocket-only fails most of the
      // time behind Render's proxy, and socket.io only attempts the first
      // transport in an explicit list, so naming both is not a fallback.
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("connect_error", () => {
      setConnected(false);
    });

    // The server marks events for somebody else's device with shared:true, so
    // they land in the connection store rather than the user's own devices.
    socket.on("device:locationUpdated", (fix) => {
      if (fix.shared) {
        useConnectionStore.getState().applySharedLocation(fix);
        return;
      }

      useDeviceStore.getState().applyLocation(fix);
    });

    socket.on("device:statusChanged", (payload) => {
      const patch = {
        isOnline: payload.isOnline,
        lastSeen: payload.lastSeen,
        batteryLevel: payload.batteryLevel,
      };

      if (payload.shared) {
        useConnectionStore.getState().patchSharedDevice(payload.id, patch);
        return;
      }

      useDeviceStore.getState().patchDevice(payload.id, patch);
    });

    socket.on("device:batteryUpdated", (payload) => {
      const patch = { batteryLevel: payload.batteryLevel };

      if (payload.shared) {
        useConnectionStore.getState().patchSharedDevice(payload.id, patch);
        return;
      }

      useDeviceStore.getState().patchDevice(payload.id, patch);
    });

    socket.on("device:added", (device) => {
      useDeviceStore.getState().upsertDevice(device);
    });

    socket.on("device:updated", (device) => {
      useDeviceStore.getState().upsertDevice(device);
    });

    socket.on("device:removed", ({ id }) => {
      useDeviceStore.getState().removeDevice(id);
    });

    socket.on("notification:new", (notification) => {
      useNotificationStore.getState().push(notification);

      // Alerts are the one thing worth interrupting for, so they surface as a
      // toast as well as landing in the tray.
      const { icon: Icon } = notificationMeta(notification.type);

      toast(notification.title, {
        description: notification.message,
        icon: Icon ? <Icon className="size-4" /> : undefined,
      });
    });

    // Geofence crossings already arrive as notifications; this event exists so
    // the map can react to the boundary itself.
    socket.on("geofence:triggered", () => {});

    /* --------------------------------------------------------- sharing -- */

    socket.on("connection:request", (connection) => {
      useConnectionStore.getState().pushIncoming(connection);
    });

    socket.on("connection:accepted", (connection) => {
      useConnectionStore.getState().patchOutgoing(connection);
      // Their devices only exist for us now, so the list has to be re-read.
      useConnectionStore.getState().fetchAll();
    });

    socket.on("connection:denied", (connection) => {
      useConnectionStore.getState().patchOutgoing(connection);
    });

    socket.on("connection:revoked", ({ id }) => {
      useConnectionStore.getState().markRevoked(id);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [status]);

  // Only the connection flag is returned. Handing the socket itself back would
  // mean reading a ref during render, and nothing needs it: every event is
  // already funnelled into the stores above.
  return { connected };
};
