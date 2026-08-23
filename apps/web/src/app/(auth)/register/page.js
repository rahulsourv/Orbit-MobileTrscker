"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/store/auth.store";
import { ApiError } from "@/lib/api";

// Mirrors what the API enforces, so the rules are visible before submitting
// rather than arriving as a rejection afterwards.
const RULES = [
  { label: "At least 8 characters", test: (value) => value.length >= 8 },
  { label: "One letter", test: (value) => /[a-zA-Z]/.test(value) },
  { label: "One number", test: (value) => /\d/.test(value) },
];

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const status = useAuthStore((state) => state.status);

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  const checks = useMemo(
    () => RULES.map((rule) => ({ ...rule, passed: rule.test(form.password) })),
    [form.password]
  );

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: null }));
    setMessage(null);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setErrors({});

    try {
      // Registering signs the user straight in, so they land on a dashboard
      // rather than being asked to type the same password twice in a row.
      await register(form);
      router.replace("/dashboard");
    } catch (error) {
      if (error instanceof ApiError && error.errors?.length) {
        setErrors(
          Object.fromEntries(
            error.errors.map((issue) => [issue.field, issue.message])
          )
        );
      }

      setMessage(error.message);
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Then add your first device — it takes a minute.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <Field label="Name" error={errors.name}>
          <Input
            autoComplete="name"
            placeholder="Rahul"
            value={form.name}
            onChange={update("name")}
            invalid={Boolean(errors.name)}
            required
          />
        </Field>

        <Field label="Email" error={errors.email}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={update("email")}
            invalid={Boolean(errors.email)}
            required
          />
        </Field>

        <Field label="Password" error={errors.password}>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={form.password}
            onChange={update("password")}
            invalid={Boolean(errors.password)}
            required
          />
        </Field>

        {form.password.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {checks.map((check) => (
              <li
                key={check.label}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] transition-colors",
                  check.passed ? "text-positive" : "text-ink-faint"
                )}
              >
                <Check
                  className={cn(
                    "size-3 transition-opacity",
                    check.passed ? "opacity-100" : "opacity-30"
                  )}
                />
                {check.label}
              </li>
            ))}
          </ul>
        )}

        {message && (
          <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
            {message}
          </p>
        )}

        <Button type="submit" loading={submitting} className="w-full" size="lg">
          Create account
          {!submitting && <ArrowRight className="size-4" />}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-ink-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="focus-ring rounded font-medium text-accent hover:text-accent-glow"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
