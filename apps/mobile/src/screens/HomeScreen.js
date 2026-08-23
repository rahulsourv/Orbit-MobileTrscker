import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Card, Divider, OrbitMark, PulseDot } from "../components/ui";
import { OrbitMap } from "../components/OrbitMap";
import { useDashboard } from "../context/DashboardContext";
import { useOrbit } from "../context/OrbitContext";
import { colors, radius, spacing } from "../theme";
import { relativeTime } from "../lib/time";
import { batteryColor, deviceIconName, notificationMeta } from "../lib/deviceMeta";

const greeting = () => {
  const hour = new Date().getHours();

  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";

  return "Good night";
};

const Stat = ({ icon, label, value, tone }) => (
  <View style={styles.stat}>
    <View style={[styles.statIcon, { backgroundColor: `${tone}1a` }]}>
      <Ionicons name={icon} size={15} color={tone} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

/**
 * The phone's dashboard.
 *
 * Everything worth knowing at a glance without choosing a tab first: whether
 * this phone is sharing, how many devices are up, where they are, what happened
 * recently, and who is asking for something.
 */
export const HomeScreen = ({ navigation }) => {
  const { devices, sharedDevices, notifications, incoming, refresh, connected } =
    useDashboard();
  const {
    user,
    tracking,
    trackingMode,
    device: thisDevice,
    start,
    stop,
  } = useOrbit();

  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const allDevices = useMemo(
    () => [...devices, ...sharedDevices],
    [devices, sharedDevices]
  );

  const positioned = allDevices.filter((device) => device.lastLocation);
  const online = allDevices.filter((device) => device.isOnline).length;
  const lowBattery = devices.filter(
    (device) => device.batteryLevel !== null && device.batteryLevel < 20
  ).length;

  const pending = incoming.filter((entry) => entry.status === "pending");
  const recent = notifications.slice(0, 4);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const toggleTracking = async (next) => {
    setBusy(true);
    await (next ? start() : stop());
    setBusy(false);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.void }}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
        />
      }
    >
      <View style={styles.header}>
        <OrbitMark size={30} />
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            {greeting()}
            {user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </Text>
          <Text style={styles.sub}>
            {online} of {allDevices.length} device
            {allDevices.length === 1 ? "" : "s"} online
          </Text>
        </View>
        <PulseDot
          active={connected}
          color={connected ? colors.positive : colors.warning}
          size={9}
        />
      </View>

      {/* Anything waiting on a decision goes above the fold. */}
      {pending.length > 0 && (
        <Pressable
          onPress={() => navigation.navigate("Alerts")}
          style={styles.pending}
        >
          <Ionicons name="person-add-outline" size={17} color={colors.accent} />
          <Text style={styles.pendingText}>
            {pending.length} person{pending.length === 1 ? "" : "s"} asking to see
            your location
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </Pressable>
      )}

      {/* This phone's own state, because it is the one device you can act on
          from here. */}
      {thisDevice && (
        <Card style={[styles.trackCard, tracking && styles.trackCardLive]}>
          <View style={styles.trackRow}>
            <PulseDot active={tracking} size={11} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.trackTitle, tracking && { color: colors.positive }]}>
                {tracking ? "This phone is sharing" : "This phone is not sharing"}
              </Text>
              <Text style={styles.trackSub}>
                {thisDevice.name}
                {tracking && trackingMode === "foreground"
                  ? " · while the app is open"
                  : ""}
              </Text>
            </View>
            <Switch
              value={tracking}
              disabled={busy || thisDevice.trackingEnabled === false}
              onValueChange={toggleTracking}
              trackColor={{ false: colors.lineStrong, true: `${colors.accent}88` }}
              thumbColor={tracking ? colors.accent : colors.inkFaint}
              ios_backgroundColor={colors.lineStrong}
            />
          </View>
        </Card>
      )}

      <View style={styles.stats}>
        <Stat icon="phone-portrait-outline" label="Devices" value={allDevices.length} tone={colors.accent} />
        <Stat icon="wifi-outline" label="Online" value={online} tone={colors.positive} />
        <Stat icon="navigate-outline" label="On map" value={positioned.length} tone={colors.violet} />
        <Stat
          icon="battery-dead-outline"
          label="Low"
          value={lowBattery}
          tone={lowBattery > 0 ? colors.warning : colors.inkFaint}
        />
      </View>

      <Pressable onPress={() => navigation.navigate("Map")} style={styles.mapCard}>
        {positioned.length ? (
          <>
            {/* Not interactive here: a tap should open the full map rather than
                fight the parent scroll view for the gesture. */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <OrbitMap devices={allDevices} style={StyleSheet.absoluteFill} />
            </View>
            <View style={styles.mapBadge}>
              <Ionicons name="expand-outline" size={13} color={colors.ink} />
              <Text style={styles.mapBadgeText}>Open map</Text>
            </View>
          </>
        ) : (
          <View style={styles.mapEmpty}>
            <Ionicons name="map-outline" size={22} color={colors.inkFaint} />
            <Text style={styles.mapEmptyText}>No positions reported yet</Text>
          </View>
        )}
      </Pressable>

      <Card style={{ marginTop: spacing(4) }}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Your devices</Text>
          <Pressable onPress={() => navigation.navigate("Devices")} hitSlop={8}>
            <Text style={styles.sectionLink}>All</Text>
          </Pressable>
        </View>
        <Divider />

        {allDevices.length === 0 ? (
          <Text style={styles.empty}>
            No devices yet. Add this phone from the Device tab.
          </Text>
        ) : (
          allDevices.slice(0, 5).map((device) => (
            <Pressable
              key={device.id}
              onPress={() =>
                device.shared
                  ? navigation.navigate("Map")
                  : navigation.navigate("Devices", {
                      screen: "DeviceDetail",
                      params: { deviceId: device.id },
                    })
              }
              style={styles.deviceRow}
            >
              <Ionicons
                name={deviceIconName(device.type)}
                size={17}
                color={device.isOnline ? colors.accent : colors.inkFaint}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.deviceName} numberOfLines={1}>
                  {device.name}
                </Text>
                <Text style={styles.deviceMeta} numberOfLines={1}>
                  {device.shared ? `Shared by ${device.sharedBy}` : null}
                  {device.shared ? " · " : ""}
                  {device.isOnline ? "Online" : relativeTime(device.lastSeen)}
                </Text>
              </View>
              {device.batteryLevel !== null && (
                <Text style={[styles.battery, { color: batteryColor(device.batteryLevel) }]}>
                  {device.batteryLevel}%
                </Text>
              )}
              <Ionicons name="chevron-forward" size={15} color={colors.inkFaint} />
            </Pressable>
          ))
        )}
      </Card>

      <Card style={{ marginTop: spacing(4) }}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          <Pressable onPress={() => navigation.navigate("Alerts")} hitSlop={8}>
            <Text style={styles.sectionLink}>All</Text>
          </Pressable>
        </View>
        <Divider />

        {recent.length === 0 ? (
          <Text style={styles.empty}>
            Battery warnings, arrivals and sign-ins will show up here.
          </Text>
        ) : (
          recent.map((item) => {
            const meta = notificationMeta(item.type);

            return (
              <View key={item.id} style={styles.alertRow}>
                <Ionicons name={meta.icon} size={15} color={meta.color} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.alertTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.alertTime}>{relativeTime(item.createdAt)}</Text>
                </View>
              </View>
            );
          })
        )}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: spacing(4), paddingBottom: spacing(10) },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    marginBottom: spacing(4),
  },
  greeting: { fontSize: 19, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },
  sub: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  pending: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
    padding: spacing(3.5),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: `${colors.accent}55`,
    backgroundColor: `${colors.accent}12`,
    marginBottom: spacing(3),
  },
  pendingText: { flex: 1, fontSize: 13, color: colors.ink, fontWeight: "500" },
  trackCard: { marginBottom: spacing(3) },
  trackCardLive: { borderColor: `${colors.positive}55` },
  trackRow: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  trackTitle: { fontSize: 14, fontWeight: "600", color: colors.inkMuted },
  trackSub: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  stats: { flexDirection: "row", gap: spacing(2), marginBottom: spacing(3) },
  stat: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.raised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing(3),
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing(1.5),
  },
  statValue: { fontSize: 16, fontWeight: "700", color: colors.ink },
  statLabel: { fontSize: 10, color: colors.inkFaint, marginTop: 1 },
  mapCard: {
    height: 190,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#05070d",
  },
  mapBadge: {
    position: "absolute",
    right: spacing(3),
    bottom: spacing(3),
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radius.pill,
    backgroundColor: "rgba(6,7,10,0.85)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  mapBadgeText: { fontSize: 11, color: colors.ink },
  mapEmpty: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: spacing(2) },
  mapEmptyText: { fontSize: 12, color: colors.inkFaint },
  sectionHead: { flexDirection: "row", alignItems: "center" },
  sectionTitle: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink },
  sectionLink: { fontSize: 12, color: colors.accent, fontWeight: "600" },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingVertical: spacing(2.5),
  },
  deviceName: { fontSize: 13, fontWeight: "500", color: colors.ink },
  deviceMeta: { fontSize: 11, color: colors.inkFaint, marginTop: 1 },
  battery: { fontSize: 11, fontWeight: "600" },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingVertical: spacing(2.5),
  },
  alertTitle: { fontSize: 13, color: colors.ink },
  alertTime: { fontSize: 11, color: colors.inkFaint, marginTop: 1 },
  empty: { fontSize: 12, color: colors.inkFaint, paddingVertical: spacing(3) },
});

export default HomeScreen;
