"use client";

import { useState } from "react";
import { Copy, Check, KeyRound, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/ui/Modal";
import { Button, Field, Input, Select } from "@/components/ui";
import { DEVICE_TYPES, PLATFORMS } from "@/lib/constants";
import { ApiError } from "@/lib/api";
import * as deviceService from "@/services/device.service";
import { useDeviceStore } from "@/store/device.store";

// The identifier the device client will send. Generated here so the user does
// not have to invent one, and stable enough to paste into a client config.
const suggestIdentifier = () =>
  `orbit-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

export const TokenReveal = ({ token, onDone }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      toast.success("Token copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the token and copy it manually");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-xl border border-warning/25 bg-warning/[0.07] p-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="text-xs leading-relaxed text-ink-muted">
          This is the only time this token is shown. Orbit stores a hash of it,
          not the token itself — if you lose it you will have to issue a new one.
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-ink-muted">Device token</p>
        <div className="flex items-stretch gap-2">
          <code className="min-w-0 flex-1 break-all rounded-lg border border-line bg-void/70 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-accent">
            {token}
          </code>
          <Button
            variant="secondary"
            size="icon"
            onClick={copy}
            aria-label="Copy token"
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

      <div className="rounded-xl border border-line bg-void/40 p-3">
        <p className="text-[11px] font-medium text-ink">How the device uses it</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
          The device client sends this as an{" "}
          <code className="font-mono text-ink-muted">x-device-token</code> header
          when it reports a position. It authenticates the device only — it
          cannot read your account or your other devices.
        </p>
      </div>

      <Button className="w-full" onClick={onDone}>
        I&apos;ve saved it
      </Button>
    </div>
  );
};

export const AddDeviceModal = ({ open, onClose }) => {
  const upsertDevice = useDeviceStore((state) => state.upsertDevice);

  const [form, setForm] = useState({
    name: "",
    type: "phone",
    platform: "android",
    model: "",
    deviceIdentifier: suggestIdentifier(),
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [issuedToken, setIssuedToken] = useState(null);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: null }));
    setMessage(null);
  };

  const reset = () => {
    setForm({
      name: "",
      type: "phone",
      platform: "android",
      model: "",
      deviceIdentifier: suggestIdentifier(),
    });
    setErrors({});
    setMessage(null);
    setIssuedToken(null);
    setSubmitting(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setErrors({});

    try {
      const data = await deviceService.registerDevice({
        ...form,
        model: form.model.trim() || undefined,
      });

      upsertDevice(data.device);
      setIssuedToken(data.deviceToken);
      toast.success(`${data.device.name} registered`);
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
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      // Closing mid-reveal would lose the token, so the dialog only dismisses
      // through the explicit acknowledgement once one has been issued.
      onClose={issuedToken ? () => {} : close}
      title={issuedToken ? "Save your device token" : "Register a device"}
      description={
        issuedToken
          ? undefined
          : "Give the device a name you'll recognise. Orbit issues it a token that lets it — and only it — report a position."
      }
    >
      {issuedToken ? (
        <TokenReveal token={issuedToken} onDone={close} />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Device name" error={errors.name}>
            <Input
              placeholder="Pixel 8"
              value={form.name}
              onChange={update("name")}
              invalid={Boolean(errors.name)}
              required
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" error={errors.type}>
              <Select value={form.type} onChange={update("type")}>
                {DEVICE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Platform" error={errors.platform}>
              <Select value={form.platform} onChange={update("platform")}>
                {PLATFORMS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Model" error={errors.model} hint="Optional">
            <Input
              placeholder="Pixel 8 Pro"
              value={form.model}
              onChange={update("model")}
            />
          </Field>

          <Field
            label="Device identifier"
            error={errors.deviceIdentifier}
            hint="Generated for you. The device client sends this to identify itself."
          >
            <Input
              value={form.deviceIdentifier}
              onChange={update("deviceIdentifier")}
              className="font-mono text-xs"
              invalid={Boolean(errors.deviceIdentifier)}
              required
            />
          </Field>

          {message && (
            <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
              {message}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              <KeyRound className="size-3.5" />
              Register device
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default AddDeviceModal;
