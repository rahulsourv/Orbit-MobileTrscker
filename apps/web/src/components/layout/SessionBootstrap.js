"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/store/auth.store";

/**
 * Runs the one-time session restore.
 *
 * The access token only ever lived in memory, so every cold load starts signed
 * out until the HttpOnly refresh cookie has been exchanged. Mounted at the root
 * so both the marketing pages and the dashboard know who the visitor is.
 */
export const SessionBootstrap = () => {
  const status = useAuthStore((state) => state.status);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    if (status === "loading") {
      bootstrap();
    }
  }, [status, bootstrap]);

  return null;
};

export default SessionBootstrap;
