"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

import { useAuthStore } from "@/store/auth.store";
import { OrbitMark } from "./Sidebar";

/**
 * Client-side guard for the signed-in area.
 *
 * This is a UX guard, not a security boundary: every protected byte comes from
 * the API, which authorises each request on its own. Its job is to avoid
 * rendering a dashboard shell to someone who is about to be redirected.
 */
export const AuthGate = ({ children }) => {
  const status = useAuthStore((state) => state.status);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "anonymous") {
      // Remember where they were headed so the login page can send them back.
      const next = encodeURIComponent(pathname);

      router.replace(`/login?next=${next}`);
    }
  }, [status, router, pathname]);

  if (status !== "authenticated") {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-4">
          <OrbitMark className="size-10" />
          <p className="text-xs text-ink-faint">
            {status === "loading" ? "Restoring your session" : "Redirecting"}
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default AuthGate;
