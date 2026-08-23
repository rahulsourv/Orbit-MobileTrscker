const env = require("../config/env");
const logger = require("../utils/logger");
const { AppError } = require("../middleware/error.middleware");
const { distanceMeters } = require("../utils/location");

/**
 * Turn-by-turn routing.
 *
 * Proxied through the API rather than called from the clients directly, for
 * three reasons: the provider can be swapped without touching web or mobile,
 * a future keyed provider's credentials never reach a phone, and both clients
 * get identical distances and ETAs rather than each rounding their own way.
 *
 * The default provider is OSRM's public demo server, which needs no key. It is
 * explicitly not for production traffic, so ROUTING_URL can point at a
 * self-hosted OSRM or any compatible service.
 */
const PROFILES = {
  driving: "driving",
  walking: "foot",
  cycling: "bike",
};

const routingBase = () =>
  (env.ROUTING_URL || "https://router.project-osrm.org").replace(/\/+$/, "");

const decorateSteps = (legs) => {
  const steps = [];

  for (const leg of legs || []) {
    for (const step of leg.steps || []) {
      const maneuver = step.maneuver || {};

      steps.push({
        instruction: buildInstruction(step, maneuver),
        distance: Math.round(step.distance || 0),
        duration: Math.round(step.duration || 0),
        latitude: maneuver.location?.[1] ?? null,
        longitude: maneuver.location?.[0] ?? null,
      });
    }
  }

  return steps;
};

// OSRM returns a maneuver type and modifier rather than a sentence, so the
// wording is built here - once, on the server, so both clients read the same.
const buildInstruction = (step, maneuver) => {
  const road = step.name ? ` onto ${step.name}` : "";
  const modifier = maneuver.modifier ? ` ${maneuver.modifier}` : "";

  switch (maneuver.type) {
    case "depart":
      return step.name ? `Head out on ${step.name}` : "Start";
    case "arrive":
      return "Arrive at your destination";
    case "roundabout":
    case "rotary":
      return `Take the roundabout${road}`;
    case "merge":
      return `Merge${modifier}${road}`;
    case "fork":
      return `Keep${modifier}${road}`;
    case "on ramp":
      return `Take the ramp${modifier}`;
    case "off ramp":
      return `Take the exit${modifier}`;
    case "continue":
      return `Continue${modifier}${road}`;
    case "new name":
      return `Continue${road}`;
    default:
      return `Turn${modifier}${road}`;
  }
};

const getDirections = async ({ from, to, mode = "driving" }) => {
  const profile = PROFILES[mode] || PROFILES.driving;

  // A route between two points a few metres apart is noise; the straight-line
  // answer is both cheaper and more honest.
  const straightLine = distanceMeters(from, to);

  if (straightLine < 25) {
    return {
      provider: "none",
      mode,
      distance: Math.round(straightLine),
      duration: 0,
      straightLineDistance: Math.round(straightLine),
      geometry: [
        { latitude: from.latitude, longitude: from.longitude },
        { latitude: to.latitude, longitude: to.longitude },
      ],
      steps: [],
      note: "You are already there",
    };
  }

  const url =
    `${routingBase()}/route/v1/${profile}/` +
    `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
    `?overview=full&geometries=geojson&steps=true&alternatives=false`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  let response;

  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Orbit/1.0 (personal device tracking)" },
    });
  } catch (error) {
    logger.warn(`routing request failed: ${error.message}`);

    // Falling back to the straight line keeps the feature useful when the
    // routing service is down, as long as the response says which it is.
    return straightLineFallback(from, to, mode, straightLine);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    logger.warn(`routing provider returned ${response.status}`);

    return straightLineFallback(from, to, mode, straightLine);
  }

  const payload = await response.json().catch(() => null);

  if (payload?.code !== "Ok" || !payload.routes?.length) {
    // "NoRoute" is a real answer - an island, or a walking route across an
    // ocean - not a failure to report as one.
    return straightLineFallback(from, to, mode, straightLine);
  }

  const route = payload.routes[0];

  return {
    provider: "osrm",
    mode,
    distance: Math.round(route.distance),
    duration: Math.round(route.duration),
    straightLineDistance: Math.round(straightLine),
    geometry: (route.geometry?.coordinates || []).map(([longitude, latitude]) => ({
      latitude,
      longitude,
    })),
    steps: decorateSteps(route.legs),
  };
};

const straightLineFallback = (from, to, mode, straightLine) => ({
  provider: "straight-line",
  mode,
  distance: Math.round(straightLine),
  // A rough average speed per mode, clearly labelled as an estimate so a
  // client never presents it as a real ETA.
  duration: Math.round(
    straightLine / ({ driving: 11, cycling: 4.5, walking: 1.4 }[mode] || 11)
  ),
  straightLineDistance: Math.round(straightLine),
  geometry: [
    { latitude: from.latitude, longitude: from.longitude },
    { latitude: to.latitude, longitude: to.longitude },
  ],
  steps: [],
  note: "Estimated in a straight line - no road route was available",
});

module.exports = { getDirections };
