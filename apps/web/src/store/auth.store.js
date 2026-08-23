"use client";

import { create } from "zustand";

import { api, setAccessToken, setSessionExpiredHandler } from "@/lib/api";
import * as authService from "@/services/auth.service";

export const useAuthStore = create((set, get) => ({
  user: null,
  // "loading" until the refresh cookie has been tried once, so guarded pages
  // can wait instead of flashing the login screen at a signed-in user.
  status: "loading",

  isAuthenticated: () => get().status === "authenticated",

  /**
   * Rebuilds the session on a cold load. The access token was only ever in
   * memory, so a page refresh loses it; the HttpOnly cookie is what proves the
   * user is still signed in.
   */
  bootstrap: async () => {
    try {
      const data = await api.refreshSession();

      set({ user: data.user, status: "authenticated" });

      return data.user;
    } catch {
      set({ user: null, status: "anonymous" });

      return null;
    }
  },

  login: async (credentials) => {
    const data = await authService.login(credentials);

    set({ user: data.user, status: "authenticated" });

    return data.user;
  },

  register: async (payload) => {
    await authService.register(payload);

    // Registration deliberately does not sign the user in on the server, so
    // the first session is created through the normal login path.
    return get().login({ email: payload.email, password: payload.password });
  },

  logout: async () => {
    await authService.logout();
    set({ user: null, status: "anonymous" });
  },

  logoutEverywhere: async () => {
    await authService.logoutEverywhere();
    set({ user: null, status: "anonymous" });
  },

  // Called by the API client when a refresh finally fails, from wherever that
  // happened - including a request the user never initiated.
  expire: () => {
    setAccessToken(null);
    set({ user: null, status: "anonymous" });
  },
}));

setSessionExpiredHandler(() => useAuthStore.getState().expire());
