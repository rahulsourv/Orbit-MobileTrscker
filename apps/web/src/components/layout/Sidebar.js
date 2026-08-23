"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Smartphone,
  Radar,
  History,
  Hexagon,
  Users,
  Bell,
  Settings,
  X,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { useNotificationStore } from "@/store/notification.store";
import { useConnectionStore } from "@/store/connection.store";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/devices", label: "Devices", icon: Smartphone },
  { href: "/live", label: "Live Map", icon: Radar },
  { href: "/history", label: "Location History", icon: History },
  { href: "/geofences", label: "Geofences", icon: Hexagon },
  { href: "/people", label: "People", icon: Users, badge: "people" },
  { href: "/alerts", label: "Alerts", icon: Bell, badge: "alerts" },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const OrbitMark = ({ className }) => (
  <span className={cn("relative grid size-8 shrink-0 place-items-center", className)}>
    <span className="absolute inset-0 rounded-full border border-accent/25" />
    <span className="absolute inset-0 rounded-full border-t border-accent/80" />
    <span className="size-2 rounded-full bg-accent shadow-[0_0_12px] shadow-accent/80" />
  </span>
);

const NavItem = ({ item, active, onNavigate }) => {
  const unread = useNotificationStore((state) => state.unreadCount);
  const incoming = useConnectionStore((state) => state.incoming);
  const Icon = item.icon;

  // Both badges count something the user has not dealt with yet, so they share
  // one code path rather than each growing their own.
  const pendingRequests = incoming.filter(
    (entry) => entry.status === "pending"
  ).length;

  const count = item.badge === "alerts" ? unread : pendingRequests;
  const showBadge = Boolean(item.badge) && count > 0;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "focus-ring group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-white/[0.06] text-ink"
          : "text-ink-muted hover:bg-white/[0.03] hover:text-ink"
      )}
    >
      {/* The active rail, rather than a filled block - quieter, and it keeps
          the eye on content instead of chrome. */}
      <span
        className={cn(
          "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-all duration-300",
          active ? "opacity-100" : "opacity-0"
        )}
      />
      <Icon
        className={cn(
          "size-[18px] transition-colors",
          active ? "text-accent" : "text-ink-faint group-hover:text-ink-muted"
        )}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {showBadge && (
        <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-semibold text-void">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
};

export const Sidebar = ({ open, onClose }) => {
  const pathname = usePathname();

  const isActive = (href) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* Scrim only exists on mobile, where the sidebar is a drawer. */}
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-void/70 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-base/95 backdrop-blur-xl",
          "transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2.5 px-5">
          <OrbitMark />
          <span className="text-[15px] font-semibold tracking-tight">Orbit</span>
          <button
            onClick={onClose}
            className="focus-ring ml-auto rounded-lg p-1.5 text-ink-faint hover:text-ink lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {NAV.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              active={isActive(item.href)}
              onNavigate={onClose}
            />
          ))}
        </nav>

        <div className="p-3">
          <div className="rounded-xl border border-line bg-void/50 p-3">
            <p className="text-[11px] font-medium text-ink">Privacy first</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
              Only devices you registered can report. Tracking can be switched
              off at any time.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
