import { api, API_URL } from "@/lib/api";

// Consent-based sharing. Nothing here reveals anything about the other person
// until they have accepted; the API enforces that, these are just the calls.
export const listConnections = () => api.get("/connections");

export const listSharedDevices = () => api.get("/connections/shared-devices");

// Returns { connection, inviteToken, hasAccount }. The token exists only in
// this response, so the invite link has to be built and copied now.
export const sendRequest = (payload) => api.post("/connections", payload);

export const acceptRequest = (connectionId, deviceIds) =>
  api.post(`/connections/${connectionId}/accept`, { deviceIds });

export const denyRequest = (connectionId) =>
  api.post(`/connections/${connectionId}/deny`, {});

export const updateSharedDevices = (connectionId, deviceIds) =>
  api.put(`/connections/${connectionId}/devices`, { deviceIds });

export const revokeConnection = (connectionId) =>
  api.delete(`/connections/${connectionId}`);

// Public: lets someone without an Orbit account see who is asking.
export const resolveInvite = async (token) => {
  const response = await fetch(`${API_URL}/connections/invite/${token}`, {
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || "This request is no longer available");
  }

  return payload.data.request;
};

export const inviteLinkFor = (token) =>
  typeof window === "undefined" ? "" : `${window.location.origin}/invite/${token}`;
