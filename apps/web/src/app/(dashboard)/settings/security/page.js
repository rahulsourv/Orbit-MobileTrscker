"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  LogOut,
  Monitor,
  ShieldCheck,
  KeyRound,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Skeleton,
} from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/Modal";
import * as authService from "@/services/auth.service";
import { useAuthStore } from "@/store/auth.store";
import { absoluteTime, relativeTime } from "@/lib/format";

// The user agent string is unreadable as-is; this reduces it to the two facts
// a person actually recognises about a session.
const describeAgent = (userAgent) => {
  if (!userAgent) {
    return "Unknown device";
  }

  const browser =
    /Edg\//.test(userAgent) ? "Edge"
    : /OPR\//.test(userAgent) ? "Opera"
    : /Chrome\//.test(userAgent) ? "Chrome"
    : /Safari\//.test(userAgent) ? "Safari"
    : /Firefox\//.test(userAgent) ? "Firefox"
    : "Browser";

  const platform =
    /Windows/.test(userAgent) ? "Windows"
    : /Mac OS X|Macintosh/.test(userAgent) ? "macOS"
    : /Android/.test(userAgent) ? "Android"
    : /iPhone|iPad|iOS/.test(userAgent) ? "iOS"
    : /Linux/.test(userAgent) ? "Linux"
    : "Unknown platform";

  return `${browser} on ${platform}`;
};

const PRACTICES = [
  {
    icon: Lock,
    title: "Passwords are hashed with Argon2",
    body: "Orbit never stores your password, and cannot show it to you or anyone else.",
  },
  {
    icon: KeyRound,
    title: "Sessions rotate on every refresh",
    body: "If an old token is ever replayed, Orbit treats it as stolen and ends every session on your account.",
  },
  {
    icon: ShieldCheck,
    title: "Device tokens are stored as hashes",
    body: "A device token is shown once when issued. Rotating one stops the old token working immediately.",
  },
];

export default function SecurityPage() {
  const router = useRouter();
  const logoutEverywhere = useAuthStore((state) => state.logoutEverywhere);

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await authService.listSessions();

        if (!cancelled) {
          setSessions(data.sessions);
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

  const signOutEverywhere = async () => {
    setWorking(true);

    try {
      await logoutEverywhere();
      toast.success("Signed out of every session");
      router.replace("/login");
    } catch (error) {
      toast.error(error.message);
      setWorking(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/settings"
        className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded text-xs text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Settings
      </Link>

      <PageHeader
        title="Security"
        description="Where your account is signed in, and how Orbit protects it."
      />

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Active sessions"
            subtitle={
              loading
                ? "Loading"
                : `${sessions.length} signed-in session${sessions.length === 1 ? "" : "s"}`
            }
            action={
              sessions.length > 0 && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                >
                  <LogOut className="size-3.5" /> Sign out everywhere
                </Button>
              )
            }
          />

          <div className="border-t border-line">
            {loading ? (
              <div className="space-y-2 p-4">
                {[0, 1].map((index) => (
                  <Skeleton key={index} className="h-14" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <EmptyState
                title="No other sessions"
                description="Only this browser is signed in."
                className="py-10"
              />
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-3 border-b border-line/60 px-5 py-3.5 last:border-0"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/5 text-ink-faint ring-1 ring-inset ring-white/10">
                    <Monitor className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">
                      {describeAgent(session.userAgent)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      Started {relativeTime(session.createdAt)}
                      {session.ip ? ` · ${session.ip}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-ink-faint">
                    Expires {absoluteTime(session.expiresAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="How Orbit protects your account" />
          <div className="space-y-4 border-t border-line p-5">
            {PRACTICES.map((practice) => {
              const Icon = practice.icon;

              return (
                <div key={practice.title} className="flex gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-positive/10 text-positive ring-1 ring-inset ring-positive/20">
                    <Icon className="size-3.5" />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-ink">{practice.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                      {practice.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={signOutEverywhere}
        loading={working}
        title="Sign out of every session?"
        description="Every browser and app signed into this account will need to sign in again, including this one."
        confirmLabel="Sign out everywhere"
      />
    </div>
  );
}
