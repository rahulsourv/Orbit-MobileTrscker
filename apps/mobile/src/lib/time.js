// Small time helpers, matching the wording the web dashboard uses so the two
// clients never describe the same moment differently.
export const relativeTime = (value) => {
  if (!value) {
    return "Never";
  }

  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);

  if (seconds < 0) return "Just now";
  if (seconds < 45) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;

  return `${Math.floor(seconds / 86400)} d ago`;
};

// relativeTime only looks backwards; an expiry is in the future.
export const timeUntil = (value) => {
  if (!value) {
    return "-";
  }

  const remaining = new Date(value).getTime() - Date.now();

  if (remaining <= 0) return "Expired";
  if (remaining < 60000) return "in under a minute";
  if (remaining < 3600000) return `in ${Math.round(remaining / 60000)} min`;
  if (remaining < 86400000) return `in ${Math.round(remaining / 3600000)} h`;

  return `in ${Math.round(remaining / 86400000)} d`;
};

export const clockTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
};

export const absoluteTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();

  return sameDay
    ? `Today, ${clockTime(value)}`
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" }) +
        `, ${clockTime(value)}`;
};

export const formatDistance = (meters) => {
  if (meters === null || meters === undefined) return "-";

  return meters >= 1000
    ? `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`
    : `${Math.round(meters)} m`;
};

export const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined) return "-";
  if (seconds < 60) return "under a minute";

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

// "Arriving at 14:32" answers the question people actually have.
export const arrivalTime = (seconds) => {
  if (seconds === null || seconds === undefined) return "-";

  const arrival = new Date(Date.now() + seconds * 1000);

  return `${String(arrival.getHours()).padStart(2, "0")}:${String(
    arrival.getMinutes()
  ).padStart(2, "0")}`;
};

export const formatAccuracy = (meters) =>
  meters === null || meters === undefined
    ? "Unknown accuracy"
    : `±${Math.round(meters)} m`;
