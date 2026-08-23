import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { OrbitMap, LayerSwitcher } from "../components/OrbitMap";
import { PulseDot } from "../components/ui";
import { useDashboard } from "../context/DashboardContext";
import * as api from "../lib/api";
import * as tracker from "../tracking/tracker";
import { colors, radius, spacing } from "../theme";
import {
  relativeTime,
  formatDistance,
  formatDuration,
  arrivalTime,
} from "../lib/time";

const MODES = [
  { value: "driving", label: "Drive", icon: "car-outline" },
  { value: "walking", label: "Walk", icon: "walk-outline" },
  { value: "cycling", label: "Cycle", icon: "bicycle-outline" },
];

export const MapScreen = ({ navigation }) => {
  const { devices, sharedDevices, geofences, connected } = useDashboard();

  const [showGeofences, setShowGeofences] = useState(true);
  const [layer, setLayer] = useState("dark");
  const [layersOpen, setLayersOpen] = useState(false);
  const [focus, setFocus] = useState(null);
  const [fitToken, setFitToken] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  // Directions.
  const [destination, setDestination] = useState(null);
  const [mode, setMode] = useState("driving");
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);

  // Your devices and the ones other people share, drawn together but never
  // merged in state - the shared ones carry no controls.
  const allDevices = useMemo(
    () => [...devices, ...sharedDevices],
    [devices, sharedDevices]
  );

  const positioned = useMemo(
    () => allDevices.filter((device) => device.lastLocation),
    [allDevices]
  );

  const online = positioned.filter((device) => device.isOnline).length;
  const selected = allDevices.find((device) => device.id === selectedId);

  const focusDevice = (deviceId) => {
    const device = allDevices.find((entry) => entry.id === deviceId);

    setSelectedId(deviceId);

    if (device?.lastLocation) {
      setFocus({
        latitude: device.lastLocation.latitude,
        longitude: device.lastLocation.longitude,
        token: Date.now(),
      });
    }
  };

  /**
   * "Go here" — routes from this phone to the selected device.
   *
   * The phone's own position is asked for at the moment it is needed rather
   * than on mount: a map that demands your location before showing anything is
   * exactly the pattern Orbit avoids.
   */
  const startDirections = useCallback(
    async (device, travelMode = mode) => {
      if (!device?.lastLocation) {
        return;
      }

      setDestination({
        latitude: device.lastLocation.latitude,
        longitude: device.lastLocation.longitude,
        label: device.name,
      });
      setRoute(null);
      setRouteError(null);
      setRouteLoading(true);

      try {
        const permission = await tracker.requestPermissions({ background: false });

        if (!permission.granted) {
          setRouteError("Orbit needs your location to route from here.");
          setRouteLoading(false);

          return;
        }

        const position = await tracker.getCurrentPosition();

        const data = await api.getDirections({
          from: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          to: {
            latitude: device.lastLocation.latitude,
            longitude: device.lastLocation.longitude,
          },
          mode: travelMode,
        });

        setRoute(data.route);
      } catch (error) {
        setRouteError(error.message);
      } finally {
        setRouteLoading(false);
      }
    },
    [mode]
  );

  const changeMode = (next) => {
    setMode(next);

    if (selected) {
      startDirections(selected, next);
    }
  };

  const clearDirections = () => {
    setDestination(null);
    setRoute(null);
    setRouteError(null);
  };

  return (
    <View style={styles.container}>
      <OrbitMap
        devices={allDevices}
        geofences={showGeofences ? geofences : []}
        route={route}
        destination={destination}
        focus={focus}
        layer={layer}
        fit={fitToken > 0}
        onSelectDevice={focusDevice}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topBar} pointerEvents="box-none">
        <View style={styles.pill}>
          <PulseDot
            active={connected}
            color={connected ? colors.positive : colors.warning}
            size={8}
          />
          <Text style={styles.pillText}>
            {online} of {positioned.length} online
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => setLayersOpen((value) => !value)}
            style={[styles.iconButton, layersOpen && styles.iconButtonActive]}
          >
            <Ionicons
              name="layers-outline"
              size={18}
              color={layersOpen ? colors.accent : colors.inkMuted}
            />
          </Pressable>
          <Pressable
            onPress={() => setShowGeofences((value) => !value)}
            style={[styles.iconButton, showGeofences && styles.iconButtonActive]}
          >
            <Ionicons
              name="scan-outline"
              size={18}
              color={showGeofences ? colors.accent : colors.inkMuted}
            />
          </Pressable>
          <Pressable
            onPress={() => {
              setFocus(null);
              setSelectedId(null);
              clearDirections();
              setFitToken((value) => value + 1);
            }}
            style={styles.iconButton}
          >
            <Ionicons name="scan" size={18} color={colors.inkMuted} />
          </Pressable>
        </View>
      </View>

      {layersOpen && (
        <LayerSwitcher
          layer={layer}
          onChange={(key) => {
            setLayer(key);
            setLayersOpen(false);
          }}
          style={styles.layerSwitcher}
        />
      )}

      {/* Directions take over the bottom sheet, because once you have asked for
          a route it is the only thing you care about. */}
      {destination ? (
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Ionicons name="navigate" size={15} color={colors.accent} />
            <Text style={styles.sheetName} numberOfLines={1}>
              {destination.label}
            </Text>
            <Pressable onPress={clearDirections} hitSlop={10}>
              <Ionicons name="close" size={18} color={colors.inkFaint} />
            </Pressable>
          </View>

          <View style={styles.modes}>
            {MODES.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => changeMode(option.value)}
                style={[styles.mode, mode === option.value && styles.modeActive]}
              >
                <Ionicons
                  name={option.icon}
                  size={14}
                  color={mode === option.value ? colors.accent : colors.inkMuted}
                />
                <Text
                  style={[
                    styles.modeText,
                    mode === option.value && { color: colors.accent },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {routeLoading ? (
            <Text style={styles.routeStatus}>Finding a route…</Text>
          ) : routeError ? (
            <Text style={[styles.routeStatus, { color: colors.danger }]}>
              {routeError}
            </Text>
          ) : route ? (
            <>
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Distance</Text>
                  <Text style={styles.statValue}>{formatDistance(route.distance)}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Time</Text>
                  <Text style={styles.statValue}>{formatDuration(route.duration)}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Arrive</Text>
                  <Text style={styles.statValue}>{arrivalTime(route.duration)}</Text>
                </View>
              </View>

              {/* A straight-line estimate must never read as a real route. */}
              {route.provider === "straight-line" && (
                <Text style={styles.estimate}>
                  {route.note || "Estimated in a straight line."}
                </Text>
              )}

              {route.steps?.length > 0 && (
                <Text style={styles.firstStep} numberOfLines={2}>
                  Next: {route.steps[0].instruction}
                </Text>
              )}
            </>
          ) : null}
        </View>
      ) : selected ? (
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <PulseDot active={selected.isOnline} size={10} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.sheetName} numberOfLines={1}>
                {selected.name}
              </Text>
              <Text style={styles.sheetMeta} numberOfLines={1}>
                {selected.shared ? `Shared by ${selected.sharedBy} · ` : ""}
                {selected.isOnline ? "Online" : "Offline"}
                {selected.batteryLevel !== null ? ` · ${selected.batteryLevel}%` : ""}
                {" · "}
                {relativeTime(selected.lastLocation?.timestamp)}
              </Text>
            </View>
            <Pressable onPress={() => setSelectedId(null)} hitSlop={10}>
              <Ionicons name="close" size={18} color={colors.inkFaint} />
            </Pressable>
          </View>

          <View style={styles.sheetActions}>
            <Pressable
              onPress={() => startDirections(selected)}
              style={[styles.sheetButton, styles.sheetButtonPrimary]}
            >
              <Ionicons name="navigate-outline" size={15} color={colors.void} />
              <Text style={styles.sheetButtonTextPrimary}>Go here</Text>
            </Pressable>

            {/* A device somebody else shares has no detail screen: there is
                nothing there this account is allowed to do. */}
            {!selected.shared && (
              <Pressable
                onPress={() =>
                  navigation.navigate("Devices", {
                    screen: "DeviceDetail",
                    params: { deviceId: selected.id },
                  })
                }
                style={styles.sheetButton}
              >
                <Text style={styles.sheetButtonText}>Details</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}

      {positioned.length === 0 && (
        <View style={styles.empty} pointerEvents="none">
          <Text style={styles.emptyTitle}>No positions yet</Text>
          <Text style={styles.emptyBody}>
            Devices appear here once they report where they are.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.void },
  topBar: {
    position: "absolute",
    top: spacing(3),
    left: spacing(3),
    right: spacing(3),
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    backgroundColor: "rgba(6,7,10,0.85)",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  pillText: { fontSize: 12, color: colors.inkMuted },
  actions: { flexDirection: "row", gap: spacing(2), marginLeft: "auto" },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(6,7,10,0.85)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  iconButtonActive: { borderColor: `${colors.accent}55` },
  layerSwitcher: { position: "absolute", top: spacing(14), right: spacing(3) },
  sheet: {
    position: "absolute",
    left: spacing(3),
    right: spacing(3),
    bottom: spacing(3),
    backgroundColor: colors.raised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing(4),
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  sheetName: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
  sheetMeta: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  sheetActions: { flexDirection: "row", gap: spacing(2), marginTop: spacing(3) },
  sheetButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(2),
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.overlay,
  },
  sheetButtonPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  sheetButtonText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  sheetButtonTextPrimary: { fontSize: 13, fontWeight: "600", color: colors.void },
  modes: { flexDirection: "row", gap: spacing(2), marginTop: spacing(3) },
  mode: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(1.5),
    paddingVertical: spacing(2),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modeActive: { borderColor: `${colors.accent}55`, backgroundColor: `${colors.accent}12` },
  modeText: { fontSize: 12, color: colors.inkMuted },
  routeStatus: {
    fontSize: 12,
    color: colors.inkMuted,
    textAlign: "center",
    paddingVertical: spacing(4),
  },
  stats: {
    flexDirection: "row",
    marginTop: spacing(3),
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing(3),
  },
  stat: { flex: 1 },
  statLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.inkFaint,
  },
  statValue: { fontSize: 14, fontWeight: "700", color: colors.ink, marginTop: 2 },
  estimate: { fontSize: 11, color: colors.warning, marginTop: spacing(3) },
  firstStep: { fontSize: 12, color: colors.inkMuted, marginTop: spacing(3) },
  empty: {
    position: "absolute",
    top: "45%",
    left: spacing(6),
    right: spacing(6),
    alignItems: "center",
  },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
  emptyBody: {
    fontSize: 13,
    color: colors.inkMuted,
    textAlign: "center",
    marginTop: spacing(2),
  },
});
