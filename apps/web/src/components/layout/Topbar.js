"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Bell, LogOut, User, Shield, Check } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/cn";
import { initialsOf, relativeTime } from "@/lib/format";
import { notificationMeta, TONE_CLASS } from "@/lib/constants";
import { useAuthStore } from "@/store/auth.store";
import { useNotificationStore } from "@/store/notification.store";

// Closes a popover on outside click and on Escape - both, because either alone
// leaves a way to get stuck with it open.
const useDismiss = (ref, onDismiss, active) => {
  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const onPointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        onDismiss();
      }
    };

    const onKey = (event) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, onDismiss, active]);
};

const NotificationTray = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const markAsRead = useNotificationStore((state) => state.markAsRead);

  useDismiss(ref, () => setOpen(false), open);

  const recent = notifications.slice(0, 6);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label="Alerts"
        className="focus-ring relative grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
      >
        <Bell className="size-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent shadow-[0_0_8px] shadow-accent" />
        )}
      </button>

      {open && (
        <div className="glass absolute right-0 top-11 z-50 w-[21rem] animate-fade overflow-hidden rounded-xl shadow-2xl shadow-black/60">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Alerts</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="focus-ring flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-ink-muted hover:text-accent"
              >
                <Check className="size-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {recent.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-ink-faint">
                No alerts yet
              </p>
            ) : (
              recent.map((notification) => {
                const meta = notificationMeta(notification.type);
                const Icon = meta.icon;

                return (
                  <button
                    key={notification.id}
                    onClick={() => markAsRead(notification.id)}
                    className={cn(
                      "flex w-full gap-3 border-b border-line/60 px-4 py-3 text-left transition-colors last:border-0",
                      notification.read ? "opacity-60" : "bg-white/[0.02]",
                      "hover:bg-white/[0.04]"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ring-1 ring-inset",
                        TONE_CLASS[meta.tone]
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-ink">
                        {notification.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-ink-faint">
                        {notification.message}
                      </span>
                      <span className="mt-1 block text-[10px] text-ink-faint">
                        {relativeTime(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <Link
            href="/alerts"
            onClick={() => setOpen(false)}
            className="block border-t border-line px-4 py-2.5 text-center text-xs text-ink-muted transition-colors hover:text-accent"
          >
            View all alerts
          </Link>
        </div>
      )}
    </div>
  );
};

const UserMenu = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  useDismiss(ref, () => setOpen(false), open);

  const signOut = async () => {
    try {
      await logout();
      toast.success("Signed out");
      router.replace("/login");
    } catch {
      toast.error("Could not sign out");
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="focus-ring flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-white/5"
      >
        <span className="grid size-7 place-items-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent ring-1 ring-accent/25">
          {initialsOf(user?.name)}
        </span>
        <span className="hidden text-xs font-medium text-ink-muted sm:block">
          {user?.name}
        </span>
      </button>

      {open && (
        <div className="glass absolute right-0 top-11 z-50 w-56 animate-fade overflow-hidden rounded-xl shadow-2xl shadow-black/60">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-medium text-ink">{user?.name}</p>
            <p className="truncate text-[11px] text-ink-faint">{user?.email}</p>
          </div>
          <div className="p-1.5">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
            >
              <User className="size-4" /> Account
            </Link>
            <Link
              href="/settings/security"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
            >
              <Shield className="size-4" /> Security
            </Link>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-danger transition-colors hover:bg-danger/10"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const Topbar = ({ onOpenNav, connected }) => (
  <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-base/80 px-4 backdrop-blur-xl lg:px-6">
    <button
      onClick={onOpenNav}
      aria-label="Open navigation"
      className="focus-ring grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-white/5 hover:text-ink lg:hidden"
    >
      <Menu className="size-[18px]" />
    </button>

    <div className="ml-auto flex items-center gap-1.5">
      {/* Live status is worth a permanent, quiet indicator: without it a stalled
          socket is indistinguishable from a day where nothing moved. */}
      <span
        title={connected ? "Live updates connected" : "Reconnecting"}
        className={cn(
          "mr-1 hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] sm:flex",
          connected
            ? "border-positive/25 bg-positive/10 text-positive"
            : "border-warning/25 bg-warning/10 text-warning"
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            connected ? "animate-pulse bg-positive" : "bg-warning"
          )}
        />
        {connected ? "Live" : "Reconnecting"}
      </span>

      <NotificationTray />
      <UserMenu />
    </div>
  </header>
);

export default Topbar;
