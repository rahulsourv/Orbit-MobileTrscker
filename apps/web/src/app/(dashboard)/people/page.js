"use client";

import { useState } from "react";
import {
  UserPlus,
  Users,
  Check,
  X,
  Copy,
  Link2,
  ShieldCheck,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Skeleton,
} from "@/components/ui";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { useConnectionStore } from "@/store/connection.store";
import { useDeviceStore } from "@/store/device.store";
import * as connectionService from "@/services/connection.service";
import { relativeTime, absoluteTime } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";

const STATUS_TONE = {
  pending: "warning",
  accepted: "positive",
  denied: "muted",
  revoked: "muted",
  expired: "muted",
};

export default function PeoplePage() {
  const incoming = useConnectionStore((state) => state.incoming);
  const outgoing = useConnectionStore((state) => state.outgoing);
  const sharedDevices = useConnectionStore((state) => state.sharedDevices);
  const loading = useConnectionStore((state) => state.loading);
  const refresh = useConnectionStore((state) => state.fetchAll);

  const [askOpen, setAskOpen] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [working, setWorking] = useState(false);

  const pending = incoming.filter((entry) => entry.status === "pending");
  const activeIncoming = incoming.filter((entry) => entry.status === "accepted");
  const activeOutgoing = outgoing.filter((entry) => entry.status === "accepted");

  const deny = async (connection) => {
    try {
      await connectionService.denyRequest(connection.id);
      toast.success("Request declined. Nothing was shared.");
      refresh();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const revoke = async () => {
    setWorking(true);

    try {
      await connectionService.revokeConnection(revokeTarget.id);
      toast.success("Sharing stopped");
      setRevokeTarget(null);
      refresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="People"
        description="Location sharing between accounts — always by invitation, never by default."
        action={
          <Button onClick={() => setAskOpen(true)}>
            <UserPlus className="size-4" /> Ask someone
          </Button>
        }
      />

      {/* Requests waiting on this user come first: they are the only thing on
          this page that needs a decision. */}
      {pending.length > 0 && (
        <Card className="mb-4 border-accent/25">
          <CardHeader
            title={`${pending.length} request${pending.length === 1 ? "" : "s"} waiting for you`}
            subtitle="Nothing is shared unless you accept."
          />
          <div className="border-t border-line">
            {pending.map((request) => (
              <div
                key={request.id}
                className="flex flex-wrap items-center gap-3 border-b border-line/60 px-5 py-4 last:border-0"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/20">
                  <Users className="size-4" />
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
                  <p className="mt-1 text-[11px] text-ink-faint">
                    Asked {relativeTime(request.createdAt)}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setAcceptTarget(request)}>
                    <Check className="size-3.5" /> Accept
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deny(request)}>
                    <X className="size-3.5" /> Deny
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader
            title="You are sharing with"
            subtitle={
              activeIncoming.length
                ? "They can see the devices you chose."
                : "Nobody can see your location."
            }
          />
          <div className="border-t border-line">
            {loading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-12" />
              </div>
            ) : activeIncoming.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="Not sharing with anyone"
                description="Your devices are visible only to you."
                className="py-10"
              />
            ) : (
              activeIncoming.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center gap-3 border-b border-line/60 px-5 py-3.5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">
                      {connection.requesterName}
                    </p>
                    <p className="truncate text-[11px] text-ink-faint">
                      {connection.sharedDeviceIds.length
                        ? `${connection.sharedDeviceIds.length} device${connection.sharedDeviceIds.length === 1 ? "" : "s"}`
                        : "All your devices"}
                      {" · since "}
                      {absoluteTime(connection.respondedAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRevokeTarget(connection)}
                    className="text-danger hover:bg-danger/10"
                  >
                    Stop
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Sharing with you"
            subtitle={
              sharedDevices.length
                ? `${sharedDevices.length} device${sharedDevices.length === 1 ? "" : "s"} on your map`
                : "Nobody is sharing their location with you."
            }
          />
          <div className="border-t border-line">
            {activeOutgoing.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="Nobody yet"
                description="Ask someone by email. They decide what — if anything — to share."
                className="py-10"
              />
            ) : (
              activeOutgoing.map((connection) => {
                const theirDevices = sharedDevices.filter(
                  (device) => device.connectionId === connection.id
                );

                return (
                  <div
                    key={connection.id}
                    className="flex items-center gap-3 border-b border-line/60 px-5 py-3.5 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-ink">
                        {connection.email}
                      </p>
                      <p className="truncate text-[11px] text-ink-faint">
                        {theirDevices.length
                          ? theirDevices.map((device) => device.name).join(", ")
                          : "No devices reporting yet"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevokeTarget(connection)}
                    >
                      Remove
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {outgoing.some((entry) => entry.status === "pending") && (
        <Card className="mt-4 overflow-hidden">
          <CardHeader title="Waiting on a reply" />
          <div className="border-t border-line">
            {outgoing
              .filter((entry) => entry.status === "pending")
              .map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center gap-3 border-b border-line/60 px-5 py-3 last:border-0"
                >
                  <span className="min-w-0 flex-1 truncate text-xs text-ink">
                    {connection.email}
                  </span>
                  <Badge tone={STATUS_TONE[connection.status]}>
                    {connection.status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRevokeTarget(connection)}
                  >
                    Cancel
                  </Button>
                </div>
              ))}
          </div>
        </Card>
      )}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-faint">
        Accepting lets someone see a position — never change a setting, read
        history, or stop you revoking. Either side can end it instantly.
      </p>

      {askOpen && <AskModal onClose={() => setAskOpen(false)} onSent={refresh} />}

      {acceptTarget && (
        <AcceptModal
          request={acceptTarget}
          onClose={() => setAcceptTarget(null)}
          onAccepted={refresh}
        />
      )}

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        onConfirm={revoke}
        loading={working}
        title="Stop sharing?"
        description="Whatever was visible becomes invisible immediately, for both sides."
        confirmLabel="Stop sharing"
      />
    </div>
  );
}

// Mounted only while open, so it seeds from props once and no effect resets it.
const AskModal = ({ onClose, onSent }) => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const send = async (event) => {
    event.preventDefault();
    setSending(true);
    setProblem(null);
    setErrors({});

    try {
      const data = await connectionService.sendRequest({
        email: email.trim(),
        message: message.trim() || undefined,
      });

      setResult(data);
      onSent();
    } catch (error) {
      if (error instanceof ApiError && error.errors?.length) {
        setErrors(
          Object.fromEntries(
            error.errors.map((issue) => [issue.field, issue.message])
          )
        );
      }

      setProblem(error.message);
    } finally {
      setSending(false);
    }
  };

  const link = result ? connectionService.inviteLinkFor(result.inviteToken) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the link and copy it manually");
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={result ? "Request sent" : "Ask someone to share their location"}
      description={
        result
          ? undefined
          : "They decide whether to accept, and which of their devices to include. Nothing is shared until they do."
      }
    >
      {result ? (
        <div className="space-y-4">
          <div
            className={cn(
              "rounded-xl border p-3",
              result.hasAccount
                ? "border-positive/25 bg-positive/[0.07]"
                : "border-warning/25 bg-warning/[0.07]"
            )}
          >
            <p
              className={cn(
                "text-xs font-medium",
                result.hasAccount ? "text-positive" : "text-warning"
              )}
            >
              {result.hasAccount
                ? "They have an Orbit account — the request is already in their app."
                : "They have no Orbit account yet. Send them this link yourself."}
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-muted">Invite link</p>
            <div className="flex items-stretch gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg border border-line bg-void/70 px-3 py-2 font-mono text-[11px] text-ink">
                {link}
              </code>
              <Button
                variant="secondary"
                size="icon"
                onClick={copy}
                aria-label="Copy invite link"
                className="h-auto shrink-0"
              >
                {copied ? (
                  <Check className="size-4 text-positive" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
              The link only shows who is asking. It grants nothing until they
              sign in and accept, and it expires in 14 days.
            </p>
          </div>

          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={send} className="space-y-4" noValidate>
          <Field label="Their email" error={errors.email}>
            <Input
              type="email"
              placeholder="someone@gmail.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              invalid={Boolean(errors.email)}
              required
              autoFocus
            />
          </Field>

          <Field
            label="Message"
            hint="Optional — they see this when deciding."
            error={errors.message}
          >
            <Input
              placeholder="Let me know you got home safe"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={200}
            />
          </Field>

          {problem && (
            <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
              {problem}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={sending}>
              <Link2 className="size-3.5" /> Send request
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

const AcceptModal = ({ request, onClose, onAccepted }) => {
  const devices = useDeviceStore((state) => state.devices);

  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggle = (deviceId) =>
    setSelected((current) =>
      current.includes(deviceId)
        ? current.filter((id) => id !== deviceId)
        : [...current, deviceId]
    );

  const accept = async () => {
    setSaving(true);

    try {
      await connectionService.acceptRequest(request.id, selected);
      toast.success("You are now sharing. You can stop at any time.");
      onAccepted();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Share with ${request.requesterName}?`}
      description="Choose what they can see. You can change or stop this whenever you like."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} onClick={accept}>
            <Check className="size-3.5" /> Share
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-void/40 p-3">
          <p className="text-xs text-ink">{request.requesterEmail}</p>
          {request.message && (
            <p className="mt-1.5 text-xs italic text-ink-muted">
              “{request.message}”
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-ink-muted">
            Devices to share{" "}
            <span className="text-ink-faint">
              {selected.length === 0 ? "(all, including future ones)" : ""}
            </span>
          </p>

          {devices.length === 0 ? (
            <p className="text-[11px] text-ink-faint">
              You have no devices registered yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {devices.map((device) => {
                const isSelected = selected.includes(device.id);

                return (
                  <button
                    key={device.id}
                    type="button"
                    onClick={() => toggle(device.id)}
                    className={cn(
                      "focus-ring rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                      isSelected
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

        <p className="text-[11px] leading-relaxed text-ink-faint">
          They will see where these devices are and whether they are online.
          They cannot read your history, change your settings, or stop you
          revoking this.
        </p>
      </div>
    </Modal>
  );
};
