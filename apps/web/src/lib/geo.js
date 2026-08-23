const EARTH_RADIUS_METERS = 6371008.8;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

// Great-circle distance between two { latitude, longitude } points. The backend
// carries the same formula for geofence evaluation; this copy exists so the
// dashboard can summarise a path without asking the server to do it.
export const distanceMeters = (from, to) => {
  if (!from || !to) {
    return 0;
  }

  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
};

// Used by the geofence editor to show which devices currently sit inside a
// circle being drawn.
export const isWithin = (point, center, radius) =>
  distanceMeters(point, center) <= radius;
