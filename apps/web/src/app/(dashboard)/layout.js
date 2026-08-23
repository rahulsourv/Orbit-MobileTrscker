"use client";

import { useEffect, useState } from "react";

import { AuthGate } from "@/components/layout/AuthGate";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useSocket } from "@/hooks/useSocket";
import { useAuthStore } from "@/store/auth.store";
import { useDeviceStore } from "@/store/device.store";
import { useNotificationStore } from "@/store/notification.store";
import { useConnectionStore } from "@/store/connection.store";

/**
 * The signed-in shell.
 *
 * The socket and the first data load live here rather than on each page, so
 * moving between pages never drops the live connection or refetches what is
 * already in the stores.
 */
const DashboardShell = ({ children }) => {
  const [navOpen, setNavOpen] = useState(false);
  const { connected } = useSocket();

  const fetchDevices = useDeviceStore((state) => state.fetchDevices);
  const fetchNotifications = useNotificationStore(
    (state) => state.fetchNotifications
  );

  const fetchConnections = useConnectionStore((state) => state.fetchAll);

  useEffect(() => {
    fetchDevices();
    fetchNotifications();
    fetchConnections();
  }, [fetchDevices, fetchNotifications, fetchConnections]);

  return (
    <div className="min-h-dvh">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="lg:pl-64">
        <Topbar onOpenNav={() => setNavOpen(true)} connected={connected} />
        <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
};

export default function DashboardLayout({ children }) {
  const status = useAuthStore((state) => state.status);

  // Stores hold the previous account's data until the shell remounts, so the
  // shell is keyed by session state to guarantee a clean slate after a switch.
  return (
    <AuthGate>
      <DashboardShell key={status}>{children}</DashboardShell>
    </AuthGate>
  );
}
