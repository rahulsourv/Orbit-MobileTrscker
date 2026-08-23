import { api } from "@/lib/api";

// Routing is proxied by the API rather than called from the browser, so the
// provider can change without touching this file, and both clients report
// identical distances and ETAs.
export const getDirections = ({ from, to, mode = "driving" }) => {
  const params = new URLSearchParams({
    fromLat: String(from.latitude),
    fromLng: String(from.longitude),
    toLat: String(to.latitude),
    toLng: String(to.longitude),
    mode,
  });

  return api.get(`/routes/directions?${params.toString()}`);
};

export const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined) {
    return "-";
  }

  if (seconds < 60) {
    return "under a minute";
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

// "Arriving at 14:32" answers the question people actually have.
export const arrivalTime = (seconds) => {
  if (!seconds && seconds !== 0) {
    return "-";
  }

  const arrival = new Date(Date.now() + seconds * 1000);

  return arrival.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
};
