"use client";

import { Layers, RefreshCw, Navigation, X, Clock, Route } from "lucide-react";

import { cn } from "@/lib/cn";
import { MAP_LAYERS, LAYER_KEYS, TRAVEL_MODES } from "@/lib/mapLayers";
import { formatDistance } from "@/lib/format";
import { formatDuration, arrivalTime } from "@/services/route.service";

/**
 * Basemap switcher.
 *
 * Floats over the map rather than sitting beside it, so the map keeps the full
 * width it needs to be the focal point.
 */
export const LayerSwitcher = ({ layer, onChange, className }) => (
  <div
    className={cn(
      "absolute right-3 top-3 z-[500] flex overflow-hidden rounded-xl border border-line",
      "bg-void/85 backdrop-blur-md",
      className
    )}
  >
    <span className="grid w-8 place-items-center border-r border-line text-ink-faint">
      <Layers className="size-3.5" />
    </span>
    {LAYER_KEYS.map((key) => (
      <button
        key={key}
        onClick={() => onChange(key)}
        className={cn(
          "focus-ring px-2.5 py-1.5 text-[11px] transition-colors",
          layer === key
            ? "bg-accent/15 text-accent"
            : "text-ink-muted hover:bg-white/5 hover:text-ink"
        )}
      >
        {MAP_LAYERS[key].label}
      </button>
    ))}
  </div>
);

/**
 * Auto-refresh control.
 *
 * The map is already pushed updates over the socket, so this is a belt-and-
 * braces re-read for when a socket has quietly dropped — which is why it
 * reports the socket's actual state rather than implying it is the only path.
 */
export const RefreshControl = ({
  connected,
  auto,
  onToggleAuto,
  onRefresh,
  refreshing,
  lastRefreshed,
  className,
}) => (
  <div
    className={cn(
      "absolute left-3 top-3 z-[500] flex items-center gap-1 rounded-xl border border-line",
      "bg-void/85 p-1 backdrop-blur-md",
      className
    )}
  >
    <span
      title={connected ? "Live updates connected" : "Socket disconnected — falling back to refresh"}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px]",
        connected ? "text-positive" : "text-warning"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          connected ? "animate-pulse bg-positive" : "bg-warning"
        )}
      />
      {connected ? "Live" : "Offline"}
    </span>

    <button
      onClick={onRefresh}
      disabled={refreshing}
      title={lastRefreshed ? `Last refreshed ${lastRefreshed}` : "Refresh now"}
      className="focus-ring rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-white/5 hover:text-ink disabled:opacity-50"
    >
      <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
    </button>

    <button
      onClick={() => onToggleAuto(!auto)}
      className={cn(
        "focus-ring rounded-lg px-2 py-1 text-[11px] transition-colors",
        auto ? "bg-accent/15 text-accent" : "text-ink-muted hover:bg-white/5 hover:text-ink"
      )}
    >
      Auto {auto ? "on" : "off"}
    </button>
  </div>
);

/**
 * The directions panel.
 *
 * Answers the three questions someone actually has when they tap "go here":
 * how far, how long, and when will I arrive.
 */
export const DirectionsPanel = ({
  route,
  destinationLabel,
  mode,
  onModeChange,
  onClose,
  loading,
  error,
  className,
}) => (
  <div
    className={cn(
      "absolute bottom-3 left-3 z-[500] w-[min(22rem,calc(100%-1.5rem))] overflow-hidden",
      "rounded-xl border border-line bg-void/90 backdrop-blur-md",
      className
    )}
  >
    <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
      <Navigation className="size-3.5 shrink-0 text-accent" />
      <p className="min-w-0 flex-1 truncate text-xs font-medium text-ink">
        {destinationLabel}
      </p>
      <button
        onClick={onClose}
        aria-label="Close directions"
        className="focus-ring rounded p-1 text-ink-faint hover:text-ink"
      >
        <X className="size-3.5" />
      </button>
    </div>

    <div className="flex gap-1 border-b border-line px-2 py-2">
      {TRAVEL_MODES.map((option) => (
        <button
          key={option.value}
          onClick={() => onModeChange(option.value)}
          className={cn(
            "focus-ring flex-1 rounded-lg px-2 py-1.5 text-[11px] transition-colors",
            mode === option.value
              ? "bg-accent/15 text-accent"
              : "text-ink-muted hover:bg-white/5 hover:text-ink"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>

    {loading ? (
      <p className="px-3 py-4 text-center text-xs text-ink-faint">Finding a route…</p>
    ) : error ? (
      <p className="px-3 py-4 text-center text-xs text-danger">{error}</p>
    ) : route ? (
      <>
        <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
          <div className="px-3 py-2.5">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-ink-faint">
              <Route className="size-2.5" /> Distance
            </p>
            <p className="mt-0.5 text-sm font-semibold text-ink">
              {formatDistance(route.distance)}
            </p>
          </div>
          <div className="px-3 py-2.5">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-ink-faint">
              <Clock className="size-2.5" /> Time
            </p>
            <p className="mt-0.5 text-sm font-semibold text-ink">
              {formatDuration(route.duration)}
            </p>
          </div>
          <div className="px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-ink-faint">Arrive</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">
              {arrivalTime(route.duration)}
            </p>
          </div>
        </div>

        {/* A straight-line estimate must never be presented as a real route. */}
        {route.provider === "straight-line" && (
          <p className="border-b border-warning/25 bg-warning/[0.07] px-3 py-2 text-[11px] text-warning">
            {route.note || "Estimated in a straight line."}
          </p>
        )}

        {route.steps?.length > 0 && (
          <ol className="max-h-44 overflow-y-auto">
            {route.steps.map((step, index) => (
              <li
                key={`${index}-${step.instruction}`}
                className="flex items-start gap-2.5 border-b border-line/60 px-3 py-2 last:border-0"
              >
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-white/5 text-[9px] text-ink-faint">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-ink-muted">
                  {step.instruction}
                </span>
                <span className="shrink-0 text-[10px] text-ink-faint">
                  {formatDistance(step.distance)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </>
    ) : null}
  </div>
);
