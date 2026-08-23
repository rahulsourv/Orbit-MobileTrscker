# Orbit — Backend

Node.js + Express API for Orbit, a privacy-first personal device tracking platform.

A device is only ever tracked after its owner explicitly registers it and issues it a token. Tracking can be switched off by the owner at any time, and the switch is enforced on the server rather than trusted to the client.

---

## Stack

| Concern | Choice |
| --- | --- |
| Runtime | Node.js, Express 5 |
| Database | MongoDB + Mongoose (GeoJSON, 2dsphere, TTL indexes) |
| Real time | Socket.IO |
| Cache / scale-out | Redis (optional) |
| Auth | JWT access + rotating refresh tokens, Argon2 |
| Validation | Zod |

## Architecture

```
routes  →  middleware  →  controllers  →  services  →  models  →  MongoDB
                                             ↓
                                         Socket.IO
```

Controllers only translate HTTP; all behaviour lives in services, so the REST and Socket.IO paths share exactly one implementation and one set of rules.

## Running it

```bash
npm install
```

Copy `.env.example` to `.env` and fill it in. Generate each secret separately:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

```bash
npm run dev
```

The API starts on `http://localhost:5000`. `GET /api/health` reports database and Redis status.

Redis is optional. Without `REDIS_URL` the API runs normally — rate limiting falls back to per-process counters and Socket.IO runs on a single node.

---

## Two kinds of client

Orbit has two distinct callers, and they authenticate differently.

