import Link from "next/link";

import { OrbitMark } from "@/components/layout/Sidebar";

export default function AuthLayout({ children }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Left: the form. Kept narrow and centred so it stays the focus. */}
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link href="/" className="focus-ring flex w-fit items-center gap-2.5 rounded-lg">
          <OrbitMark />
          <span className="text-[15px] font-semibold tracking-tight">Orbit</span>
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm animate-rise">{children}</div>
        </div>

        <p className="text-center text-[11px] text-ink-faint">
          Orbit only tracks devices you register yourself.
        </p>
      </div>

      {/* Right: an ambient panel. Decorative, so it is hidden rather than
          stacked on small screens where it would just push the form down. */}
      <div className="relative hidden overflow-hidden border-l border-line lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(60rem_40rem_at_60%_20%,rgba(34,211,238,0.10),transparent_65%),radial-gradient(40rem_30rem_at_20%_90%,rgba(167,139,250,0.10),transparent_65%)]" />

        {/* Concentric rings - the product's namesake, drawn in CSS. */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {[10, 17, 25, 34].map((size, index) => (
            <div
              key={size}
              style={{
                width: `${size}rem`,
                height: `${size}rem`,
                animationDuration: `${18 + index * 9}s`,
              }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06] [animation-name:sweep] [animation-iteration-count:infinite] [animation-timing-function:linear]"
            >
              <span
                className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full"
                style={{
                  background: index % 2 ? "#a78bfa" : "#22d3ee",
                  boxShadow: `0 0 14px ${index % 2 ? "#a78bfa" : "#22d3ee"}`,
                }}
              />
            </div>
          ))}
          <div className="size-3 rounded-full bg-accent shadow-[0_0_30px_6px] shadow-accent/50" />
        </div>

        <div className="absolute inset-x-0 bottom-0 p-10">
          <p className="max-w-sm text-sm leading-relaxed text-ink-muted">
            Every device on Orbit is one you added yourself, with a token you
            issued. Turn tracking off and the server stops accepting its
            location — not just the app.
          </p>
        </div>
      </div>
    </div>
  );
}
