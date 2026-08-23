# Orbit — Mobile

The Orbit phone app. It is two things at once:

- **a device client** — it registers this phone, reports where it is, and is honest about doing so;
- **a full dashboard** — the live map, every device you own, geofences and alerts, kept live over the same Socket.IO stream the web app uses.

So you can track your other devices from your phone, and track your phone from anywhere else.

---

## The one rule

**Orbit does not track quietly.** While this app is reporting:

- the tracking screen says so, with a live pulsing indicator;
- Android shows a permanent foreground-service notification;
- iOS shows the system location indicator;
- one switch stops it, and the owner can also stop it from the dashboard.

There is no hidden mode, and there is no build flag that removes the notification.

---

## Running it

Background location needs a **development build** — it does not work in Expo Go, which cannot register a background task.

```bash
npm install
```

```bash
npx expo run:android
```

For iOS you need macOS and Xcode (`npx expo run:ios`).

`npx expo start` still works for iterating on the UI; only background tracking requires the dev build.

### Pointing it at your API

A phone cannot reach your laptop's `localhost`. Copy `.env.example` to `.env` and set your machine's LAN IP:

```
EXPO_PUBLIC_API_URL=http://192.168.1.10:5000/api
```

You can also change it inside the app — on the sign-in screen under "Connecting to a different server?", or later in Settings. That is how you point a built app at a deployed API without rebuilding it.

---

## How it works

### Two identities, kept apart

| Identity | Where it lives | What it is for |
| --- | --- | --- |
| User session | refresh token in SecureStore, access token in memory | Registering and unlinking this device |
| Device token | SecureStore | Reporting positions |

This split is the reason tracking keeps working for weeks without a sign-in prompt: the tracker only ever needs the device token, which is long-lived and does not rotate. A failed session restore is deliberately **not** treated as a reason to stop reporting.

The refresh token rotates on every use, so the stored copy is replaced each time. Keeping a stale one would look like a replayed token to the server, which treats that as theft and ends every session on the account.

### The flow

```
Sign in  →  Register this device  →  Map | Devices | Zones | Alerts | This device
   │              │
   │              └─ device token, shown once, into SecureStore
   └─ refresh token into SecureStore
```

Which *shell* appears is a state machine in `App.js`, decided entirely by the credentials this phone holds — a router would add a second source of truth for that. Inside the signed-in shell, React Navigation provides bottom tabs.

A phone that is registered but signed out is a real state, not an error: it keeps reporting its own position, and simply is not offered the dashboard tabs rather than being shown them empty.

### The tabs

| Tab | What it does |
| --- | --- |
| **Map** | Every device with a position, live. Tap a marker for a summary, then through to the device. |
| **Devices** | All your devices with online/offline, battery and tracking state; detail screen has the map, the path, and the tracking kill switch. |
| **Zones** | Geofences — create one centred on your current location or on any device, toggle it, delete it. |
| **Alerts** | Every notification, with a live unread badge on the tab bar. |
| **This device** | The tracker for the phone you are holding, plus settings. |

Updates arrive over Socket.IO, authenticated in the handshake with the **user's** access token — the device token would only ever subscribe this phone to itself. `auth` is a function so a reconnect after the token rotated reads the current one.

### The map, without an API key

`react-native-maps` would mean a Google Maps API key on Android. Instead `components/OrbitMap.js` runs Leaflet inside a WebView over CARTO's dark basemap — the same choice the web dashboard makes, so the project stays key-free and the two clients look identical.

Data is pushed into the WebView with `injectJavaScript` rather than re-rendering the document: reloading it would throw away the user's pan and zoom on every incoming position.

### Background reporting

`src/tracking/task.js` registers the location task at **module scope**, imported before React renders. When the OS relaunches the app to deliver a location it evaluates the bundle and expects the task to already exist — registering it inside a component would be too late.

That task runs in its own JavaScript context: no React, no component state, no in-memory session. Everything it needs is read from storage on each wake-up, which is why `tracker.js` never takes configuration as arguments.

### Offline queue

GPS works without a signal — the satellites do not care. What stops is the upload.

So a fix that cannot be sent goes into `src/lib/queue.js` (AsyncStorage, capped at 500, newest kept) and is uploaded later through the API's batch endpoint.

Three details matter:

