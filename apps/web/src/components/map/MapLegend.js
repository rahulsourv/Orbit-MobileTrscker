"use client";

import { cn } from "@/lib/cn";

// Floats over the map rather than sitting beside it, so the map keeps the full
// width it needs to be the focal point.
export const MapLegend = ({ online, offline, className }) => (
  <div
    className={cn(
      "pointer-events-none absolute bottom-4 left-4 z-[500] flex items-center gap-4 rounded-xl",
      "border border-line bg-void/80 px-3 py-2 text-[11px] backdrop-blur-md",
      className
    )}
  >
    <span className="flex items-center gap-1.5 text-ink-muted">
      <span className="size-2 rounded-full bg-positive shadow-[0_0_8px] shadow-positive/70" />
      {online} online
    </span>
    <span className="flex items-center gap-1.5 text-ink-muted">
      <span className="size-2 rounded-full bg-ink-faint" />
      {offline} offline
    </span>
  </div>
);

export default MapLegend;
