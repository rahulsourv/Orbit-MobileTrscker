"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { History as HistoryIcon, Trash2, Route, Gauge } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Select,
  Spinner,
} from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/Modal";
import { OrbitMap } from "@/components/map/OrbitMap";
import { useDeviceStore } from "@/store/device.store";
import * as locationService from "@/services/location.service";
import { absoluteTime, clockTime, dayLabel, formatDistance, formatSpeed } from "@/lib/format";
import { distanceMeters } from "@/lib/geo";
import { cn } from "@/lib/cn";

const RANGES = [
  { value: 1, label: "Last 24 hours" },
  { value: 3, label: "Last 3 days" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
];

const HistoryView = () => {
  const searchParams = useSearchParams();
  const devices = useDeviceStore((state) => state.devices);
  const devicesLoading = useDeviceStore((state) => state.loading);

  // The chosen device is derived rather than stored: it follows the ?device=
  // deep link, or the first device, until the user explicitly picks another.
  const [chosenDeviceId, setChosenDeviceId] = useState(null);
  const [days, setDays] = useState(1);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const requested = searchParams.get("device");

  const deviceId =
    chosenDeviceId ??
    (devices.find((device) => device.id === requested)?.id || devices[0]?.id) ??
    "";

  useEffect(() => {
    if (!deviceId) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const data = await locationService.getHistory(deviceId, {
          from,
          limit: 1000,
        });

        // Oldest-first, so the path draws in the direction of travel.
        if (!cancelled) {
          setLocations([...data.locations].reverse());
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error.message);
          setLocations([]);
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
  }, [deviceId, days]);

  const device = devices.find((entry) => entry.id === deviceId);

  // Total path length, summed between consecutive fixes.
  const summary = useMemo(() => {
    if (locations.length < 2) {
      return { distance: 0, topSpeed: null, span: null };
    }

    let distance = 0;

    for (let index = 1; index < locations.length; index += 1) {
      distance += distanceMeters(locations[index - 1], locations[index]);
    }

    const speeds = locations
      .map((fix) => fix.speed)
      .filter((speed) => typeof speed === "number");

    return {
      distance,
      topSpeed: speeds.length ? Math.max(...speeds) : null,
      span: {
        from: locations[0].timestamp,
        to: locations[locations.length - 1].timestamp,
      },
    };
  }, [locations]);

  // Grouped by day so a long range stays readable as a timeline.
  const grouped = useMemo(() => {
    const groups = new Map();

    [...locations].reverse().forEach((fix) => {
      const key = dayLabel(fix.timestamp);

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(fix);
    });

    return [...groups.entries()];
  }, [locations]);

  const clearHistory = async () => {
    setClearing(true);

    try {
      const result = await locationService.clearHistory(deviceId);

      toast.success(`Deleted ${result.deleted} record${result.deleted === 1 ? "" : "s"}`);
      setLocations([]);
      setClearOpen(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setClearing(false);
    }
  };

  if (!devicesLoading && devices.length === 0) {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          icon={HistoryIcon}
          title="No devices yet"
          description="Register a device first — its location history will show up here."
        />
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Location history"
        description="Where a device has been, drawn as a path."
        action={
          locations.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setClearOpen(true)}
            >
              <Trash2 className="size-3.5" /> Clear history
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          value={deviceId}
          onChange={(event) => setChosenDeviceId(event.target.value)}
          className="w-auto min-w-48"
        >
          {devices.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </Select>

        <Select
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          className="w-auto min-w-40"
        >
          {RANGES.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card className="overflow-hidden">
          <CardHeader
            title={device ? `${device.name}'s path` : "Path"}
            subtitle={
              loading
                ? "Loading"
                : locations.length
                  ? `${locations.length} points · ${formatDistance(summary.distance)} travelled`
                  : "No positions in this range"
            }
          />
          <div className="h-[28rem] border-t border-line">
            {loading ? (
              <div className="grid size-full place-items-center">
                <Spinner />
              </div>
            ) : locations.length ? (
              <OrbitMap
                devices={device ? [device] : []}
                trail={locations}
                showAccuracy={false}
                className="size-full"
              />
            ) : (
              <EmptyState
                icon={Route}
                title="Nothing recorded here"
                description="Either the device did not report in this window, or its history was cleared."
              />
            )}
          </div>
        </Card>

        <div className="space-y-4">
          {locations.length > 1 && (
            <Card className="grid grid-cols-2 gap-2 p-4">
              <div className="rounded-xl border border-line bg-void/40 p-3">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-faint">
                  <Route className="size-3" /> Distance
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {formatDistance(summary.distance)}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-void/40 p-3">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-faint">
                  <Gauge className="size-3" /> Top speed
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {formatSpeed(summary.topSpeed)}
                </p>
              </div>
              <div className="col-span-2 rounded-xl border border-line bg-void/40 p-3">
                <p className="text-[10px] uppercase tracking-wide text-ink-faint">
                  Range
                </p>
                <p className="mt-1 text-xs text-ink">
                  {absoluteTime(summary.span?.from)} → {absoluteTime(summary.span?.to)}
                </p>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader title="Timeline" subtitle="Newest first" />
            <div className="max-h-[24rem] overflow-y-auto border-t border-line">
              {grouped.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-ink-faint">
                  Nothing to list
                </p>
              ) : (
                grouped.map(([day, fixes]) => (
                  <div key={day}>
                    <p className="sticky top-0 z-10 border-b border-line bg-raised/95 px-4 py-2 text-[11px] font-medium text-ink-muted backdrop-blur">
                      {day}
                      <span className="ml-2 text-ink-faint">{fixes.length}</span>
                    </p>
                    {fixes.slice(0, 60).map((fix, index) => (
                      <div
                        key={fix.id}
                        className="flex items-center gap-3 border-b border-line/50 px-4 py-2 last:border-0"
                      >
                        {/* A vertical thread through the timeline, so the
                            points read as one continuous track. */}
                        <span className="relative flex flex-col items-center self-stretch">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              index === 0 ? "bg-accent" : "bg-ink-faint"
                            )}
                          />
                          <span className="w-px flex-1 bg-line" />
                        </span>
                        <span className="font-mono text-[11px] text-ink-muted">
                          {clockTime(fix.timestamp)}
                        </span>
                        <span className="ml-auto truncate font-mono text-[10px] text-ink-faint">
                          {fix.latitude.toFixed(4)}, {fix.longitude.toFixed(4)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={clearHistory}
        loading={clearing}
        title={`Clear ${device?.name}'s history?`}
        description="Every recorded position for this device is deleted. The device itself stays registered."
        confirmLabel="Delete history"
      />
    </div>
  );
};

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryView />
    </Suspense>
  );
}