- **Oldest first.** The server replays geofence transitions in the order it receives them, so an out-of-order backlog would produce arrivals and departures that never happened.
- **Chunked, and persisted after each chunk.** If the network dies halfway, the rest is still queued, and the server's unique `(device, timestamp)` index deduplicates anything sent twice.
- **A 4xx drops the chunk.** A revoked token or a too-old point will never be accepted, and retrying forever would block every newer fix behind it.

### Reporting on a schedule

`watchPositionAsync` alone is not enough, and getting this wrong is why an
early build only reported when you pressed the button. Its `distanceInterval`
is a *threshold* — "fire once you have moved this far" — so a phone on a desk
never triggers it, and its `timeInterval` is Android-only, so on iOS the
callback is purely distance-driven.

So tracking runs two mechanisms:

- a **timer** calling `getCurrentPositionAsync` every interval, which is
  deterministic on both platforms and works standing still — this is the
  guarantee;
- the **watcher** with `distanceInterval: 0` alongside it, purely so movement
  appears without waiting for the next tick.

A throttle stops the two double-reporting, and an in-flight guard skips a tick
rather than stacking requests when a cold GPS lock outlasts the interval. The
background task takes the same approach: `distanceInterval: 0`, so a stationary
device still reports instead of silently looking offline.

The interval is configurable in Settings (15 s to 15 min, default 30 s) and
changing it restarts whichever mechanism is running, so it takes effect at once.

### Live updates without pulling to refresh

The tracker exposes `onFixReported`, and the app subscribes to it — so the moment a position is sent or queued, the screen reflects it. A slow interval remains as a backstop, because the background task reports from a JavaScript context the UI cannot hear, and its writes are only visible by re-reading storage.

### What the server decides

The owner's tracking switch lives on the server. The app asks `GET /devices/self` on launch, and if a report comes back `403` the tracker stops itself rather than arguing. A `401` means the device was deleted or its token rotated, and the app unlinks locally and says so.

---

## Layout

```
App.js                      state-machine navigation
src/
├── theme.js                same palette as the web dashboard
├── lib/
│   ├── api.js              user + device API clients, timeouts, NetworkError
│   ├── fix.js              expo-location reading -> API payload (no native imports)
│   ├── queue.js            offline queue and batch flush
│   └── storage.js          SecureStore for secrets, AsyncStorage for the rest
├── tracking/
│   ├── task.js             background task registration
│   └── tracker.js          permissions, start/stop, report one fix
├── context/OrbitContext.js app state
├── context/DashboardContext.js  devices, geofences, alerts + Socket.IO
├── navigation/RootNavigator.js  bottom tabs and stacks
├── components/
│   ├── ui.js               Card, Button, Field, PulseDot…
│   └── OrbitMap.js         Leaflet in a WebView, no API key
└── screens/                SignIn, RegisterDevice, Map, Devices,
                            DeviceDetail, Geofences, Alerts,
                            Tracking, Settings
```

`fix.js` is deliberately free of native imports. It is the one place the two data shapes differ, so it is the one place a coordinate could get flipped — keeping it pure means it can be tested outside a device, which is how the `accuracy: -1` bug below was caught.

## Verification

`npx expo-doctor` passes 21/21 and the app bundles cleanly for Android (621 modules).

The device protocol was tested against the live API using the app's real `toFix`: mobile login and refresh rotation, device registration, `devices/self`, heartbeat, single and batch reporting, replay deduplication, the owner's kill switch returning 403, and the token dying on unlink — 38 assertions, all passing.

That run caught a genuine bug: both platforms report `accuracy: -1` when they cannot determine it, and the API validates accuracy as non-negative, so an otherwise good position would have been rejected. `fix.js` now omits it, as it already did for speed and heading.

## Running in Expo Go

Expo Go **cannot run background location** — `TaskManager` is unavailable on Android there, and background execution is unsupported on iOS. Rather than failing, the app checks `TaskManager.isAvailableAsync()` and falls back to a foreground watcher, then says so: the status card reads *While app is open* and a banner explains why. Positions still reach your dashboard; reporting just stops when you leave the app.

Everything else — the map, devices, geofences, alerts, live socket updates — works in Expo Go.

Expo Go must match the SDK. SDK 57 needs Expo Go 57.x, which the Play Store often lags behind; the matching APK is on the [expo-go-releases](https://github.com/expo/expo-go-releases/releases) page.

## Not built yet

Push notifications (alerts arrive over the socket while the app is open, but the phone gets no system notification when it is closed), share-link management, and editing an existing geofence from the phone.
