# Orbit — Web

The Orbit dashboard: Next.js App Router, plain JavaScript/JSX, Tailwind CSS v4.

Dark-only by design. A single committed palette keeps the map — which is the visual focal point — consistent with the chrome around it, instead of asking every surface to work twice.

---

## Running it

The API must be running first (see [`../../server`](../../server)).

```bash
npm install
```

Copy `.env.example` to `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

```bash
npm run dev
```

Open `http://localhost:3000`.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16, App Router, JSX |
| Styling | Tailwind CSS v4 (`@theme` tokens in `globals.css`) |
| State | Zustand |
| Real time | socket.io-client |
| Map | Leaflet + react-leaflet, CARTO dark basemap |
| Icons | lucide-react |
| Toasts | sonner |

**The map needs no API key.** CARTO's dark basemap is used over OpenStreetMap data, so the project runs for anyone who clones it — no Mapbox account, no token to leak.

## Layout

```
src/
├── app/
│   ├── (auth)/          login, register — split-screen shell
│   ├── (dashboard)/     the signed-in app — sidebar, topbar, socket
│   ├── share/[token]/   public recipient view, no session
│   └── page.js          landing
├── components/
│   ├── ui/              Button, Card, Field, Modal, Badge, Switch…
│   ├── layout/          Sidebar, Topbar, AuthGate, SessionBootstrap
│   ├── devices/         DeviceCard, AddDeviceModal, ShareDeviceModal
│   └── map/             OrbitMap (dynamic), MapCanvas (Leaflet), MapLegend
├── hooks/               useSocket
├── lib/                 api client, formatters, geo maths, constants
├── services/            one module per API area
└── store/               auth, devices, notifications
```

## How auth works in the browser

The access token lives **in memory only** — never `localStorage`, which any XSS could read. That means a page refresh loses it by design.

The session is rebuilt instead from the HttpOnly refresh cookie, which JavaScript cannot touch:

```
cold load → SessionBootstrap → POST /auth/refresh (cookie) → access token in memory
```

Two details in [`lib/api.js`](src/lib/api.js) matter:

- **A 401 is not an error the caller sees.** The client refreshes once and replays the original request.
- **Concurrent 401s share one refresh.** Otherwise the first rotation would invalidate the token the others still hold, and the backend would read that replay as a stolen token and end every session on the account.

`AuthGate` is a UX guard, not a security boundary — every protected byte comes from the API, which authorises each request itself. Its only job is to avoid rendering a dashboard to someone about to be redirected.

## How live updates work

One socket for the whole signed-in app, opened by the dashboard layout in [`hooks/useSocket.js`](src/hooks/useSocket.js). Events land in Zustand stores rather than component state, so every page reading a store updates without subscribing to anything.

| Event | Effect |
| --- | --- |
| `device:locationUpdated` | Marker moves, card coordinates update |
| `device:statusChanged` | Online/offline dot and counts |
| `device:batteryUpdated` | Battery pill |
| `device:added` / `updated` / `removed` | Device list |
| `notification:new` | Tray, badge, and a toast |

The socket's `auth` is a **function**, not a value, so a reconnect after the access token rotated reads the current one rather than replaying a stale token.

Nothing polls — with one deliberate exception: the public share page has no session and no room to join, so it re-reads on a 30-second timer.

## Notes on the map

- `MapCanvas` is loaded through `next/dynamic` with `ssr: false`, because Leaflet reaches for `window` at import time. That option is only legal inside a Client Component, which is why `OrbitMap` is the wrapper.
- Markers are `divIcon`s, not the default PNG — bundlers famously break that asset, and a static pin cannot convey liveness. The live ring breathes in CSS.
- Layers are rendered inside a `Fragment`, never a `div`: anything that is not a Leaflet layer gets mounted into the map container as a stray DOM node.
- The trail is drawn twice — a wide faint pass under a thin bright one — so the line glows instead of fighting the basemap.
- Leaflet measures its container on mount; inside a flex dashboard the final height often arrives a tick later, so `ResizeHandler` re-measures.

## Conventions

- **Dialogs are mounted only while open.** They seed state from props on mount, so nothing has to re-sync them on reopen.
- **Effects never call `setState` synchronously.** Data loads run as an async IIFE with a `cancelled` flag, which also stops a slow response from overwriting a newer one.
- **`Button` defaults to `type="button"`.** A bare `<button>` inside a form submits it; submitting is opt-in.
- **Optimistic where it matters** — revoking a share, toggling tracking, marking alerts read — with a refetch on failure.

## Not built yet

Email verification and password reset (neither exists in the API either), and an automated test suite. The app was verified end to end by hand against the live API: register → add device → device reports a route → markers move, alerts fire, geofence crossing detected, share link opens for an unauthenticated visitor.
