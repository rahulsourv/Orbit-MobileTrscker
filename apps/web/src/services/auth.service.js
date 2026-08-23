import { api, setAccessToken } from "@/lib/api";

// Web clients never ask for the refresh token in the body: it arrives as an
// HttpOnly cookie the browser stores and JavaScript cannot read.
export const register = (payload) => api.post("/auth/register", payload);

export const login = async (credentials) => {
  const data = await api.post("/auth/login", credentials);

  setAccessToken(data.accessToken);

  return data;
};

export const logout = async () => {
  try {
    await api.post("/auth/logout", {});
  } finally {
    // Even if the call fails the local session is dropped - the user asked to
    // be signed out, so the UI must honour it either way.
    setAccessToken(null);
  }
};

export const logoutEverywhere = async () => {
  await api.post("/auth/logout-all", {});
  setAccessToken(null);
};

export const me = () => api.get("/auth/me");

export const listSessions = () => api.get("/auth/sessions");
