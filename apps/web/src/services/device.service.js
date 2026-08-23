import { api } from "@/lib/api";

export const listDevices = () => api.get("/devices");

export const getDevice = (deviceId) => api.get(`/devices/${deviceId}`);

// Returns { device, deviceToken }. The raw token is shown once and never again.
export const registerDevice = (payload) => api.post("/devices", payload);

export const updateDevice = (deviceId, patch) =>
  api.patch(`/devices/${deviceId}`, patch);

export const setTracking = (deviceId, trackingEnabled) =>
  api.put(`/devices/${deviceId}/tracking`, { trackingEnabled });

export const rotateDeviceToken = (deviceId) =>
  api.post(`/devices/${deviceId}/token/rotate`, {});

export const deleteDevice = (deviceId) => api.delete(`/devices/${deviceId}`);
