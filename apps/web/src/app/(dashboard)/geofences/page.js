"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Hexagon, Trash2, Pencil, MapPin } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Switch,
  Badge,
} from "@/components/ui";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { OrbitMap } from "@/components/map/OrbitMap";
import { useDeviceStore } from "@/store/device.store";
import * as geofenceService from "@/services/geofence.service";
import { formatDistance } from "@/lib/format";
import { distanceMeters } from "@/lib/geo";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";

const PRESET_COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#fb7185"];

const emptyForm = {
  name: "",
  latitude: "",
  longitude: "",
  radius: 500,
  deviceIds: [],
  enterAlert: true,
  exitAlert: true,
  color: PRESET_COLORS[0],
};

export default function GeofencesPage() {
  const devices = useDeviceStore((state) => state.devices);

  const [geofences, setGeofences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [working, setWorking] = useState(false);

  // Re-read after a create, edit or delete.
  const load = useCallback(async () => {
    try {
      const data = await geofenceService.listGeofences();

      setGeofences(data.geofences);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await geofenceService.listGeofences();

        if (!cancelled) {
          setGeofences(data.geofences);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (geofence) => {
    setEditing(geofence);
    setFormOpen(true);
  };

  const toggleActive = async (geofence, active) => {
    setGeofences((current) =>
      current.map((entry) =>
        entry.id === geofence.id ? { ...entry, active } : entry
      )
    );

    try {
      await geofenceService.updateGeofence(geofence.id, { active });
    } catch (error) {
      toast.error(error.message);
      load();
    }
  };

  const remove = async () => {
    setWorking(true);

    try {
      await geofenceService.deleteGeofence(deleteTarget.id);
      setGeofences((current) =>
        current.filter((entry) => entry.id !== deleteTarget.id)
      );
      toast.success("Geofence deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Geofences"
        description="Circles on the map that tell you when a device arrives or leaves."
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> New geofence
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Map"
            subtitle={`${geofences.filter((fence) => fence.active).length} active`}
          />
          <div className="h-[26rem] border-t border-line">
            {geofences.length || devices.some((device) => device.lastLocation) ? (
              <OrbitMap
                devices={devices}
                geofences={geofences}
                className="size-full"
              />
            ) : (
              <EmptyState
                icon={Hexagon}
                title="Nothing drawn yet"
                description="Create a geofence and it appears here as a circle."
              />
            )}
          </div>
        </Card>

        <div className="space-y-3">
          {loading ? (
            [0, 1].map((index) => <Skeleton key={index} className="h-32" />)
          ) : geofences.length === 0 ? (
            <Card>
              <EmptyState
                icon={Hexagon}
                title="No geofences"
                description="Add one around home or work. Orbit alerts you on the crossing — not for every minute a device sits inside."
                action={
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="size-4" /> Create geofence
                  </Button>
                }
              />
            </Card>
          ) : (
            geofences.map((geofence) => (
              <GeofenceCard
                key={geofence.id}
                geofence={geofence}
                devices={devices}
                onEdit={() => openEdit(geofence)}
                onDelete={() => setDeleteTarget(geofence)}
                onToggle={(active) => toggleActive(geofence, active)}
              />
            ))
          )}
        </div>
      </div>

      {formOpen && (
        <GeofenceForm
          geofence={editing}
          devices={devices}
          onClose={() => setFormOpen(false)}
          onSaved={load}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        loading={working}
        title={`Delete ${deleteTarget?.name}?`}
        description="You will stop receiving arrival and departure alerts for this area."
        confirmLabel="Delete geofence"
      />
    </div>
  );
}

const GeofenceCard = ({ geofence, devices, onEdit, onDelete, onToggle }) => {
  // Which devices are inside right now, computed from their last known fix.
  const inside = useMemo(
    () =>
      devices.filter(
        (device) =>
          device.lastLocation &&
          (!geofence.deviceIds.length ||
            geofence.deviceIds.includes(device.id)) &&
          distanceMeters(device.lastLocation, geofence) <= geofence.radius
      ),
    [devices, geofence]
  );

  const scope = geofence.deviceIds.length
    ? `${geofence.deviceIds.length} device${geofence.deviceIds.length === 1 ? "" : "s"}`
    : "All devices";

  return (
    <Card className={cn("p-4", !geofence.active && "opacity-60")}>
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset"
          style={{
            color: geofence.color || "#a78bfa",
            backgroundColor: `${geofence.color || "#a78bfa"}1a`,
            borderColor: "transparent",
          }}
        >
          <Hexagon className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{geofence.name}</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            {formatDistance(geofence.radius)} radius · {scope}
          </p>
        </div>

        <Switch
          checked={geofence.active}
          onChange={onToggle}
          label={`${geofence.name} active`}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {geofence.enterAlert && <Badge tone="accent">Arrival alerts</Badge>}
        {geofence.exitAlert && <Badge tone="violet">Departure alerts</Badge>}
        {inside.length > 0 && (
          <Badge tone="positive">
            <MapPin className="size-3" />
            {inside.length} inside
          </Badge>
        )}
      </div>

      <div className="mt-3 flex gap-2 border-t border-line pt-3">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="size-3.5" /> Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-danger hover:bg-danger/10"
        >
          <Trash2 className="size-3.5" /> Delete
        </Button>
      </div>
    </Card>
  );
};

// Mounted only while open. Seeding the form in the initial state means a
// reopened dialog is a fresh mount rather than a stale one being reset.
const GeofenceForm = ({ geofence, devices, onClose, onSaved }) => {
  const [form, setForm] = useState(() =>
    geofence
      ? {
          name: geofence.name,
          latitude: String(geofence.latitude),
          longitude: String(geofence.longitude),
          radius: geofence.radius,
          deviceIds: geofence.deviceIds,
          enterAlert: geofence.enterAlert,
          exitAlert: geofence.exitAlert,
          color: geofence.color || PRESET_COLORS[0],
        }
      : emptyForm
  );
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: null }));
    setMessage(null);
  };

  // Typing coordinates is miserable; seeding from a device the user already has
  // is the common case for "home" or "office".
  const applyDeviceLocation = (deviceId) => {
    const device = devices.find((entry) => entry.id === deviceId);

    if (!device?.lastLocation) {
      return;
    }

    setForm((current) => ({
      ...current,
      latitude: String(device.lastLocation.latitude),
      longitude: String(device.lastLocation.longitude),
    }));
  };

  const useBrowserLocation = () => {
    if (!navigator.geolocation) {
      toast.error("This browser cannot report a location");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }));
        toast.success("Used your current location");
      },
      () => toast.error("Could not read your location")
    );
  };

  const toggleDevice = (deviceId) => {
    setForm((current) => ({
      ...current,
      deviceIds: current.deviceIds.includes(deviceId)
        ? current.deviceIds.filter((id) => id !== deviceId)
        : [...current.deviceIds, deviceId],
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setMessage(null);

    const payload = {
      name: form.name,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      radius: Number(form.radius),
      deviceIds: form.deviceIds,
      enterAlert: form.enterAlert,
      exitAlert: form.exitAlert,
      color: form.color,
    };

    try {
      if (geofence) {
        await geofenceService.updateGeofence(geofence.id, payload);
        toast.success("Geofence updated");
      } else {
        await geofenceService.createGeofence(payload);
        toast.success("Geofence created");
      }

      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.errors?.length) {
        setErrors(
          Object.fromEntries(
            error.errors.map((issue) => [issue.field, issue.message])
          )
        );
      }

      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const positioned = devices.filter((device) => device.lastLocation);

  return (
    <Modal
      open
      onClose={onClose}
      title={geofence ? "Edit geofence" : "New geofence"}
      description="Alerts fire when a device crosses the boundary, not while it stays put."
      size="lg"
    >
      <form onSubmit={save} className="space-y-4">
        <Field label="Name" error={errors.name}>
          <Input
            placeholder="Home"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            required
            autoFocus
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Latitude" error={errors.latitude}>
            <Input
              type="number"
              step="any"
              placeholder="28.613900"
              value={form.latitude}
              onChange={(event) => update("latitude", event.target.value)}
              className="font-mono text-xs"
              required
            />
          </Field>
          <Field label="Longitude" error={errors.longitude}>
            <Input
              type="number"
              step="any"
              placeholder="77.209000"
              value={form.longitude}
              onChange={(event) => update("longitude", event.target.value)}
              className="font-mono text-xs"
              required
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={useBrowserLocation}>
            <MapPin className="size-3.5" /> Use my location
          </Button>
          {positioned.length > 0 && (
            <Select
              value=""
              onChange={(event) => applyDeviceLocation(event.target.value)}
              className="h-8 w-auto min-w-44 text-xs"
            >
              <option value="">Use a device&apos;s position…</option>
              {positioned.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </Select>
          )}
        </div>

        <Field
          label={`Radius — ${formatDistance(Number(form.radius))}`}
          error={errors.radius}
        >
          <input
            type="range"
            min={50}
            max={5000}
            step={50}
            value={form.radius}
            onChange={(event) => update("radius", event.target.value)}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-accent"
          />
        </Field>

        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-muted">Colour</p>
          <div className="flex gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => update("color", color)}
                aria-label={`Colour ${color}`}
                style={{ backgroundColor: color }}
                className={cn(
                  "focus-ring size-7 rounded-lg transition-transform",
                  form.color === color
                    ? "scale-110 ring-2 ring-white/70 ring-offset-2 ring-offset-raised"
                    : "opacity-70 hover:opacity-100"
                )}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-muted">
            Devices{" "}
            <span className="text-ink-faint">
              {form.deviceIds.length === 0 ? "(all devices)" : ""}
            </span>
          </p>
          {devices.length === 0 ? (
            <p className="text-[11px] text-ink-faint">
              No devices registered yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {devices.map((device) => {
                const selected = form.deviceIds.includes(device.id);

                return (
                  <button
                    key={device.id}
                    type="button"
                    onClick={() => toggleDevice(device.id)}
                    className={cn(
                      "focus-ring rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                      selected
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
                    )}
                  >
                    {device.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-xl border border-line bg-void/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink">Alert on arrival</span>
            <Switch
              checked={form.enterAlert}
              onChange={(value) => update("enterAlert", value)}
              label="Alert on arrival"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink">Alert on departure</span>
            <Switch
              checked={form.exitAlert}
              onChange={(value) => update("exitAlert", value)}
              label="Alert on departure"
            />
          </div>
        </div>

        {message && (
          <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
            {message}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={saving}>
            {geofence ? "Save changes" : "Create geofence"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
