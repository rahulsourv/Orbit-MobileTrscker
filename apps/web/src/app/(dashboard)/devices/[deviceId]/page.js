"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trash2,
  KeyRound,
  Share2,
  Gauge,
  Compass,
  Mountain,
  Crosshair,
  Clock,
  RefreshCw,
  History as HistoryIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  Switch,
  Badge,
} from "@/components/ui";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { TokenReveal } from "@/components/devices/AddDeviceModal";
import { BatteryPill } from "@/components/devices/DeviceCard";
import { OrbitMap } from "@/components/map/OrbitMap";
import { ShareDeviceModal } from "@/components/devices/ShareDeviceModal";
import * as deviceService from "@/services/device.service";
import * as locationService from "@/services/location.service";
import { useDeviceStore } from "@/store/device.store";
import { DEVICE_TYPES, deviceTypeLabel, platformLabel } from "@/lib/constants";
import { DeviceGlyph } from "@/components/devices/DeviceGlyph";
import {
  relativeTime,
  absoluteTime,
  formatAccuracy,
  formatSpeed,
  formatCoordinatePair,
} from "@/lib/format";
import { cn } from "@/lib/cn";

const Metric = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-2.5 rounded-xl border border-line bg-void/40 px-3 py-2.5">
    <Icon className="size-4 shrink-0 text-ink-faint" />
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="truncate text-xs font-medium text-ink">{value}</p>
    </div>
  </div>
);

