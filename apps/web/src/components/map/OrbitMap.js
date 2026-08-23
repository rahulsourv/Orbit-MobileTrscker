"use client";

import dynamic from "next/dynamic";
import { Globe2 } from "lucide-react";

import { cn } from "@/lib/cn";

// Leaflet reaches for `window` at import time, so the canvas can only ever run
// in the browser. ssr:false is legal here because this module is a Client
// Component - in a Server Component it would be an error.
const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="grid size-full place-items-center bg-[#05070d]">
      <div className="flex flex-col items-center gap-3">
        <div className="relative grid size-12 place-items-center">
          <span className="absolute size-12 rounded-full border border-accent/20" />
          <span className="absolute size-12 rounded-full border-t border-accent/70 animate-[sweep_2.6s_linear_infinite]" />
          <Globe2 className="size-5 text-accent/70" />
        </div>
        <p className="text-xs text-ink-faint">Loading map</p>
      </div>
    </div>
  ),
});

export const OrbitMap = ({ className, ...props }) => (
  <div className={cn("relative overflow-hidden", className)}>
    <MapCanvas {...props} />
  </div>
);

export default OrbitMap;
