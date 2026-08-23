const EARTH_RADIUS_METERS = 6371008.8;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const isValidLatitude = (value) =>
  isFiniteNumber(value) && value >= -90 && value <= 90;

const isValidLongitude = (value) =>
  isFiniteNumber(value) && value >= -180 && value <= 180;

// GeoJSON is [longitude, latitude] - the opposite order of how humans and most
// map libraries write coordinates. Every conversion goes through here so that
// the swap happens in exactly one place.
const toGeoPoint = (latitude, longitude) => ({
  type: "Point",
  coordinates: [longitude, latitude],
});

const fromGeoPoint = (point) => {
  if (!point || !Array.isArray(point.coordinates)) {
    return null;
  }

  const [longitude, latitude] = point.coordinates;

  return { latitude, longitude };
};

// Great-circle distance in metres. Accurate enough for geofence radii, which
// are tens of metres to a few kilometres.
const distanceMeters = (from, to) => {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
};

// $centerSphere takes a radius in radians, not metres.
const metersToRadians = (meters) => meters / EARTH_RADIUS_METERS;

// A geofence with a hard edge flaps between enter and exit when a device sits
// near the boundary and GPS jitters. The boundary is therefore widened when
// leaving and narrowed when entering, so a device must travel through the
// hysteresis band before the state flips again.
const HYSTERESIS_RATIO = 0.1;
const MAX_HYSTERESIS_METERS = 50;

const isInsideGeofence = ({ point, center, radius, wasInside }) => {
  const distance = distanceMeters(point, center);
  const margin = Math.min(radius * HYSTERESIS_RATIO, MAX_HYSTERESIS_METERS);
  const threshold = wasInside ? radius + margin : radius - margin;

  return { inside: distance <= threshold, distance };
};

module.exports = {
  EARTH_RADIUS_METERS,
  isValidLatitude,
  isValidLongitude,
  toGeoPoint,
  fromGeoPoint,
  distanceMeters,
  metersToRadians,
  isInsideGeofence,
};
