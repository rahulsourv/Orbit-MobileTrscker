import { formatDistanceToNowStrict, format, isToday, isYesterday } from "date-fns";

// "Just now" reads better than "3 seconds ago" and matches how the dashboard
// copy is written elsewhere.
export const relativeTime = (value) => {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  const seconds = (Date.now() - date.getTime()) / 1000;

  if (seconds < 45) {
    return "Just now";
  }

  return `${formatDistanceToNowStrict(date)} ago`;
};

// relativeTime only looks backwards. Expiry timestamps are in the future, and
// running them through it reports "Just now" because the elapsed seconds are
// negative.
export const timeUntil = (value) => {
  if (!value) {
    return "-";
  }

  const remaining = new Date(value).getTime() - Date.now();

  if (remaining <= 0) {
    return "Expired";
  }

  if (remaining < 60000) {
    return "in under a minute";
  }

  return `in ${formatDistanceToNowStrict(new Date(value))}`;
};

export const absoluteTime = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (isToday(date)) {
    return `Today, ${format(date, "HH:mm")}`;
  }

  if (isYesterday(date)) {
    return `Yesterday, ${format(date, "HH:mm")}`;
  }

  return format(date, "d MMM yyyy, HH:mm");
};

export const clockTime = (value) => (value ? format(new Date(value), "HH:mm:ss") : "-");

export const dayLabel = (value) => {
  const date = new Date(value);

  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";

  return format(date, "EEEE, d MMM");
};

// Coordinates are shown at six decimals - roughly a tenth of a metre, well
// past what consumer GPS resolves, and enough to paste into any map.
export const formatCoordinate = (value) =>
  typeof value === "number" ? value.toFixed(6) : "-";

export const formatCoordinatePair = (latitude, longitude) =>
  `${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`;

export const formatAccuracy = (meters) => {
  if (meters === null || meters === undefined) {
    return "Unknown accuracy";
  }

  return meters >= 1000
    ? `±${(meters / 1000).toFixed(1)} km`
    : `±${Math.round(meters)} m`;
};

export const formatDistance = (meters) => {
  if (meters === null || meters === undefined) {
    return "-";
  }

  return meters >= 1000
    ? `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`
    : `${Math.round(meters)} m`;
};

// Devices report metres per second; nobody reads a speed that way.
export const formatSpeed = (metersPerSecond) => {
  if (metersPerSecond === null || metersPerSecond === undefined) {
    return "-";
  }

  return `${Math.round(metersPerSecond * 3.6)} km/h`;
};

export const formatBattery = (level) =>
  level === null || level === undefined ? "-" : `${Math.round(level)}%`;

export const initialsOf = (name) =>
  (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

// "Good morning, Rahul" - the dashboard greets by time of day.
export const greeting = (date = new Date()) => {
  const hour = date.getHours();

  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";

  return "Good night";
};
