"use client";

import { useState } from "react";
import Link from "next/link";
import { Shield, ChevronRight, Smartphone, KeyRound, Check } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardHeader,
  PageHeader,
  Badge,
  Button,
  Field,
  Input,
} from "@/components/ui";
import { useAuthStore } from "@/store/auth.store";
import { useDeviceStore } from "@/store/device.store";
import { absoluteTime, initialsOf } from "@/lib/format";

const ProfileCard = ({ user }) => {
  const updateProfile = useAuthStore((state) => state.updateProfile);

  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);

  const dirty = name.trim() !== (user?.name || "") && name.trim().length >= 2;

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      await updateProfile(name.trim());
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader title="Your details" subtitle="How you appear in Orbit" />
      <form onSubmit={save} className="space-y-4 border-t border-line p-5">
        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>

        <Field
          label="Email"
          hint="Changing your email is not supported yet."
        >
          {/* Disabled rather than hidden: seeing which address the account uses
              is half the reason to open this page. */}
          <Input value={user?.email || ""} disabled readOnly />
        </Field>

        <Button type="submit" size="sm" loading={saving} disabled={!dirty}>
          <Check className="size-3.5" /> Save changes
        </Button>
      </form>
    </Card>
  );
};

const PasswordCard = () => {
  const changePassword = useAuthStore((state) => state.changePassword);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState(null);

  const mismatch = confirm.length > 0 && next !== confirm;
  const ready = current && next.length >= 8 && next === confirm;

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setProblem(null);

    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed. Every other session was signed out.");
    } catch (error) {
      setProblem(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader
        title="Password"
        subtitle="Changing it signs out every other session"
      />
      <form onSubmit={save} className="space-y-4 border-t border-line p-5">
        <Field label="Current password">
          <Input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </Field>

        <Field label="New password" hint="At least 8 characters.">
          <Input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
        </Field>

        <Field
          label="Confirm new password"
          error={mismatch ? "These do not match" : null}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            invalid={mismatch}
          />
        </Field>

        {problem && (
          <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
            {problem}
          </p>
        )}

        <p className="text-[11px] leading-relaxed text-ink-faint">
          Your current password is required even though you are signed in — it
          is what stops someone using an unlocked device to take the account.
        </p>

        <Button type="submit" size="sm" loading={saving} disabled={!ready}>
          <KeyRound className="size-3.5" /> Change password
        </Button>
      </form>
    </Card>
  );
};

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

        <ProfileCard user={user} />

        <PasswordCard />

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
