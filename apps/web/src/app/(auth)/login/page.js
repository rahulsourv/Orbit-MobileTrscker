"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { useAuthStore } from "@/store/auth.store";
import { ApiError } from "@/lib/api";

const LoginForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((state) => state.login);
  const status = useAuthStore((state) => state.status);

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Only ever an internal path, so a crafted ?next= cannot bounce someone to
  // another origin after they sign in.
  const nextParam = searchParams.get("next");
  const next = nextParam?.startsWith("/") ? nextParam : "/dashboard";

  // Someone who is already signed in has no business on this page.
  useEffect(() => {
    if (status === "authenticated") {
      router.replace(next);
    }
  }, [status, router, next]);

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
      await login(form);
      router.replace(next);
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
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Sign in to see where your devices are.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
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
            autoComplete="current-password"
            placeholder="••••••••"
            value={form.password}
            onChange={update("password")}
            invalid={Boolean(errors.password)}
            required
          />
        </Field>

        {message && (
          <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
            {message}
          </p>
        )}

        <Button type="submit" loading={submitting} className="w-full" size="lg">
          Sign in
          {!submitting && <ArrowRight className="size-4" />}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-ink-muted">
        New to Orbit?{" "}
        <Link
          href="/register"
          className="focus-ring rounded font-medium text-accent hover:text-accent-glow"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
};

// useSearchParams needs a Suspense boundary above it.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
