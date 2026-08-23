"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Laptop,
  Radio,
  ShieldCheck,
  TriangleAlert,
  Navigation,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Switch,
} from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useThisDeviceStore } from "@/store/thisDevice.store";
import { isComputerLike } from "@/lib/deviceClient";
import { useDeviceStore } from "@/store/device.store";
import { relativeTime, formatAccuracy, formatCoordinatePair } from "@/lib/format";
import { cn } from "@/lib/cn";

const INTERVALS = [
  { value: 30, label: "30s" },
  { value: 60, label: "1 min" },
  { value: 300, label: "5 min" },
  { value: 900, label: "15 min" },
];

export default function ThisComputerPage() {
  const {
    status,
    registered,
    deviceId,
    tracking,
    trackingEnabled,
    lastFix,
    lastReportedAt,
    queued,
    error,
    intervalSeconds,
    supported,
    register,
    start,
    stop,
    reportOnce,
    setInterval: setReportInterval,
    forget,
    clearError,
  } = useThisDeviceStore();

  const fetchDevices = useDeviceStore((state) => state.fetchDevices);
  const devices = useDeviceStore((state) => state.devices);

  // Computers already on the account, minus whichever one this browser is.
  const reconnectable = devices.filter(
    (device) => isComputerLike(device) && device.id !== deviceId
  );

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgetOpen, setForgetOpen] = useState(false);

  const addThisComputer = async (options) => {
    setBusy(true);

    try {
      const { device, reclaimed } = await register(name, options);

      toast.success(
        reclaimed
          ? `Reconnected ${device.name} — its history was kept`
          : `${device.name} added to your account`
      );
      fetchDevices();
      await start();
    } catch {
      // The store already surfaced the reason.
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (next) => {
    setBusy(true);

    // Without the finally, anything thrown in start() leaves busy stuck true
    // and the switch permanently disabled - unrecoverable without a reload.
    try {
      if (next) {
        const started = await start();

        if (started) {
          toast.success("This computer is now sharing its location");
        }
      } else {
        stop();
        toast.success("Stopped sharing this computer's location");
      }
    } catch (error) {
      toast.error(error.message || "Could not change tracking");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="This computer"
        description="Put the machine you're sitting at on the map, so your phone can find it too."
      />

      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/[0.07] px-4 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="flex-1 text-xs leading-relaxed text-danger">{error}</p>
          <button
            onClick={clearError}
            className="focus-ring rounded text-xs text-ink-faint hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}

      {!supported && (
        <Card className="mb-4 border-warning/25 p-4">
          <p className="text-xs text-warning">
            This browser cannot report a location, so it can&apos;t be tracked.
          </p>
        </Card>
      )}

      {status === "unknown" ? (
        <Card className="h-40 animate-pulse" />
      ) : !registered ? (
        <Card>
          <CardHeader
            title="Add this computer"
            subtitle="It becomes a device on your account, exactly like a phone."
          />
          <div className="space-y-4 border-t border-line p-5">
            <Field
              label="Name"
              hint="What you'll see on the map. Leave blank and Orbit names it for you; you can rename it later."
            >
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="My laptop"
              />
            </Field>

            <div className="flex gap-3 rounded-xl border border-line bg-void/40 p-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-positive" />
              <p className="text-[11px] leading-relaxed text-ink-muted">
                Your browser will ask permission before sharing a location, and
                nothing is reported until you switch tracking on. Everything on
                your account already sees everything else — no requests, no
                approvals.
              </p>
            </div>

            <Button
              onClick={() => addThisComputer()}
              loading={busy}
              disabled={!supported}
              className="w-full"
            >
              <Laptop className="size-4" /> Add this computer
            </Button>
          </div>

          {/* A browser has no hardware identity, so clearing site data loses the
              one it had. Rather than silently creating a duplicate, the machines
              already on the account are offered back. */}
          {reconnectable.length > 0 && (
            <div className="border-t border-line p-5">
              <p className="text-xs font-medium text-ink-muted">
                Already added this computer before?
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
                Reconnect it instead of adding a second one. Its history and
                everything shared about it are kept.
              </p>

              <div className="mt-3 space-y-2">
                {reconnectable.map((device) => (
                  <button
                    key={device.id}
                    onClick={() =>
                      addThisComputer({ identifier: device.deviceIdentifier })
                    }
                    disabled={busy}
                    className={cn(
                      "focus-ring flex w-full items-center gap-3 rounded-xl border border-line",
                      "bg-void/40 px-3 py-2.5 text-left transition-colors",
                      "hover:border-line-strong disabled:opacity-50"
                    )}
                  >
                    <Laptop className="size-4 shrink-0 text-ink-faint" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-ink">
                        {device.name}
                      </span>
                      <span className="block text-[11px] text-ink-faint">
                        Last seen {relativeTime(device.lastSeen)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-accent">
                      Reconnect
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Whether this machine is reporting right now must be unmissable —
              the same rule the phone app follows. */}
          <Card className={cn(tracking && "border-positive/40")}>
            <div className="flex items-center gap-3 p-5">
              <span className="relative flex size-3">
                {tracking && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-positive opacity-60" />
                )}
                <span
                  className={cn(
                    "relative inline-flex size-3 rounded-full",
                    tracking ? "bg-positive" : "bg-ink-faint"
                  )}
                />
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    tracking ? "text-positive" : "text-ink-muted"
                  )}
                >
                  {tracking ? "Sharing location" : "Not sharing"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  {!trackingEnabled
                    ? "Tracking is switched off for this computer in your account. Turn it back on from Devices."
                    : tracking
                      ? `Reporting every ${intervalSeconds >= 60 ? `${intervalSeconds / 60} min` : `${intervalSeconds}s`} while this tab is open.`
                      : "Turn this on to put this computer on your map."}
                </p>
              </div>

              <Switch
                checked={tracking}
                onChange={toggle}
                disabled={busy || !trackingEnabled}
                label="Share this computer's location"
              />
            </div>

            {/* A browser tab is not a background service, and pretending
                otherwise would be the one dishonest thing here. */}
            {tracking && (
              <p className="border-t border-line px-5 py-3 text-[11px] text-ink-faint">
                Reporting stops if you close this tab or your computer sleeps —
                a browser can&apos;t run in the background the way a phone app can.
              </p>
            )}
          </Card>

          <Card>
            <CardHeader title="Status" />
            <div className="divide-y divide-line border-t border-line px-5">
              <Row label="Last report" value={relativeTime(lastReportedAt)} />
              <Row
                label="Waiting to upload"
                value={queued === 0 ? "Nothing" : `${queued} position${queued === 1 ? "" : "s"}`}
              />
              {lastFix && (
                <>
                  <Row
                    label="Position"
                    value={formatCoordinatePair(lastFix.latitude, lastFix.longitude)}
                    mono
                  />
                  <Row label="Accuracy" value={formatAccuracy(lastFix.accuracy)} />
                </>
              )}
            </div>

            <div className="border-t border-line p-5">
              <p className="mb-2 text-xs font-medium text-ink-muted">
                Report every
              </p>
              <div className="flex flex-wrap gap-1.5">
                {INTERVALS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setReportInterval(option.value)}
                    className={cn(
                      "focus-ring rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                      intervalSeconds === option.value
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <Button
                variant="secondary"
                size="sm"
                className="mt-4 w-full"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  const result = await reportOnce();
                  setBusy(false);

                  if (result?.status === "sent") toast.success("Position sent");
                  else if (result?.status === "queued")
                    toast.warning("No connection — saved to upload later");
                }}
              >
                <Navigation className="size-3.5" /> Send one position now
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Accuracy on a computer"
              subtitle="Why this pin is less precise than a phone's"
            />
            <div className="border-t border-line p-5">
              <p className="text-[11px] leading-relaxed text-ink-muted">
                A laptop has no GPS. The browser works out where it is from
                nearby Wi-Fi networks and your IP address, which is usually
                accurate to somewhere between a few dozen metres and a few
                hundred. Good enough to find the building; not the room.
              </p>
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Link href="/devices">
              <Button variant="secondary" size="sm">
                Manage in Devices
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setForgetOpen(true)}
              className="text-danger hover:bg-danger/10"
            >
              Stop using this browser as a device
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={forgetOpen}
        onClose={() => setForgetOpen(false)}
        onConfirm={() => {
          forget();
          setForgetOpen(false);
          toast.success("This browser will no longer report");
        }}
        title="Stop using this browser as a device?"
        description="It stops reporting and forgets its token here. The device stays on your account until you delete it from Devices."
        confirmLabel="Stop"
      />
    </div>
  );
}

const Row = ({ label, value, mono }) => (
  <div className="flex items-center justify-between gap-4 py-2.5">
    <span className="flex items-center gap-1.5 text-xs text-ink-muted">
      <Clock className="size-3 text-ink-faint" />
      {label}
    </span>
    <span className={cn("text-xs text-ink", mono && "font-mono")}>{value}</span>
  </div>
);
