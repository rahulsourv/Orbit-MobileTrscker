"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Radar, Crosshair, Layers, ChevronRight, Navigation, Users } from "lucide-react";

import { Button, Card, EmptyState, StatusDot, Badge } from "@/components/ui";
import { OrbitMap } from "@/components/map/OrbitMap";
import { MapLegend } from "@/components/map/MapLegend";
import {
  LayerSwitcher,
  RefreshControl,
  DirectionsPanel,
} from "@/components/map/MapControls";
import { BatteryPill } from "@/components/devices/DeviceCard";
import { DeviceGlyph } from "@/components/devices/DeviceGlyph";
import { useDeviceStore } from "@/store/device.store";
import { useConnectionStore } from "@/store/connection.store";
import * as geofenceService from "@/services/geofence.service";
import * as routeService from "@/services/route.service";
import { DEFAULT_LAYER } from "@/lib/mapLayers";
import { deviceTypeLabel } from "@/lib/constants";
import { relativeTime, formatAccuracy, formatCoordinatePair } from "@/lib/format";
import { cn } from "@/lib/cn";

const AUTO_REFRESH_MS = 20000;

export default function LivePage() {
  const devices = useDeviceStore((state) => state.devices);
  const loading = useDeviceStore((state) => state.loading);
  const fetchDevices = useDeviceStore((state) => state.fetchDevices);

  const sharedDevices = useConnectionStore((state) => state.sharedDevices);
  const fetchConnections = useConnectionStore((state) => state.fetchAll);

  const [geofences, setGeofences] = useState([]);
  const [showGeofences, setShowGeofences] = useState(true);
  const [focused, setFocused] = useState(null);
  const [layer, setLayer] = useState(DEFAULT_LAYER);

  const [auto, setAuto] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Directions state.
  const [destination, setDestination] = useState(null);
  const [mode, setMode] = useState("driving");
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [origin, setOrigin] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await geofenceService.listGeofences();

        if (!cancelled) {
          setGeofences(data.geofences);
        }
      } catch {
        if (!cancelled) {
          setGeofences([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Everything on the map: your own devices, plus whatever other people have
  // agreed to share. Kept in one array only at render time.
  const allDevices = useMemo(
    () => [...devices, ...sharedDevices],
    [devices, sharedDevices]
  );

  const positioned = useMemo(
    () => allDevices.filter((device) => device.lastLocation),
    [allDevices]
  );

  const online = positioned.filter((device) => device.isOnline).length;

  const refresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await Promise.all([fetchDevices(), fetchConnections()]);
      setLastRefreshed(new Date().toLocaleTimeString());
    } finally {
      setRefreshing(false);
    }
  }, [fetchDevices, fetchConnections]);

  // The socket already pushes every position, so this is a safety net for a
  // connection that dropped without saying so - not the primary path.
  useEffect(() => {
    if (!auto) {
      return undefined;
    }

    const timer = setInterval(() => {
      refresh();
    }, AUTO_REFRESH_MS);

    return () => clearInterval(timer);
  }, [auto, refresh]);

  const selected = allDevices.find((device) => device.id === focused);

  /**
   * "Go to location" — routes from your browser's position to the device.
   *
   * The origin is asked for at the moment it is needed rather than on page
   * load: a map that demands your location before it will show anything is
   * exactly the pattern Orbit is trying not to be.
   */
  const startDirections = useCallback(
    async (device) => {
      if (!device?.lastLocation) {
        return;
      }

      setDestination({
        latitude: device.lastLocation.latitude,
        longitude: device.lastLocation.longitude,
        label: device.name,
      });
      setRoute(null);
      setRouteError(null);
      setRouteLoading(true);

      const from = await new Promise((resolve) => {
        if (origin) {
          resolve(origin);
          return;
        }

        if (!navigator.geolocation) {
          resolve(null);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) =>
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 10000 }
        );
      });

      if (!from) {
        setRouteError(
          "Orbit needs your location to route from here. Allow it in your browser and try again."
        );
        setRouteLoading(false);

        return;
      }

      setOrigin(from);

      try {
        const data = await routeService.getDirections({
          from,
          to: {
            latitude: device.lastLocation.latitude,
            longitude: device.lastLocation.longitude,
          },
          mode,
        });

        setRoute(data.route);
      } catch (error) {
        setRouteError(error.message);
      } finally {
        setRouteLoading(false);
      }
    },
    [mode, origin]
  );

  // Changing travel mode re-routes rather than clearing what is on screen.
  useEffect(() => {
    if (!destination || !origin) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      setRouteLoading(true);

      try {
        const data = await routeService.getDirections({
          from: origin,
          to: destination,
          mode,
        });

        if (!cancelled) {
          setRoute(data.route);
          setRouteError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setRouteError(error.message);
        }
      } finally {
        if (!cancelled) {
          setRouteLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, destination, origin]);

  const clearDirections = () => {
    setDestination(null);
    setRoute(null);
    setRouteError(null);
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live map</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Markers move as new positions arrive.
            {sharedDevices.length > 0 &&
              ` Includes ${sharedDevices.length} device${sharedDevices.length === 1 ? "" : "s"} shared with you.`}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={showGeofences ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowGeofences((value) => !value)}
          >
            <Layers className="size-3.5" />
            Geofences
            {geofences.length > 0 && (
              <span className="text-ink-faint">{geofences.length}</span>
            )}
          </Button>
          {focused && (
            <Button variant="ghost" size="sm" onClick={() => setFocused(null)}>
              <Crosshair className="size-3.5" /> Fit all
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        {/* Device rail: doubles as a legend and as the map's focus control. */}
        <Card className="order-2 overflow-hidden lg:order-1">
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Devices</p>
            <p className="mt-0.5 text-[11px] text-ink-faint">
              {positioned.length} reporting a position
            </p>
          </div>

          <div className="max-h-[32rem] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-8 text-center text-xs text-ink-faint">
                Loading devices
              </p>
            ) : positioned.length === 0 ? (
              <EmptyState
                title="Nothing to show"
                description="Devices appear here once they report a position."
                className="py-10"
              />
            ) : (
              positioned.map((device) => {
                const isFocused = focused === device.id;

                return (
                  <div
                    key={device.id}
                    className={cn(
                      "border-b border-line/60 last:border-0",
                      isFocused && "bg-accent/[0.07]"
                    )}
                  >
                    <button
                      onClick={() => setFocused(isFocused ? null : device.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset",
                          device.shared
                            ? "bg-violet/10 text-violet ring-violet/20"
                            : device.isOnline
                              ? "bg-positive/10 text-positive ring-positive/20"
                              : "bg-white/5 text-ink-faint ring-white/10"
                        )}
                      >
                        <DeviceGlyph type={device.type} className="size-4" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-xs font-medium text-ink">
                            {device.name}
                          </span>
                          <StatusDot online={device.isOnline} />
                        </span>
                        {device.shared && (
                          <span className="mt-0.5 block truncate text-[10px] text-violet">
                            Shared by {device.sharedBy}
                          </span>
                        )}
                        <span className="mt-0.5 block truncate font-mono text-[10px] text-ink-faint">
                          {formatCoordinatePair(
                            device.lastLocation.latitude,
                            device.lastLocation.longitude
                          )}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-ink-faint">
                          {relativeTime(device.lastLocation.timestamp)} ·{" "}
                          {formatAccuracy(device.lastLocation.accuracy)}
                        </span>
                      </span>

                      <ChevronRight
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          isFocused ? "text-accent" : "text-ink-faint"
                        )}
                      />
                    </button>

                    {isFocused && (
                      <div className="flex gap-2 px-4 pb-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => startDirections(device)}
                          className="flex-1"
                        >
                          <Navigation className="size-3.5" /> Go here
                        </Button>
                        {!device.shared && (
                          <Link href={`/devices/${device.id}`} className="flex-1">
                            <Button size="sm" variant="ghost" className="w-full">
                              Details
                            </Button>
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="relative order-1 overflow-hidden lg:order-2">
          <div className="relative h-[32rem] lg:h-[38rem]">
            {positioned.length ? (
              <>
                <OrbitMap
                  devices={allDevices}
                  geofences={showGeofences ? geofences : []}
                  route={route}
                  destination={destination}
                  focusedDeviceId={focused}
                  layer={layer}
                  onSelectDevice={setFocused}
                  className="size-full"
                />

                <RefreshControl
                  connected={!refreshing}
                  auto={auto}
                  onToggleAuto={setAuto}
                  onRefresh={refresh}
                  refreshing={refreshing}
                  lastRefreshed={lastRefreshed}
                />

                <LayerSwitcher layer={layer} onChange={setLayer} />

                {destination ? (
                  <DirectionsPanel
                    route={route}
                    destinationLabel={destination.label}
                    mode={mode}
                    onModeChange={setMode}
                    onClose={clearDirections}
                    loading={routeLoading}
                    error={routeError}
                  />
                ) : (
                  <MapLegend online={online} offline={positioned.length - online} />
                )}
              </>
            ) : (
              <EmptyState
                icon={Radar}
                title="No devices on the map"
                description="Register a device and let it report once — it will appear here and move in real time."
                action={
                  <Link href="/devices">
                    <Button size="sm">Go to devices</Button>
                  </Link>
                }
              />
            )}
          </div>
        </Card>
      </div>

      {selected && (
        <Card className="mt-4 flex flex-wrap items-center gap-4 p-4">
          <div className="flex items-center gap-2">
            <StatusDot online={selected.isOnline} />
            <span className="text-sm font-medium">{selected.name}</span>
            <Badge tone="muted">{deviceTypeLabel(selected.type)}</Badge>
            {selected.shared && (
              <Badge tone="violet">
                <Users className="size-3" /> {selected.sharedBy}
              </Badge>
            )}
          </div>

          <BatteryPill level={selected.batteryLevel} />

          <span className="text-xs text-ink-muted">
            {relativeTime(selected.lastLocation?.timestamp)}
          </span>

          <div className="ml-auto flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => startDirections(selected)}
            >
              <Navigation className="size-3.5" /> Go here
            </Button>
            {!selected.shared && (
              <Link href={`/devices/${selected.id}`}>
                <Button variant="ghost" size="sm">
                  Details
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={() => setFocused(null)}>
              Clear
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
