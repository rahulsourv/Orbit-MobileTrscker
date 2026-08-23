"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, Link2, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/ui/Modal";
import { Button, Field, Input, Select, Badge, Spinner } from "@/components/ui";
import { SHARE_DURATIONS } from "@/lib/constants";
import { absoluteTime, timeUntil } from "@/lib/format";
import * as shareService from "@/services/share.service";

/**
 * Creating and managing temporary share links for one device.
 *
 * The token only exists in the create response, so the link is built and shown
 * immediately; afterwards the list can only show metadata.
 */
// Mounted only while open, so its first load runs on mount and no effect has
// to reset state when it is reopened.
export const ShareDeviceModal = ({ device, onClose }) => {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState(60);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshLink, setFreshLink] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await shareService.listShares(device.id);

      setShares(data.shares);
    } catch {
      setShares([]);
    } finally {
      setLoading(false);
    }
  }, [device.id]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await shareService.listShares(device.id);

        if (!cancelled) {
          setShares(data.shares);
        }
      } catch {
        if (!cancelled) {
          setShares([]);
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
  }, [device.id]);

  const create = async (event) => {
    event.preventDefault();
    setCreating(true);

    try {
      const data = await shareService.createShare({
        deviceId: device.id,
        expiresInMinutes: Number(duration),
        label: label.trim() || undefined,
      });

      setFreshLink(shareService.shareLinkFor(data.token));
      toast.success("Share link created");
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (shareId) => {
    // Optimistic, because revoking is the one action a user wants to feel
    // instant - they are usually undoing a mistake.
    setShares((current) =>
      current.map((share) =>
        share.id === shareId ? { ...share, active: false, revokedAt: new Date() } : share
      )
    );

    try {
      await shareService.revokeShare(shareId);
      toast.success("Share link revoked");
    } catch (error) {
      toast.error(error.message);
      load();
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(freshLink);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the link and copy it manually");
    }
  };

  const active = shares.filter((share) => share.active);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Share ${device.name}`}
      description="Anyone with the link sees this device's current position and nothing else — no account details, no history."
      size="lg"
    >
      <div className="space-y-5">
        {freshLink && (
          <div className="rounded-xl border border-accent/25 bg-accent/[0.07] p-3">
            <p className="mb-2 text-[11px] font-medium text-accent">
              Copy this now — the link cannot be shown again
            </p>
            <div className="flex items-stretch gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg border border-line bg-void/70 px-3 py-2 font-mono text-[11px] text-ink">
                {freshLink}
              </code>
              <Button
                variant="secondary"
                size="icon"
                onClick={copy}
                aria-label="Copy link"
                className="h-auto shrink-0"
              >
                {copied ? (
                  <Check className="size-4 text-positive" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={create} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Expires after">
              <Select
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              >
                {SHARE_DURATIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Label" hint="Only you see this">
              <Input
                placeholder="For mum"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </Field>
          </div>

          <Button type="submit" size="sm" loading={creating}>
            <Link2 className="size-3.5" /> Create share link
          </Button>
        </form>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-ink">Existing links</p>
            {active.length > 0 && (
              <Badge tone="accent">{active.length} active</Badge>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : shares.length === 0 ? (
            <p className="rounded-xl border border-line bg-void/40 px-3 py-6 text-center text-xs text-ink-faint">
              No share links yet
            </p>
          ) : (
            <ul className="space-y-2">
              {shares.map((share) => (
                <li
                  key={share.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-void/40 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">
                      {share.label || "Untitled link"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-faint">
                      <Clock className="size-3" />
                      {share.active
                        ? `Expires ${timeUntil(share.expiresAt)}`
                        : share.revokedAt
                          ? "Revoked"
                          : `Expired ${absoluteTime(share.expiresAt)}`}
                      {share.viewCount > 0 && ` · ${share.viewCount} view${share.viewCount === 1 ? "" : "s"}`}
                    </p>
                  </div>

                  {share.active ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revoke(share.id)}
                      className="text-danger hover:bg-danger/10"
                    >
                      <Trash2 className="size-3.5" /> Revoke
                    </Button>
                  ) : (
                    <Badge tone="muted">Inactive</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ShareDeviceModal;
