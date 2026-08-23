"use client";

import Link from "next/link";
import { Shield, ChevronRight, Smartphone, Trash2 } from "lucide-react";

import { Card, CardHeader, PageHeader, Badge, Button } from "@/components/ui";
import { useAuthStore } from "@/store/auth.store";
import { useDeviceStore } from "@/store/device.store";
import { absoluteTime, initialsOf } from "@/lib/format";

const Row = ({ label, value, mono }) => (
  <div className="flex items-center justify-between gap-4 py-2.5">
    <span className="text-xs text-ink-muted">{label}</span>
    <span className={`text-xs text-ink ${mono ? "font-mono" : ""}`}>{value}</span>
  </div>
);

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const devices = useDeviceStore((state) => state.devices);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Your account and how Orbit uses it." />

      <div className="space-y-4">
        <Card>
          <CardHeader title="Account" />
          <div className="border-t border-line p-5">
            <div className="flex items-center gap-4">
              <span className="grid size-14 place-items-center rounded-2xl bg-accent/15 text-lg font-semibold text-accent ring-1 ring-accent/25">
                {initialsOf(user?.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{user?.name}</p>
                <p className="truncate text-xs text-ink-muted">{user?.email}</p>
              </div>
              {user?.emailVerified ? (
                <Badge tone="positive" className="ml-auto">Verified</Badge>
              ) : (
                <Badge tone="muted" className="ml-auto">Unverified</Badge>
              )}
            </div>

            <div className="mt-4 divide-y divide-line border-t border-line pt-1">
              <Row label="Joined" value={absoluteTime(user?.createdAt)} />
              <Row label="Devices registered" value={devices.length} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Privacy" subtitle="How Orbit handles your data" />
          <div className="space-y-3 border-t border-line p-5 text-xs leading-relaxed text-ink-muted">
            <p>
              A device can only report a position after you register it and give
              it a token. Turning tracking off refuses its reports at the server
              — the device cannot override that.
            </p>
            <p>
              Location history is deleted automatically after 90 days. Deleting a
              device removes its history and any share links immediately.
            </p>
            <p>
              Share links show one device&apos;s current position, expire on a
              timer, and can be revoked at any time. They never expose your name,
              email or other devices.
            </p>
          </div>
        </Card>

        <Link href="/settings/security" className="focus-ring block rounded-card">
          <Card hover className="flex items-center gap-4 p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-violet/10 text-violet ring-1 ring-inset ring-violet/20">
              <Shield className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">Security</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Active sessions and signing out everywhere
              </p>
            </div>
            <ChevronRight className="size-4 text-ink-faint" />
          </Card>
        </Link>

        <Card>
          <CardHeader title="Devices" subtitle="Manage what reports to Orbit" />
          <div className="border-t border-line p-5">
            {devices.length === 0 ? (
              <p className="text-xs text-ink-faint">No devices registered yet.</p>
            ) : (
              <ul className="space-y-2">
                {devices.map((device) => (
                  <li key={device.id}>
                    <Link
                      href={`/devices/${device.id}`}
                      className="focus-ring flex items-center gap-3 rounded-xl border border-line bg-void/40 px-3 py-2.5 transition-colors hover:border-line-strong"
                    >
                      <Smartphone className="size-4 shrink-0 text-ink-faint" />
                      <span className="min-w-0 flex-1 truncate text-xs text-ink">
                        {device.name}
                      </span>
                      {!device.trackingEnabled && (
                        <Badge tone="warning">Tracking off</Badge>
                      )}
                      <ChevronRight className="size-3.5 shrink-0 text-ink-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <Link href="/devices">
              <Button variant="secondary" size="sm" className="mt-4 w-full">
                Manage devices
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
