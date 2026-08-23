"use client";

import { Fragment, useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";

import "leaflet/dist/leaflet.css";

import { deviceTypeLabel } from "@/lib/constants";
import { MAP_LAYERS, DEFAULT_LAYER } from "@/lib/mapLayers";
import {
  relativeTime,
  formatAccuracy,
  formatBattery,
  formatCoordinatePair,
} from "@/lib/format";

const COLORS = {
  online: "#34d399",
  offline: "#5d6779",
  shared: "#a78bfa",
  accent: "#22d3ee",
  route: "#22d3ee",
};

// Leaflet's default marker is a PNG that bundlers famously break, and a static
// pin would not convey liveness anyway. This is a div we fully control, so the
// live ring can breathe in CSS.
const buildIcon = (color, { pulse }) =>
  L.divIcon({
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
    html: `<div class="orbit-marker" style="color:${color}">
      ${pulse ? '<span class="orbit-marker__ring"></span>' : ""}
      <span class="orbit-marker__core"></span>
    </div>`,
  });

// A destination pin is deliberately a different shape from a device: it is a
// place, not a thing that moves.
const destinationIcon = () =>
  L.divIcon({
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    html: `<div style="color:${COLORS.accent}">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5"
           style="filter:drop-shadow(0 0 6px currentColor)">
        <path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z" fill="#06070a"/>
        <circle cx="12" cy="10" r="2.5" fill="currentColor" stroke="none"/>
      </svg>
    </div>`,
  });

/**
 * Keeps every point in view without yanking the map while the user is reading
 * it: the fit runs when the set of points meaningfully changes, not on every
 * incoming coordinate update.
 */
const FitBounds = ({ points, enabled, padding = 0.25 }) => {
  const map = useMap();
  const signature = points.map((point) => point.join(",")).join("|");

  useEffect(() => {
    if (!enabled || !points.length) {
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 15), { animate: true });
      return;
    }

    map.fitBounds(L.latLngBounds(points).pad(padding), { animate: true });
    // signature collapses the points into one primitive so this cannot loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled]);

  return null;
};

// Recentres when the page asks for a specific device to be focused.
const FocusPoint = ({ point, zoom = 16 }) => {
  const map = useMap();
  const key = point ? point.join(",") : null;

  useEffect(() => {
    if (point) {
      map.flyTo(point, zoom, { duration: 0.8 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
};

// Leaflet measures the container on mount. Inside a flex dashboard the final
// height often arrives a tick later, which leaves grey bands until it is told
// to re-measure.
const ResizeHandler = () => {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    const timer = setTimeout(invalidate, 120);

    window.addEventListener("resize", invalidate);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", invalidate);
    };
  }, [map]);

  return null;
};

const DEFAULT_CENTER = [20, 0];

export default function MapCanvas({
  devices = [],
  geofences = [],
  trail = null,
  route = null,
  destination = null,
  focusedDeviceId = null,
  layer = DEFAULT_LAYER,
  autoFit = true,
  showAccuracy = true,
  onSelectDevice,
  className = "",
}) {
  const mapRef = useRef(null);
  const tiles = MAP_LAYERS[layer] || MAP_LAYERS[DEFAULT_LAYER];

  const positioned = useMemo(
    () => devices.filter((device) => device.lastLocation),
    [devices]
  );

  const points = useMemo(() => {
    const devicePoints = positioned.map((device) => [
      device.lastLocation.latitude,
      device.lastLocation.longitude,
    ]);

    const trailPoints = trail?.length
      ? trail.map((fix) => [fix.latitude, fix.longitude])
      : [];

    const routePoints = route?.geometry?.length
      ? route.geometry.map((point) => [point.latitude, point.longitude])
      : [];

    const fencePoints = geofences.map((fence) => [fence.latitude, fence.longitude]);

    return [...devicePoints, ...trailPoints, ...routePoints, ...fencePoints];
  }, [positioned, trail, route, geofences]);

  const focused = positioned.find((device) => device.id === focusedDeviceId);

  const focusPoint = focused
    ? [focused.lastLocation.latitude, focused.lastLocation.longitude]
    : null;

  return (
    <MapContainer
      ref={mapRef}
      center={points[0] || DEFAULT_CENTER}
      zoom={points.length ? 13 : 2}
      zoomControl
      scrollWheelZoom
      worldCopyJump
      className={className}
      style={{ height: "100%", width: "100%" }}
    >
      {/* Keyed by layer so switching swaps the tiles rather than stacking them. */}
      <TileLayer
        key={layer}
        url={tiles.url}
        attribution={tiles.attribution}
        maxZoom={tiles.maxZoom}
      />
      {tiles.labels && (
        <TileLayer key={`${layer}-labels`} url={tiles.labels} maxZoom={tiles.maxZoom} />
      )}

      <ResizeHandler />
      <FitBounds points={points} enabled={autoFit && !focusedDeviceId} />
      <FocusPoint point={focusPoint} />

      {geofences.map((fence) => (
        <Circle
          key={fence.id}
          center={[fence.latitude, fence.longitude]}
          radius={fence.radius}
          pathOptions={{
            color: fence.color || COLORS.shared,
            weight: 1.5,
            opacity: fence.active ? 0.75 : 0.3,
            fillColor: fence.color || COLORS.shared,
            fillOpacity: fence.active ? 0.08 : 0.03,
            dashArray: fence.active ? null : "4 6",
          }}
        >
          <Popup>
            <div className="space-y-1">
              <p className="font-semibold text-ink">{fence.name}</p>
              <p className="text-ink-muted">
                {fence.radius >= 1000
                  ? `${(fence.radius / 1000).toFixed(1)} km radius`
                  : `${fence.radius} m radius`}
              </p>
            </div>
          </Popup>
        </Circle>
      ))}

      {trail?.length > 1 && (
        <>
          {/* Drawn twice: a wide, faint pass underneath gives the thin line a
              glow instead of leaving it to fight the basemap. */}
          <Polyline
            positions={trail.map((fix) => [fix.latitude, fix.longitude])}
            pathOptions={{ color: COLORS.accent, weight: 8, opacity: 0.12 }}
          />
          <Polyline
            positions={trail.map((fix) => [fix.latitude, fix.longitude])}
            pathOptions={{ color: COLORS.accent, weight: 2, opacity: 0.9 }}
          />
        </>
      )}

      {/* The active route is drawn heavier than a history trail, because it is
          an instruction rather than a record. */}
      {route?.geometry?.length > 1 && (
        <>
          <Polyline
            positions={route.geometry.map((point) => [point.latitude, point.longitude])}
            pathOptions={{ color: "#06070a", weight: 11, opacity: 0.55 }}
          />
          <Polyline
            positions={route.geometry.map((point) => [point.latitude, point.longitude])}
            pathOptions={{
              color: COLORS.route,
              weight: 5,
              opacity: 0.95,
              // A straight-line estimate is dashed, so it never reads as a real
              // road route.
              dashArray: route.provider === "straight-line" ? "8 10" : null,
            }}
          />
        </>
      )}

      {destination && (
        <Marker
          position={[destination.latitude, destination.longitude]}
          icon={destinationIcon()}
        >
          <Popup>
            <p className="font-semibold text-ink">{destination.label || "Destination"}</p>
            <p className="mt-1 font-mono text-[10px] text-ink-faint">
              {formatCoordinatePair(destination.latitude, destination.longitude)}
            </p>
          </Popup>
        </Marker>
      )}

      {positioned.map((device) => {
        const { latitude, longitude, accuracy, timestamp } = device.lastLocation;
        // Someone else's device is violet, so it is never mistaken for one of
        // your own that you can control.
        const color = device.shared
          ? COLORS.shared
          : device.isOnline
            ? COLORS.online
            : COLORS.offline;

        return (
          // A Fragment, not a div: anything that is not a Leaflet layer would
          // be mounted into the map container as a stray DOM node.
          <Fragment key={device.id}>
            {showAccuracy && accuracy ? (
              <Circle
                center={[latitude, longitude]}
                radius={accuracy}
                pathOptions={{
                  color,
                  weight: 1,
                  opacity: 0.25,
                  fillColor: color,
                  fillOpacity: 0.06,
                }}
              />
            ) : null}

            <Marker
              position={[latitude, longitude]}
              icon={buildIcon(color, { pulse: device.isOnline })}
              eventHandlers={{
                click: () => onSelectDevice?.(device.id),
              }}
            >
              <Popup>
                <div className="min-w-[11rem] space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-ink">{device.name}</p>
                    <span style={{ color }} className="text-[11px] font-medium">
                      {device.isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                  <p className="text-ink-faint">{deviceTypeLabel(device.type)}</p>
                  {device.shared && (
                    <p className="text-[11px]" style={{ color: COLORS.shared }}>
                      Shared by {device.sharedBy}
                    </p>
                  )}
                  <div className="pt-1 text-ink-muted">
                    <p>{relativeTime(timestamp)}</p>
                    <p>{formatAccuracy(accuracy)}</p>
                    {device.batteryLevel !== null && (
                      <p>Battery {formatBattery(device.batteryLevel)}</p>
                    )}
                  </div>
                  <p className="pt-1 font-mono text-[10px] text-ink-faint">
                    {formatCoordinatePair(latitude, longitude)}
                  </p>
                </div>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
