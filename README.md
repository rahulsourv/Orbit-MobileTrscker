# Orbit

A privacy-first personal device tracking platform. Connect your own phones, laptops and tablets, see them on one live map, set geofences, and share a location temporarily — without handing anyone a permanent window into where you are.

Orbit is not a covert tracker. A device reports nothing until its owner registers it and issues it a token, and the owner can revoke tracking at any time from the server side.

## Layout

```
orbit/
├── apps/
│   ├── web/        Next.js dashboard      (built)
│   └── mobile/     Expo device client     (built)
├── server/         Express + MongoDB API  (built)
└── packages/
    ├── types/      shared types           (not started)
    └── validation/ shared Zod schemas     (not started)
```

## Status

**Backend — complete.** Auth with rotating refresh tokens, device registration and token lifecycle, live and batched location ingestion, geospatial queries, geofencing with enter/exit alerts, notifications, expiring share links, and a Socket.IO layer for real-time updates. See [`server/README.md`](server/README.md).

**Frontend — complete.** Landing page, auth, dashboard, device management, live map with switchable basemaps, location history, geofence editor, people/sharing, alerts, settings, and public share and invite views. Dark-first, real-time, no map API key required. See [`apps/web/README.md`](apps/web/README.md).

**Mobile — complete.** A React Native / Expo app that is both a device client and a full dashboard: it registers the phone and reports GPS in the background (queuing fixes while offline), *and* shows the live map, every device, geofences, people and alerts. It never tracks quietly — Android shows a permanent notification the whole time it runs. See [`apps/mobile/README.md`](apps/mobile/README.md).

## Running it

Two processes. Start the API first.

```bash
cd server && npm install && npm run dev
```

```bash
cd apps/web && npm install && npm run dev
```

The phone app needs a development build, because background location cannot run in Expo Go:

```bash
cd apps/mobile && npm install && npx expo run:android
```

Copy `server/.env.example` to `server/.env` and fill it in, and `apps/web/.env.example` to `apps/web/.env.local`. The dashboard is then at `http://localhost:3000`.

MongoDB is required. Redis is optional — without it the API still runs, with rate limiting falling back to per-process counters and Socket.IO running unclustered.

## Sharing with other people

One person's location becomes visible to another only through an explicit,
revocable agreement. You ask someone by email; if they have an Orbit account
the request appears in their app, and if they do not you get an invite link to
send them yourself. They choose whether to accept and which of their devices to
include, and either side can end it instantly.

A pending request grants nothing. Accepting lets the other person see a
position — never change a setting, read history, or stop you revoking.

## Maps and directions

Both clients use Leaflet over free basemaps — dark, street, satellite (Esri)
and terrain (OpenTopoMap) — so there is **no API key and no billing account**
anywhere in the project. Directions come from OSRM through the API, giving
distance, travel time, arrival time and turn-by-turn steps for driving, walking
and cycling.

Routing is proxied by the backend rather than called from the clients, so the
provider can be swapped — for Google, say — in one file, without touching web
or mobile and without a key ever reaching a phone.

## How a device reports

Orbit has two kinds of client, and they authenticate differently.

**The owner** — the dashboard — holds a short-lived JWT access token in memory and an HttpOnly refresh cookie in the browser.

**The device** holds its own long-lived device token, issued once when the owner registers it and stored only as a hash. That token grants exactly three things: report a position, send a heartbeat, and ask whether tracking is still permitted. It cannot read the account or any other device.

```
device GPS → POST /api/devices/:id/locations → validate → MongoDB
                                                    ↓
                                              Socket.IO → dashboard marker moves
```

The Expo app in `apps/mobile` is that agent. Any process holding a device token can play the same role:

```bash
curl -X POST http://localhost:5000/api/devices/<deviceId>/locations -H "Content-Type: application/json" -H "x-device-token: <token>" -d '{"latitude":28.6139,"longitude":77.209,"battery":72}'
```

## Repo notes

There is deliberately **no root `package.json` or workspace config**. `server/`, `apps/web/` and `apps/mobile/` install independently, which keeps each runnable on its own — and Expo in particular is happier without hoisted `node_modules`. Workspaces are worth adding only alongside `packages/types` and `packages/validation`, when there is actually code to share.
