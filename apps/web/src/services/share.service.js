import { api, API_URL } from "@/lib/api";

export const listShares = (deviceId) =>
  api.get(`/shares${deviceId ? `?deviceId=${deviceId}` : ""}`);

// Returns { share, token }. The token only exists in this response, so the
// link has to be built and copied now.
export const createShare = (payload) => api.post("/shares", payload);

export const revokeShare = (shareId) => api.delete(`/shares/${shareId}`);

// Public, unauthenticated read used by the recipient's page.
export const resolveShare = async (token) => {
  const response = await fetch(`${API_URL}/shares/public/${token}`, {
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || "This share link is no longer available");
  }

  return payload.data.share;
};

export const shareLinkFor = (token) =>
  typeof window === "undefined" ? "" : `${window.location.origin}/share/${token}`;
