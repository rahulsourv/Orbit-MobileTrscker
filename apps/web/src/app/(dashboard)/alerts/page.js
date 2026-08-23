"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Check, Trash2, X, UserPlus } from "lucide-react";

import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Skeleton,
  Badge,
} from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useNotificationStore } from "@/store/notification.store";
import { useDeviceStore } from "@/store/device.store";
import { useConnectionStore } from "@/store/connection.store";
import * as connectionService from "@/services/connection.service";
import { toast } from "sonner";
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
  const incoming = useConnectionStore((state) => state.incoming);
  const refreshConnections = useConnectionStore((state) => state.fetchAll);

  // Requests someone has sent about *your* location need a decision, so they
  // belong wherever you go to see what needs your attention - which is here,
  // not buried a tab away.
  const pending = incoming.filter((entry) => entry.status === "pending");

  const [filter, setFilter] = useState("all");
  const [answering, setAnswering] = useState(null);
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

      {pending.length > 0 && (
        <Card className="mb-4 border-accent/30">
          <CardHeader
            title={`${pending.length} person${pending.length === 1 ? "" : "s"} asking to see your location`}
            subtitle="Nothing is shared unless you accept."
          />
          <div className="border-t border-line">
            {pending.map((request) => (
              <div
                key={request.id}
                className="flex flex-wrap items-center gap-3 border-b border-line/60 px-5 py-4 last:border-0"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/20">
                  <UserPlus className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {request.requesterName}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {request.requesterEmail}
                  </p>
                  {request.message && (
                    <p className="mt-1 text-xs italic text-ink-faint">
                      “{request.message}”
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    loading={answering === request.id}
                    onClick={async () => {
                      setAnswering(request.id);

                      try {
                        // An empty list means every device, which is the sensible
                        // default when answering from a notification. The scope
                        // can be narrowed afterwards on the People page.
                        await connectionService.acceptRequest(request.id, []);
                        toast.success("Sharing started. You can stop any time.");
                        refreshConnections();
                      } catch (error) {
                        toast.error(error.message);
                      } finally {
                        setAnswering(null);
                      }
                    }}
                  >
                    <Check className="size-3.5" /> Accept
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={answering === request.id}
                    onClick={async () => {
                      try {
                        await connectionService.denyRequest(request.id);
                        toast.success("Declined. Nothing was shared.");
                        refreshConnections();
                      } catch (error) {
                        toast.error(error.message);
                      }
                    }}
                  >
                    <X className="size-3.5" /> Deny
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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