**The owner** (web dashboard, and later the mobile app's UI) sends a short-lived JWT access token as `Authorization: Bearer <token>`. Browsers hold the refresh token in an HttpOnly cookie scoped to `/api/auth`; native clients send `x-client-type: mobile` and receive it in the response body to store in SecureStore.

**The device** sends its own long-lived device token as `x-device-token: <token>` (or `Authorization: Device <token>`). That token grants exactly three capabilities and nothing more: report a position, report a heartbeat, and ask whether tracking is still permitted. A device never holds its owner's credentials, and a token for one device grants nothing over another.

Both tokens are stored only as SHA-256 hashes. Raw values are shown once, at issue time.

---

## API

All responses share one envelope: `{ success, message?, data?, errors? }`.

### Auth — `/api/auth`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/register` | — | Create an account |
| POST | `/login` | — | Start a session |
| POST | `/refresh` | refresh token | Rotate the token pair |
| POST | `/logout` | refresh token | End this session |
| POST | `/logout-all` | user | End every session |
| GET | `/me` | user | Current user |
| GET | `/sessions` | user | Where the account is signed in |

### Devices — `/api/devices`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/` | user | Register a device, returns the device token **once** |
| GET | `/` | user | All devices plus online/offline counts |
| GET | `/:deviceId` | user | One device |
| PATCH | `/:deviceId` | user | Rename, retype |
| PUT | `/:deviceId/tracking` | user | The tracking kill switch |
| POST | `/:deviceId/token/rotate` | user | Reissue the device token |
| DELETE | `/:deviceId` | user | Delete device, history and its share links |
| GET | `/self` | device | Confirm the token and read the tracking flag |
| POST | `/:deviceId/heartbeat` | device | "I am alive", optional battery |
| POST | `/:deviceId/locations` | device | Report one fix |
| POST | `/:deviceId/locations/batch` | device | Offline sync |
| GET | `/:deviceId/locations` | user | History, paged |
| GET | `/:deviceId/locations/latest` | user | Most recent fix |
| DELETE | `/:deviceId/locations` | user | Erase history |

### Locations — `/api/locations`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/live` | Every device with a known position — the live map's first paint |
| GET | `/nearby` | Geospatial query: `?latitude=&longitude=&radius=` |

### Geofences — `/api/geofences`

Full CRUD. A geofence names a centre, a radius in metres, and optionally a subset of devices; an empty device list means all of them.

### Notifications — `/api/notifications`

List, unread count, mark one read, mark all read, delete one, clear all.

### People — `/api/connections`

Consent-based sharing between accounts. This is the only way one person's
location becomes visible to another.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/` | user | Ask someone by email; returns an invite link **once** |
| GET | `/` | user | Incoming and outgoing requests |
| GET | `/shared-devices` | user | Devices other people have chosen to share |
| POST | `/:id/accept` | target | Accept, optionally naming which devices |
| POST | `/:id/deny` | target | Decline; nothing is shared |
| PUT | `/:id/devices` | target | Narrow or widen the scope afterwards |
| DELETE | `/:id` | either | End it immediately |
| GET | `/invite/:token` | **none** | Who is asking — nothing else |

The asymmetry is deliberate. Accepting lets the requester see a position; it
never lets them change a setting, read history, or stop the target revoking.
A pending request grants nothing at all, and the invite link reveals only the
requester's name and message — no device, no coordinates, not even confirmation
that anything exists to see.

### Directions — `/api/routes`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/directions` | `?fromLat=&fromLng=&toLat=&toLng=&mode=` — distance, duration, geometry and turn-by-turn steps |

Proxied rather than called from the clients so the provider can be swapped in
one place, a future keyed provider's credentials never reach a phone, and both
clients report identical numbers. Defaults to OSRM's key-free public server;
when it cannot answer, the response falls back to a clearly-labelled
straight-line estimate rather than failing.

### Sharing — `/api/shares`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/` | user | Create an expiring read-only link |
| GET | `/` | user | List shares (metadata only, never a working token) |
| DELETE | `/:shareId` | user | Revoke immediately |
| GET | `/public/:token` | **none** | Resolve a share |

The public endpoint is the only route a stranger can reach. It returns the device's display name, type, online flag and current position — no account details, no device id, no history.

---

## Real-time events

Socket.IO connections authenticate in the handshake: `auth.token` for a dashboard, `auth.deviceToken` for a device. Every socket joins rooms derived from its own verified identity, so subscribing to another user's devices is not expressible in the protocol.

Server → dashboard:

| Event | Fires when |
| --- | --- |
| `device:locationUpdated` | A newer fix moves the marker |
| `device:statusChanged` | Online/offline flips |
| `device:batteryUpdated` | Battery reported |
| `device:added` / `device:updated` / `device:removed` | Device list changes |
| `geofence:triggered` | A device crosses a boundary |
| `notification:new` | Any alert is raised |

Client → server:

| Event | From | Purpose |
| --- | --- | --- |
| `location:update` | device | Report a fix |
| `device:heartbeat` | device | Stay online without reporting a position |
| `location:snapshot` | dashboard | Current positions |
| `devices:snapshot` | dashboard | Current device list |

Socket.IO carries events; it never obtains GPS. The device's own OS APIs produce the fix.

---

## Design notes

**GeoJSON coordinate order.** MongoDB stores `[longitude, latitude]`, the reverse of how coordinates are normally written. Every conversion goes through `utils/location.js` so the swap happens in exactly one place, and the API accepts and returns named `latitude`/`longitude` fields so a caller can never get the order wrong.

**Current position vs history.** `Device.lastLocation` mirrors the newest fix for fast dashboard reads; the `Location` collection is the append-only history. The mirror only moves forward in time, so out-of-order arrivals after an offline stretch cannot drag the live marker backwards.

**Offline sync is idempotent.** A unique index on `(deviceId, timestamp)` means a replayed queue is deduplicated by the database rather than piling up as phantom history. A batch is applied oldest-first and geofences are replayed in order, so a trip taken while offline still produces its enter and exit alerts when the device reconnects. The response reports `accepted`, `duplicates` and `rejected` so the client knows exactly what it may discard.

**Alerts are edge-triggered.** Geofence enter/exit and low battery fire on transitions only, never on every fix. The first fix after a geofence is created establishes a baseline without alerting, so a device already sitting at home does not announce that it arrived.

**Geofence hysteresis.** A hard boundary flaps when a device idles near the edge and GPS jitters. The threshold is widened on the way out and narrowed on the way in, so a device must cross a band before the state can flip again.

**Offline detection is swept, not pushed.** A device that stops reporting never announces it, so a periodic sweep marks devices offline once they pass the silence window and raises the alert once per transition. Socket disconnects take the same path.

**Consent is a relationship, not a flag.** Sharing between people lives in its
own `Connection` document with an explicit status, so "pending" and "revoked"
are states the query filters on rather than conditions sprinkled through the
code. Live updates fan out to accepted watchers through one helper, and the
watcher list is cached for 30 seconds but dropped the instant a connection
changes — so revoking is immediate rather than eventually.

**Ownership is never client-supplied.** Every query filters on the authenticated user id. A device belonging to someone else answers `404`, not `403`, so ids cannot be probed for existence.

**Location history expires.** A TTL index drops fixes after `LOCATION_HISTORY_DAYS`. Deleting a device deletes its history and share links with it.

---

## Security

Argon2 password hashing · JWT access tokens · refresh-token rotation with reuse detection (a replayed token revokes every session for that user) · hashed device and share tokens · Zod validation on every body, query and path parameter · per-route rate limiting · Helmet · strict CORS with credentials · HttpOnly, `SameSite` cookies · centralised error handling that never leaks a stack in production · a logger that redacts anything secret-shaped before it can reach a log sink.

## Not built yet

Email verification (the `emailVerified` field exists but nothing sets it), password reset, and an automated test suite — the API was verified end to end manually against a live database and Socket.IO server.
