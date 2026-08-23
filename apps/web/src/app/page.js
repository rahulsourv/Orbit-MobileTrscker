"use client";

import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Radar,
  Hexagon,
  WifiOff,
  Share2,
  BellRing,
} from "lucide-react";

import { OrbitMark } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui";
import { useAuthStore } from "@/store/auth.store";

const FEATURES = [
  {
    icon: Radar,
    title: "Live map",
    body: "Every device you own on one map, moving as it moves. No refresh, no polling — the dashboard is pushed each new fix as it arrives.",
  },
  {
    icon: Hexagon,
    title: "Geofences",
    body: "Draw a circle around home, work or school. Orbit tells you when a device arrives or leaves, and only on the crossing — not every minute it sits there.",
  },
  {
    icon: WifiOff,
    title: "Works offline",
    body: "GPS keeps working without a signal. Your device queues what it recorded and syncs the whole trip when it finds a network again.",
  },
  {
    icon: BellRing,
    title: "Alerts that matter",
    body: "Low battery, went offline, came back, crossed a boundary, or a sign-in you didn't make. Each one fires once, when it happens.",
  },
  {
    icon: Share2,
    title: "Temporary sharing",
    body: "Send someone a link that shows one device, expires on a timer, and can be revoked instantly. They see a position — not your account.",
  },
  {
    icon: ShieldCheck,
    title: "Off means off",
    body: "The tracking switch is enforced by the server. Turn it off and your device's reports are refused — it isn't left to the app to behave.",
  },
];

export default function LandingPage() {
  const status = useAuthStore((state) => state.status);
  const authenticated = status === "authenticated";

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-20 max-w-6xl items-center px-6">
        <Link href="/" className="focus-ring flex items-center gap-2.5 rounded-lg">
          <OrbitMark />
          <span className="text-[15px] font-semibold tracking-tight">Orbit</span>
        </Link>

        <nav className="ml-auto flex items-center gap-2">
          {authenticated ? (
            <Link href="/dashboard">
              <Button size="sm">
                Open dashboard <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-16 sm:py-24">
          <div className="max-w-2xl animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1 text-[11px] text-ink-muted">
              <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px] shadow-accent" />
              Privacy-first device tracking
            </span>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
              Know where your devices are.
              <span className="block text-ink-muted">Nobody else does.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted">
              Orbit keeps your phones, laptops and tablets on one live map. A
              device reports nothing until you register it and hand it a token —
              and you can revoke that in one tap.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={authenticated ? "/dashboard" : "/register"}>
                <Button size="lg">
                  {authenticated ? "Open dashboard" : "Create your account"}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href={authenticated ? "/live" : "/login"}>
                <Button variant="outline" size="lg">
                  {authenticated ? "Live map" : "Sign in"}
                </Button>
              </Link>
            </div>

            <p className="mt-5 text-xs text-ink-faint">
              Orbit is not a covert tracker. Every tracked device is one its
              owner set up, and the app says so while it is running.
            </p>
          </div>
        </section>

        <section className="grid gap-3 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                style={{ animationDelay: `${index * 60}ms` }}
                className="glass glass-hover animate-rise rounded-card p-5"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/20">
                  <Icon className="size-4" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-ink">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                  {feature.body}
                </p>
              </div>
            );
          })}
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <div className="flex items-center gap-2.5">
            <OrbitMark className="size-6" />
            <span className="text-xs text-ink-faint">
              Orbit — a personal device tracking platform
            </span>
          </div>
          <p className="text-[11px] text-ink-faint">
            Devices report only with your permission.
          </p>
        </div>
      </footer>
    </div>
  );
}
