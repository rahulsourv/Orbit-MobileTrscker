/**
 * Turning an expo-location reading into what the Orbit API accepts.
 *
 * Deliberately free of any native import so it can be reasoned about — and
 * tested — outside a device. It is also the one place where the shapes differ,
 * which makes it the one place a coordinate could get flipped.
 */

const round = (value, places) =>
  typeof value === "number" && Number.isFinite(value)
    ? Number(value.toFixed(places))
    : undefined;

export const toFix = (location, batteryLevel) => {
  const { coords, timestamp } = location;

  return {
    // The API takes named latitude/longitude, never a positional pair, so the
    // GeoJSON [longitude, latitude] ordering cannot leak into the client.
    latitude: coords.latitude,
    longitude: coords.longitude,
    // Accuracy is reported as -1 when the platform cannot determine it, and
    // the API validates it as non-negative — so an unknown accuracy would
    // otherwise reject an otherwise perfectly good position.
    accuracy:
      typeof coords.accuracy === "number" && coords.accuracy >= 0
        ? round(coords.accuracy, 2)
        : undefined,
    // Altitude is not guarded the same way: below sea level is a real place,
    // and the API accepts down to -500 m.
    altitude: round(coords.altitude, 2),
    // Both platforms report a negative speed or heading to mean "unknown",
    // while the API validates them as non-negative. Sending -1 through would
    // fail the whole fix over a value that means nothing.
    speed: typeof coords.speed === "number" && coords.speed >= 0
      ? round(coords.speed, 2)
      : undefined,
    heading:
      typeof coords.heading === "number" && coords.heading >= 0
        ? round(coords.heading, 2)
        : undefined,
    battery:
      typeof batteryLevel === "number" && batteryLevel >= 0
        ? batteryLevel
        : undefined,
    timestamp: new Date(timestamp).toISOString(),
  };
};
