"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Smartphone,
  Wifi,
  BatteryWarning,
  ArrowUpRight,
  Radar,
  RefreshCw,
} from "lucide-react";

import { Button, Card, CardHeader, EmptyState, Skeleton, Badge } from "@/components/ui";
import { DeviceCard } from "@/components/devices/DeviceCard";
import { AddDeviceModal } from "@/components/devices/AddDeviceModal";
import { OrbitMap } from "@/components/map/OrbitMap";
import { MapLegend } from "@/components/map/MapLegend";
import { useAuthStore } from "@/store/auth.store";
import { useDeviceStore } from "@/store/device.store";
import { useNotificationStore } from "@/store/notification.store";
import { useConnectionStore } from "@/store/connection.store";
import { useThisDeviceStore } from "@/store/thisDevice.store";
import { greeting, relativeTime } from "@/lib/format";
import { notificationMeta, TONE_CLASS } from "@/lib/constants";
import { cn } from "@/lib/cn";

const StatTile = ({ icon: Icon, label, value, tone = "accent", hint }) => (
  <Card className="p-4">
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "grid size-9 place-items-center rounded-xl ring-1 ring-inset",
          TONE_CLASS[tone]
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-ink-faint">{label}</p>
        <p className="text-lg font-semibold leading-tight text-ink">{value}</p>
      </div>
    </div>
    {hint && <p className="mt-3 text-[11px] text-ink-faint">{hint}</p>}
  </Card>
);

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const devices = useDeviceStore((state) => state.devices);
  const loading = useDeviceStore((state) => state.loading);
  const notifications = useNotificationStore((state) => state.notifications);
  const fetchDevices = useDeviceStore((state) => state.fetchDevices);
  const fetchConnections = useConnectionStore((state) => state.fetchAll);
  const thisComputerTracking = useThisDeviceStore((state) => state.tracking);
  const reportThisComputer = useThisDeviceStore((state) => state.reportOnce);

  const [addOpen, setAddOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(null);

  /**
   * Manual refresh.
   *
   * Pulls the newest positions the server holds, and - if this computer is
   * tracking - pushes its own position first, so "latest" includes the machine
   * doing the asking rather than everything except it.
   */
  const refreshNow = async () => {
    setRefreshing(true);

    try {
      if (thisComputerTracking) {
        await reportThisComputer().catch(() => {});
      }

      await Promise.all([fetchDevices(), fetchConnections()]);
      setRefreshedAt(new Date().toLocaleTimeString());
    } finally {
      setRefreshing(false);
    }
  };

  const stats = useMemo(() => {
    const online = devices.filter((device) => device.isOnline).length;
    const lowBattery = devices.filter(
      (device) => device.batteryLevel !== null && device.batteryLevel < 20
    ).length;

    return { total: devices.length, online, offline: devices.length - online, lowBattery };
  }, [devices]);

  const positioned = devices.filter((device) => device.lastLocation);
  const recent = notifications.slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}
            {user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {stats.total === 0
              ? "Register your first device to start seeing it here."
              : `${stats.online} of ${stats.total} device${stats.total === 1 ? "" : "s"} online right now.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={refreshNow}
            loading={refreshing}
            title={refreshedAt ? `Last refreshed ${refreshedAt}` : "Refresh now"}
          >
            {!refreshing && <RefreshCw className="size-4" />}
            Refresh
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> Add device
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Smartphone}
          label="Devices"
          value={loading ? "—" : stats.total}
          tone="accent"
        />
        <StatTile
          icon={Wifi}
          label="Online"
          value={loading ? "—" : stats.online}
          tone="positive"
        />
        <StatTile
          icon={Radar}
          label="Reporting location"
          value={loading ? "—" : positioned.length}
          tone="violet"
        />
        <StatTile
          icon={BatteryWarning}
          label="Low battery"
          value={loading ? "—" : stats.lowBattery}
          tone={stats.lowBattery > 0 ? "warning" : "muted"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* The map gets two thirds of the width and the tallest block on the
            page — it is the thing worth looking at. */}
        <Card className="relative overflow-hidden lg:col-span-2">
          <CardHeader
            title="Live map"
            subtitle={
              positioned.length
                ? `${positioned.length} device${positioned.length === 1 ? "" : "s"} on the map`
                : "No positions reported yet"
            }
            action={
              <Link href="/live">
                <Button variant="ghost" size="sm">
                  Expand <ArrowUpRight className="size-3.5" />
                </Button>
              </Link>
            }
          />
          <div className="relative h-[22rem] border-t border-line">
            {positioned.length ? (
              <>
                <OrbitMap
                  devices={devices}
                  className="size-full"
                  onSelectDevice={(id) => router.push(`/devices/${id}`)}
                />
                <MapLegend online={stats.online} offline={stats.offline} />
              </>
            ) : (
              <EmptyState
                icon={Radar}
                title="Nothing to plot yet"
                description="Once a registered device reports its position, it appears here and moves in real time."
              />
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Recent activity"
            subtitle="Alerts as they happen"
            action={
              <Link href="/alerts">
                <Button variant="ghost" size="sm">
                  All
                </Button>
              </Link>
            }
          />
          <div className="max-h-[22rem] overflow-y-auto border-t border-line">
            {recent.length === 0 ? (
              <EmptyState
                title="No activity yet"
                description="Battery warnings, geofence crossings and sign-ins will show up here."
                className="py-12"
              />
            ) : (
              recent.map((notification) => {
                const meta = notificationMeta(notification.type);
                const Icon = meta.icon;

                return (
                  <div
                    key={notification.id}
                    className="flex gap-3 border-b border-line/60 px-4 py-3 last:border-0"
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ring-1 ring-inset",
                        TONE_CLASS[meta.tone]
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-ink">
                        {notification.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-ink-faint">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-[10px] text-ink-faint">
                        {relativeTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">
            Connected devices
          </h2>
          {devices.length > 0 && (
            <Link
              href="/devices"
              className="focus-ring rounded text-xs text-ink-muted hover:text-accent"
            >
              Manage
            </Link>
          )}
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-[7.5rem]" />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <Card>
            <EmptyState
              icon={Smartphone}
              title="No devices yet"
              description="Register a phone or laptop and Orbit will issue it a token. Only a device holding that token can report a position."
              action={
                <Button onClick={() => setAddOpen(true)}>
                  <Plus className="size-4" /> Add your first device
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {devices.map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </div>
        )}
      </div>

      <AddDeviceModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
