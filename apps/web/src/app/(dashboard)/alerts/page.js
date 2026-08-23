"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Check, Trash2, X } from "lucide-react";

import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  Badge,
} from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useNotificationStore } from "@/store/notification.store";
import { useDeviceStore } from "@/store/device.store";
import { notificationMeta, TONE_CLASS, NOTIFICATION_META } from "@/lib/constants";
import { relativeTime, absoluteTime, dayLabel } from "@/lib/format";
import { cn } from "@/lib/cn";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  ...Object.entries(NOTIFICATION_META).map(([type, meta]) => ({
    value: type,
    label: meta.label,
  })),
];

export default function AlertsPage() {
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const loading = useNotificationStore((state) => state.loading);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const remove = useNotificationStore((state) => state.remove);
  const clearAll = useNotificationStore((state) => state.clearAll);
  const devices = useDeviceStore((state) => state.devices);

  const [filter, setFilter] = useState("all");
  const [clearOpen, setClearOpen] = useState(false);

  const visible = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((entry) => !entry.read);

    return notifications.filter((entry) => entry.type === filter);
  }, [notifications, filter]);

  // Grouped by day, so a busy account reads as a log rather than a wall.
  const grouped = useMemo(() => {
    const groups = new Map();

    visible.forEach((notification) => {
      const key = dayLabel(notification.createdAt);

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(notification);
    });

    return [...groups.entries()];
  }, [visible]);

  const deviceName = (deviceId) =>
    devices.find((device) => device.id === deviceId)?.name;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Alerts"
        description={
          unreadCount > 0
            ? `${unreadCount} unread`
            : "Everything Orbit has told you about."
        }
        action={
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="secondary" size="sm" onClick={markAllAsRead}>
                <Check className="size-3.5" /> Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setClearOpen(true)}
              >
                <Trash2 className="size-3.5" /> Clear
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-line bg-void/40 p-1">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={cn(
              "focus-ring rounded-md px-2.5 py-1.5 text-xs transition-colors",
              filter === option.value
                ? "bg-white/[0.08] text-ink"
                : "text-ink-muted hover:text-ink"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bell}
            title={
              notifications.length === 0 ? "No alerts yet" : "Nothing in this filter"
            }
            description={
              notifications.length === 0
                ? "Battery warnings, geofence crossings, devices going offline and new sign-ins all land here."
                : "Try a different filter."
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                {day}
              </p>
              <div className="space-y-2">
                {items.map((notification) => {
                  const meta = notificationMeta(notification.type);
                  const Icon = meta.icon;
                  const name = deviceName(notification.deviceId);

                  return (
                    <Card
                      key={notification.id}
                      className={cn(
                        "group flex items-start gap-3 p-4 transition-colors",
                        !notification.read && "border-accent/20 bg-accent/[0.03]"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset",
                          TONE_CLASS[meta.tone]
                        )}
                      >
                        <Icon className="size-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-ink">
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="size-1.5 rounded-full bg-accent" />
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                          {notification.message}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span
                            className="text-[11px] text-ink-faint"
                            title={absoluteTime(notification.createdAt)}
                          >
                            {relativeTime(notification.createdAt)}
                          </span>
                          {name && notification.deviceId && (
                            <Link href={`/devices/${notification.deviceId}`}>
                              <Badge tone="muted">{name}</Badge>
                            </Link>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            aria-label="Mark as read"
                            className="focus-ring rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-white/5 hover:text-positive"
                          >
                            <Check className="size-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => remove(notification.id)}
                          aria-label="Delete alert"
                          className="focus-ring rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-white/5 hover:text-danger"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={() => {
          clearAll();
          setClearOpen(false);
        }}
        title="Clear all alerts?"
        description="Every alert is removed from your account. New ones will still arrive."
        confirmLabel="Clear all"
      />
    </div>
  );
}