export default function DeviceDetailPage() {
  const { deviceId } = useParams();
  const router = useRouter();

  const device = useDeviceStore((state) =>
    state.devices.find((entry) => entry.id === deviceId)
  );
  const devicesLoading = useDeviceStore((state) => state.loading);
  const patchDevice = useDeviceStore((state) => state.patchDevice);
  const removeDevice = useDeviceStore((state) => state.removeDevice);
  const upsertDevice = useDeviceStore((state) => state.upsertDevice);

  const [latest, setLatest] = useState(null);
  const [trail, setTrail] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotatedToken, setRotatedToken] = useState(null);
  const [working, setWorking] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Bumping this re-runs the load effect, so the button and the initial fetch
  // share one code path rather than drifting apart.
  const [reloadToken, setReloadToken] = useState(0);

  // The store may not hold this device on a hard load straight to the URL.
  useEffect(() => {
    if (device || devicesLoading) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        const data = await deviceService.getDevice(deviceId);

        if (!cancelled) {
          upsertDevice(data.device);
        }
      } catch {
        if (!cancelled) {
          setNotFound(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [device, devicesLoading, deviceId, upsertDevice]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [latestData, history] = await Promise.all([
          locationService.getLatestLocation(deviceId),
          locationService.getHistory(deviceId, { limit: 200 }),
        ]);

        if (cancelled) {
          return;
        }

        setLatest(latestData.location);
        // History comes newest-first; a path has to be drawn oldest-first.
        setTrail([...history.locations].reverse());
      } catch {
        // A device that has never reported simply has nothing to draw.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deviceId, reloadToken]);

  /**
   * Pull this device's newest position and path.
   *
   * Also re-reads the device itself, because the parts most worth refreshing -
   * online state, battery, last seen - live on the device record rather than on
   * the location.
   */
  const refreshDevice = async () => {
    setRefreshing(true);

    try {
      const data = await deviceService.getDevice(deviceId);

      upsertDevice(data.device);
      setReloadToken((value) => value + 1);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleTracking = async (enabled) => {
    patchDevice(deviceId, { trackingEnabled: enabled });

    try {
      await deviceService.setTracking(deviceId, enabled);
      toast.success(enabled ? "Tracking enabled" : "Tracking disabled");
    } catch (error) {
      patchDevice(deviceId, { trackingEnabled: !enabled });
      toast.error(error.message);
    }
  };

  const rotateToken = async () => {
    setWorking(true);

    try {
      const data = await deviceService.rotateDeviceToken(deviceId);

      setRotatedToken(data.deviceToken);
      setRotateOpen(false);
      toast.success("New token issued — the old one no longer works");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setWorking(false);
    }
  };

  const deleteDevice = async () => {
    setWorking(true);

    try {
      await deviceService.deleteDevice(deviceId);
      removeDevice(deviceId);
      toast.success("Device deleted along with its history");
      router.replace("/devices");
    } catch (error) {
      toast.error(error.message);
      setWorking(false);
    }
  };

  if (notFound) {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          title="Device not found"
          description="It may have been deleted, or it belongs to another account."
          action={
            <Link href="/devices">
              <Button variant="secondary">Back to devices</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  if (!device) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[26rem]" />
      </div>
    );
  }

  const location = device.lastLocation;

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href="/devices"
        className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded text-xs text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Devices
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span
            className={cn(
              "grid size-12 place-items-center rounded-2xl ring-1 ring-inset",
              device.isOnline
                ? "bg-accent/10 text-accent ring-accent/20"
                : "bg-white/5 text-ink-faint ring-white/10"
            )}
          >
            <DeviceGlyph type={device.type} className="size-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {device.name}
              </h1>
              <Badge tone={device.isOnline ? "positive" : "muted"}>
                {device.isOnline ? "Online" : "Offline"}
              </Badge>
              {!device.trackingEnabled && (
                <Badge tone="warning">Tracking off</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {deviceTypeLabel(device.type)} · {platformLabel(device.platform)}
              {device.model ? ` · ${device.model}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={refreshDevice}
            loading={refreshing}
            title="Fetch this device's latest position"
          >
            {!refreshing && <RefreshCw className="size-3.5" />}
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="size-3.5" /> Share
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-3.5" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader
            title="Position"
            subtitle={
              location
                ? `Last fix ${relativeTime(location.timestamp)}`
                : "This device has not reported a position yet"
            }
            action={
              trail.length > 1 && (
                <Link href={`/history?device=${device.id}`}>
                  <Button variant="ghost" size="sm">
                    <HistoryIcon className="size-3.5" /> History
                  </Button>
                </Link>
              )
            }
          />
          <div className="h-[24rem] border-t border-line">
            {location ? (
              <OrbitMap
                devices={[device]}
                trail={trail}
                focusedDeviceId={device.id}
                className="size-full"
              />
            ) : (
              <EmptyState
                icon={Crosshair}
                title="Waiting for a first fix"
                description="Once the device client reports its position with its token, it appears here."
              />
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Status" />
            <div className="space-y-3 border-t border-line p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-muted">Battery</span>
                <BatteryPill level={device.batteryLevel} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-muted">Last seen</span>
                <span className="text-xs text-ink">
                  {device.isOnline ? "Just now" : relativeTime(device.lastSeen)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-muted">Registered</span>
                <span className="text-xs text-ink">
                  {absoluteTime(device.createdAt)}
                </span>
              </div>

              <div className="rule my-1" />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-ink">Location tracking</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
                    When off, Orbit refuses this device&apos;s reports at the
                    server — not just in the app.
                  </p>
                </div>
                <Switch
                  checked={device.trackingEnabled}
                  onChange={toggleTracking}
                  label="Location tracking"
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Latest reading" />
            <div className="grid grid-cols-2 gap-2 border-t border-line p-4">
              <Metric
                icon={Crosshair}
                label="Accuracy"
                value={formatAccuracy(latest?.accuracy ?? location?.accuracy)}
              />
              <Metric icon={Gauge} label="Speed" value={formatSpeed(latest?.speed)} />
              <Metric
                icon={Compass}
                label="Heading"
                value={
                  latest?.heading !== null && latest?.heading !== undefined
                    ? `${Math.round(latest.heading)}°`
                    : "-"
                }
              />
              <Metric
                icon={Mountain}
                label="Altitude"
                value={
                  latest?.altitude !== null && latest?.altitude !== undefined
                    ? `${Math.round(latest.altitude)} m`
                    : "-"
                }
              />
              <div className="col-span-2">
                <Metric
                  icon={Clock}
                  label="Coordinates"
                  value={
                    location
                      ? formatCoordinatePair(location.latitude, location.longitude)
                      : "-"
                  }
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Device token"
              subtitle="Rotate if the device was lost or reinstalled"
            />
            <div className="border-t border-line p-4">
              <p className="text-[11px] leading-relaxed text-ink-faint">
                Orbit stores only a hash of this device&apos;s token, so it
                cannot be shown again. Rotating issues a new one and stops the
                old one working immediately.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => setRotateOpen(true)}
              >
                <KeyRound className="size-3.5" /> Rotate token
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {editOpen && (
        <EditDeviceModal device={device} onClose={() => setEditOpen(false)} />
      )}

      {shareOpen && (
        <ShareDeviceModal device={device} onClose={() => setShareOpen(false)} />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteDevice}
        loading={working}
        title={`Delete ${device.name}?`}
        description="Its entire location history and any share links pointing at it are deleted too."
        confirmLabel="Delete device"
      />

      <ConfirmDialog
        open={rotateOpen}
        onClose={() => setRotateOpen(false)}
        onConfirm={rotateToken}
        loading={working}
        tone="primary"
        title="Rotate device token?"
        description="The device will stop reporting until you give it the new token."
        confirmLabel="Rotate token"
      />

      <Modal
        open={Boolean(rotatedToken)}
        onClose={() => {}}
        title="Save the new device token"
      >
        {rotatedToken && (
          <TokenReveal token={rotatedToken} onDone={() => setRotatedToken(null)} />
        )}
      </Modal>
    </div>
  );
}

// Mounted only while open, so the form seeds itself from the device once and
// never needs an effect to re-sync when it is reopened.
const EditDeviceModal = ({ device, onClose }) => {
  const patchDevice = useDeviceStore((state) => state.patchDevice);

  const [form, setForm] = useState({
    name: device.name,
    type: device.type,
    model: device.model || "",
  });
  const [saving, setSaving] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const data = await deviceService.updateDevice(device.id, {
        name: form.name,
        type: form.type,
        model: form.model.trim() || null,
      });

      patchDevice(device.id, data.device);
      toast.success("Device updated");
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit device">
      <form onSubmit={save} className="space-y-4">
        <Field label="Device name">
          <Input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            required
          />
        </Field>

        <Field label="Type">
          <Select
            value={form.type}
            onChange={(event) =>
              setForm((current) => ({ ...current, type: event.target.value }))
            }
          >
            {DEVICE_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Model" hint="Optional">
          <Input
            value={form.model}
            onChange={(event) =>
              setForm((current) => ({ ...current, model: event.target.value }))
            }
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={saving}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
