"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Smartphone } from "lucide-react";

import {
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
} from "@/components/ui";
import { DeviceCard } from "@/components/devices/DeviceCard";
import { AddDeviceModal } from "@/components/devices/AddDeviceModal";
import { useDeviceStore } from "@/store/device.store";
import { cn } from "@/lib/cn";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "paused", label: "Tracking off" },
];

export default function DevicesPage() {
  const devices = useDeviceStore((state) => state.devices);
  const loading = useDeviceStore((state) => state.loading);

  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return devices.filter((device) => {
      if (filter === "online" && !device.isOnline) return false;
      if (filter === "offline" && device.isOnline) return false;
      if (filter === "paused" && device.trackingEnabled) return false;

      if (!needle) return true;

      return (
        device.name.toLowerCase().includes(needle) ||
        (device.model || "").toLowerCase().includes(needle) ||
        device.type.includes(needle)
      );
    });
  }, [devices, query, filter]);

  const counts = useMemo(
    () => ({
      all: devices.length,
      online: devices.filter((device) => device.isOnline).length,
      offline: devices.filter((device) => !device.isOnline).length,
      paused: devices.filter((device) => !device.trackingEnabled).length,
    }),
    [devices]
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Devices"
        description="Everything you've connected to Orbit."
        action={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> Add device
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            placeholder="Search devices"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-1 rounded-lg border border-line bg-void/40 p-1">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                "focus-ring rounded-md px-2.5 py-1.5 text-xs transition-colors",
                filter === option.value
                  ? "bg-white/[0.08] text-ink"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              {option.label}
              <span className="ml-1.5 text-ink-faint">{counts[option.value]}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-[7.5rem]" />
          ))}
        </div>
      ) : devices.length === 0 ? (
        <Card>
          <EmptyState
            icon={Smartphone}
            title="No devices yet"
            description="A device only appears here once you register it. Orbit hands it a token, and nothing without that token can report a position."
            action={
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="size-4" /> Add your first device
              </Button>
            }
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title="Nothing matches"
            description="Try a different search or filter."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      )}

      <AddDeviceModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
