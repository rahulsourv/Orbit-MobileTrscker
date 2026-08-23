"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

const BUTTON_VARIANTS = {
  primary:
    "bg-accent text-void hover:bg-accent-glow shadow-[0_8px_30px_-12px] shadow-accent/70",
  secondary: "bg-white/5 text-ink hover:bg-white/10 border border-line",
  ghost: "text-ink-muted hover:text-ink hover:bg-white/5",
  danger: "bg-danger/12 text-danger hover:bg-danger/20 border border-danger/25",
  outline: "border border-line-strong text-ink hover:border-accent/50 hover:text-accent",
};

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-sm gap-2",
  icon: "size-9",
};

export const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    // A bare <button> inside a form defaults to type="submit", which turns any
    // decorative button into an accidental submit. Submitting is opt-in here.
    type = "button",
    loading = false,
    disabled,
    className,
    children,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "focus-ring inline-flex items-center justify-center rounded-lg font-medium",
        "transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        "active:scale-[0.98]",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

export const Card = ({ className, hover = false, children, ...props }) => (
  <div
    className={cn(
      "glass rounded-card",
      hover && "glass-hover",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ title, subtitle, action, className }) => (
  <div className={cn("flex items-start justify-between gap-4 p-5", className)}>
    <div className="min-w-0">
      <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p>}
    </div>
    {action}
  </div>
);

/* -------------------------------------------------------------------------- */
/* Form fields                                                                */
/* -------------------------------------------------------------------------- */

export const Field = ({ label, error, hint, children, className }) => (
  <label className={cn("block", className)}>
    {label && (
      <span className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label}
      </span>
    )}
    {children}
    {error ? (
      <span className="mt-1.5 block text-xs text-danger">{error}</span>
    ) : hint ? (
      <span className="mt-1.5 block text-xs text-ink-faint">{hint}</span>
    ) : null}
  </label>
);

export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "focus-ring h-10 w-full rounded-lg border bg-void/60 px-3 text-sm text-ink",
        "placeholder:text-ink-faint transition-colors",
        invalid
          ? "border-danger/60"
          : "border-line hover:border-line-strong focus:border-accent/60",
        className
      )}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        "focus-ring h-10 w-full appearance-none rounded-lg border border-line bg-void/60 px-3 text-sm text-ink",
        "transition-colors hover:border-line-strong focus:border-accent/60",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

/* Switch: used for the tracking kill switch, so its state must be unmistakable. */
export const Switch = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      "focus-ring relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300",
      "disabled:cursor-not-allowed disabled:opacity-50",
      checked ? "bg-accent" : "bg-white/10"
    )}
  >
    <span
      className={cn(
        "absolute top-0.5 size-5 rounded-full bg-void transition-all duration-300",
        checked ? "left-[1.375rem]" : "left-0.5"
      )}
    />
  </button>
);

/* -------------------------------------------------------------------------- */
/* Display                                                                    */
/* -------------------------------------------------------------------------- */

export const Badge = ({ tone = "muted", className, children }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
      {
        accent: "bg-accent/10 text-accent ring-accent/25",
        positive: "bg-positive/10 text-positive ring-positive/25",
        warning: "bg-warning/10 text-warning ring-warning/25",
        danger: "bg-danger/10 text-danger ring-danger/25",
        violet: "bg-violet/10 text-violet ring-violet/25",
        muted: "bg-white/5 text-ink-muted ring-white/10",
      }[tone],
      className
    )}
  >
    {children}
  </span>
);

// A dot that breathes while the device is live, and sits still when it is not.
export const StatusDot = ({ online, className }) => (
  <span className={cn("relative flex size-2.5", className)}>
    {online && (
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-positive opacity-60" />
    )}
    <span
      className={cn(
        "relative inline-flex size-2.5 rounded-full",
        online ? "bg-positive" : "bg-ink-faint"
      )}
    />
  </span>
);

export const Spinner = ({ className }) => (
  <Loader2 className={cn("size-5 animate-spin text-ink-faint", className)} />
);

export const Skeleton = ({ className }) => (
  <div className={cn("animate-pulse rounded-lg bg-white/5", className)} />
);

export const EmptyState = ({ icon: Icon, title, description, action, className }) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center px-6 py-16 text-center",
      className
    )}
  >
    {Icon && (
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10">
        <Icon className="size-5 text-ink-faint" />
      </div>
    )}
    <p className="text-sm font-medium text-ink">{title}</p>
    {description && (
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-ink-faint">
        {description}
      </p>
    )}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const PageHeader = ({ title, description, action }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      {description && (
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      )}
    </div>
    {action}
  </div>
);
