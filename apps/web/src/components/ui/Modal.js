"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/cn";
import { Button } from "./index";

export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}) => {
  // Escape closes, and the page behind must not scroll while a dialog is up.
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Portalled so a dialog is never clipped by a card's overflow or trapped
  // beneath the map's stacking context.
  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        onClick={onClose}
        className="absolute inset-0 animate-fade bg-void/80 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "glass relative w-full animate-rise overflow-hidden rounded-t-2xl shadow-2xl shadow-black/70 sm:rounded-2xl",
          { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-lg" }[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {description && (
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring -mr-1 -mt-1 rounded-lg p-1.5 text-ink-faint transition-colors hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

// Destructive actions get their own dialog rather than a window.confirm, which
// cannot say what is about to be lost.
export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  loading = false,
  tone = "danger",
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    description={description}
    size="sm"
    footer={
      <>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          size="sm"
          loading={loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </>
    }
  >
    <p className="text-xs leading-relaxed text-ink-muted">
      This cannot be undone.
    </p>
  </Modal>
);

export default Modal;
