import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { colors, radius, spacing } from "../theme";

/**
 * The map, as Leaflet inside a WebView.
 *
 * react-native-maps would mean a Google Maps API key on Android. The web
 * dashboard deliberately avoids one by using free basemaps, and doing the same
 * here keeps the project key-free and the two clients looking identical.
 */

export const MAP_LAYERS = {
  dark: { label: "Dark" },
  street: { label: "Street" },
  satellite: { label: "Satellite" },
  terrain: { label: "Terrain" },
};

export const LAYER_KEYS = Object.keys(MAP_LAYERS);

// Injected once. After that the RN side pushes data by calling orbitUpdate,
// which is far cheaper than re-rendering the whole document.
const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin:0; padding:0; height:100%; width:100%; background:#05070d; }
    .leaflet-control-attribution { background:rgba(6,7,10,.75)!important; color:#5d6779!important; font-size:9px!important; }
    .leaflet-control-attribution a { color:#97a1b3!important; }
    .leaflet-control-zoom a { background:#151922!important; color:#97a1b3!important; border:1px solid #1e232e!important; }
    .orbit-marker { position:relative; width:18px; height:18px; }
    .orbit-marker__core {
      position:absolute; inset:0; border-radius:999px;
      border:2px solid rgba(6,7,10,.9); background:currentColor;
      box-shadow:0 0 0 1px currentColor, 0 0 16px 2px currentColor;
    }
    .orbit-marker__ring {
      position:absolute; inset:0; border-radius:999px; background:currentColor;
      opacity:.55; animation:pulse 2.4s cubic-bezier(.4,0,.6,1) infinite;
    }
    @keyframes pulse { 0%{transform:scale(.85);opacity:.7} 70%,100%{transform:scale(2.2);opacity:0} }
    .lbl { font:600 11px -apple-system,Roboto,sans-serif; color:#f2f5f9; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([20, 0], 2);

  // Every one of these is usable without an account or a card on file, which
  // is the whole reason Orbit does not depend on Google Maps. Attribution is
  // the condition each provider sets for that, so it travels with the layer.
  var LAYERS = {
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
      labels: 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 20
    },
    street: {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      labels: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
      attribution: 'Imagery &copy; Esri &middot; Labels &copy; CARTO', maxZoom: 19
    },
    terrain: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap, OpenTopoMap (CC-BY-SA)', maxZoom: 17
    }
  };

  var baseTiles = null;
  var labelTiles = null;
  var currentLayer = null;

  function setLayer(key) {
    if (key === currentLayer) return;
    var config = LAYERS[key] || LAYERS.dark;

    if (baseTiles) map.removeLayer(baseTiles);
    if (labelTiles) { map.removeLayer(labelTiles); labelTiles = null; }

    baseTiles = L.tileLayer(config.url, {
      maxZoom: config.maxZoom, attribution: config.attribution
    }).addTo(map);

    if (config.labels) {
      labelTiles = L.tileLayer(config.labels, { maxZoom: config.maxZoom }).addTo(map);
    }

    currentLayer = key;
  }

  setLayer('dark');

  var layers = L.layerGroup().addTo(map);
  var hasFitted = false;

  function send(payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }

  function icon(color, pulse) {
    return L.divIcon({
      className: '', iconSize: [18, 18], iconAnchor: [9, 9],
      html: '<div class="orbit-marker" style="color:' + color + '">' +
            (pulse ? '<span class="orbit-marker__ring"></span>' : '') +
            '<span class="orbit-marker__core"></span></div>'
    });
  }

  function pin(color) {
    return L.divIcon({
      className: '', iconSize: [22, 22], iconAnchor: [11, 22],
      html: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="' + color +
            '" stroke-width="2.5" style="filter:drop-shadow(0 0 6px ' + color + ')">' +
            '<path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z" fill="#06070a"/>' +
            '<circle cx="12" cy="10" r="2.5" fill="' + color + '" stroke="none"/></svg>'
    });
  }

  window.orbitUpdate = function (raw) {
    var state = typeof raw === 'string' ? JSON.parse(raw) : raw;

    if (state.layer) setLayer(state.layer);

    layers.clearLayers();
    var points = [];

    (state.geofences || []).forEach(function (fence) {
      var color = fence.color || '#a78bfa';
      L.circle([fence.latitude, fence.longitude], {
        radius: fence.radius, color: color, weight: 1.5,
        opacity: fence.active ? .75 : .3,
        fillColor: color, fillOpacity: fence.active ? .08 : .03
      }).addTo(layers).bindPopup('<b>' + fence.name + '</b>');
      points.push([fence.latitude, fence.longitude]);
    });

    if (state.trail && state.trail.length > 1) {
      var line = state.trail.map(function (f) { return [f.latitude, f.longitude]; });
      L.polyline(line, { color:'#22d3ee', weight:8, opacity:.12 }).addTo(layers);
      L.polyline(line, { color:'#22d3ee', weight:2, opacity:.9 }).addTo(layers);
      line.forEach(function (p) { points.push(p); });
    }

    // The active route is drawn heavier than a history trail, because it is an
    // instruction rather than a record.
    if (state.route && state.route.geometry && state.route.geometry.length > 1) {
      var path = state.route.geometry.map(function (p) { return [p.latitude, p.longitude]; });
      L.polyline(path, { color:'#06070a', weight:11, opacity:.55 }).addTo(layers);
      L.polyline(path, {
        color:'#22d3ee', weight:5, opacity:.95,
        dashArray: state.route.provider === 'straight-line' ? '8 10' : null
      }).addTo(layers);
      path.forEach(function (p) { points.push(p); });
    }

    if (state.destination) {
      L.marker([state.destination.latitude, state.destination.longitude], { icon: pin('#22d3ee') })
        .addTo(layers)
        .bindTooltip(state.destination.label || 'Destination', {
          permanent: true, direction: 'top', offset: [0, -22], className: 'lbl'
        });
      points.push([state.destination.latitude, state.destination.longitude]);
    }

    (state.devices || []).forEach(function (d) {
      if (!d.lastLocation) return;
      // Someone else's device is violet, so it is never mistaken for one of
      // your own that you can control.
      var color = d.shared ? '#a78bfa' : (d.isOnline ? '#34d399' : '#5d6779');
      var p = [d.lastLocation.latitude, d.lastLocation.longitude];

      if (d.lastLocation.accuracy && state.showAccuracy !== false) {
        L.circle(p, {
          radius: d.lastLocation.accuracy, color: color, weight: 1,
          opacity: .25, fillColor: color, fillOpacity: .06
        }).addTo(layers);
      }

      L.marker(p, { icon: icon(color, d.isOnline) })
        .addTo(layers)
        .bindTooltip(d.name, { permanent: true, direction: 'top', offset: [0, -12], className: 'lbl' })
        .on('click', function () { send({ type: 'select', id: d.id }); });

      points.push(p);
    });

    // Fitting on every update would fight the user the moment they pan, so it
    // only happens on the first paint or when explicitly asked.
    if (points.length && (state.fit || !hasFitted)) {
      if (points.length === 1) {
        map.setView(points[0], Math.max(map.getZoom(), 15));
      } else {
        map.fitBounds(L.latLngBounds(points).pad(.25));
      }
      hasFitted = true;
    }

    if (state.focus) {
      map.flyTo([state.focus.latitude, state.focus.longitude], 16, { duration: .8 });
    }
  };

  send({ type: 'ready' });
</script>
</body>
</html>`;

export const LayerSwitcher = ({ layer, onChange, style }) => (
  <View style={[styles.switcher, style]}>
    {LAYER_KEYS.map((key) => (
      <Pressable
        key={key}
        onPress={() => onChange(key)}
        style={[styles.switcherItem, layer === key && styles.switcherItemActive]}
      >
        <Text
          style={[styles.switcherText, layer === key && styles.switcherTextActive]}
        >
          {MAP_LAYERS[key].label}
        </Text>
      </Pressable>
    ))}
  </View>
);

export const OrbitMap = ({
  devices = [],
  geofences = [],
  trail = null,
  route = null,
  destination = null,
  focus = null,
  layer = "dark",
  showAccuracy = true,
  fit = false,
  onSelectDevice,
  style,
}) => {
  const webRef = useRef(null);
  const [ready, setReady] = useState(false);

  const payload = useMemo(
    () =>
      JSON.stringify({
        devices,
        geofences,
        trail,
        route,
        destination,
        focus,
        layer,
        showAccuracy,
        fit,
      }),
    [devices, geofences, trail, route, destination, focus, layer, showAccuracy, fit]
  );

  // Pushed rather than re-rendered: reloading the document would drop the
  // user's pan and zoom on every incoming position.
  useEffect(() => {
    if (!ready) {
      return;
    }

    webRef.current?.injectJavaScript(
      `window.orbitUpdate(${JSON.stringify(payload)}); true;`
    );
  }, [ready, payload]);

  const onMessage = (event) => {
    let message;

    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    if (message.type === "ready") {
      setReady(true);
      return;
    }

    if (message.type === "select") {
      onSelectDevice?.(message.id);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webRef}
        source={{ html: HTML }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        style={styles.web}
        containerStyle={styles.web}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
        startInLoadingState
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden", backgroundColor: "#05070d" },
  web: { flex: 1, backgroundColor: "#05070d" },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#05070d",
  },
  switcher: {
    flexDirection: "row",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(6,7,10,0.85)",
    overflow: "hidden",
  },
  switcherItem: { paddingHorizontal: spacing(2.5), paddingVertical: spacing(1.5) },
  switcherItemActive: { backgroundColor: `${colors.accent}26` },
  switcherText: { fontSize: 11, color: colors.inkMuted },
  switcherTextActive: { color: colors.accent, fontWeight: "600" },
});

export default OrbitMap;
