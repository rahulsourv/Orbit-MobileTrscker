import { api } from "@/lib/api";

// Every device that has ever reported a position - the live map's first paint.
// Everything after this arrives over the socket rather than by polling.
export const getLiveSnapshot = () => api.get("/locations/live");

export const findNearby = ({ latitude, longitude, radius }) =>
  api.get(
    `/locations/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`
  );

export const getHistory = (deviceId, { from, to, limit = 500 } = {}) => {
  const params = new URLSearchParams({ limit: String(limit) });

  if (from) params.set("from", new Date(from).toISOString());
  if (to) params.set("to", new Date(to).toISOString());

  return api.get(`/devices/${deviceId}/locations?${params.toString()}`);
};

export const getLatestLocation = (deviceId) =>
  api.get(`/devices/${deviceId}/locations/latest`);

export const clearHistory = (deviceId, { before } = {}) => {
  const params = new URLSearchParams();

  if (before) params.set("before", new Date(before).toISOString());

  const query = params.toString();

  return api.delete(`/devices/${deviceId}/locations${query ? `?${query}` : ""}`);
};
