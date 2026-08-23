import { api } from "@/lib/api";

export const listGeofences = () => api.get("/geofences");

export const createGeofence = (payload) => api.post("/geofences", payload);

export const updateGeofence = (geofenceId, patch) =>
  api.patch(`/geofences/${geofenceId}`, patch);

export const deleteGeofence = (geofenceId) => api.delete(`/geofences/${geofenceId}`);
