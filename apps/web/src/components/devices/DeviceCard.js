"use client";

import Link from "next/link";
import { MapPin, MapPinOff, EyeOff } from "lucide-react";

import { cn } from "@/lib/cn";
import { Badge, StatusDot } from "@/components/ui";
import { deviceTypeLabel, batteryTone, TONE_CLASS } from "@/lib/constants";
import { DeviceGlyph, BatteryGlyph } from "./DeviceGlyph";
import { relativeTime, formatBattery, formatCoordinatePair } from "@/lib/format";

export const BatteryPill = ({ level, className }) => {
  const tone = batteryTone(level);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        TONE_CLASS[tone],
        className
      )}
    >
      <BatteryGlyph level={level} className="size-3" />
      {formatBattery(level)}
    </span>
  );
};

export const DeviceCard = ({ device, href }) => {
  const location = device.lastLocation;

  return (
    <Link
      href={href || `/devices/${device.id}`}
      className="focus-ring glass glass-hover group block rounded-card p-4"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset transition-colors",
            device.isOnline
              ? "bg-accent/10 text-accent ring-accent/20"
              : "bg-white/5 text-ink-faint ring-white/10"
          )}
        >
          <DeviceGlyph type={device.type} className="size-[18px]" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-ink">{device.name}</p>
            <StatusDot online={device.isOnline} />
          </div>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            {deviceTypeLabel(device.type)}
            {device.model ? ` · ${device.model}` : ""}
          </p>
        </div>

        <BatteryPill level={device.batteryLevel} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-ink-muted">
          {location ? (
            <>
              <MapPin className="size-3 shrink-0 text-ink-faint" />
              <span className="truncate font-mono">
                {formatCoordinatePair(location.latitude, location.longitude)}
              </span>
            </>
          ) : (
            <>
              <MapPinOff className="size-3 shrink-0 text-ink-faint" />
              <span>No location yet</span>
            </>
          )}
        </span>

        <span className="shrink-0 text-[11px] text-ink-faint">
          {device.isOnline ? "Just now" : relativeTime(device.lastSeen)}
        </span>
      </div>

      {/* Tracking being off is the one state worth calling out on the card:
          the device will look silent, and this says why. */}
      {!device.trackingEnabled && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-line pt-3">
          <Badge tone="warning">
            <EyeOff className="size-3" /> Tracking off
          </Badge>
        </div>
      )}
    </Link>
  );
};

export default DeviceCard;
