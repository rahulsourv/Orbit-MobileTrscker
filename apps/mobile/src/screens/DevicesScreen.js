import { useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { PulseDot } from "../components/ui";
import { useDashboard } from "../context/DashboardContext";
import { useOrbit } from "../context/OrbitContext";
import { colors, radius, spacing } from "../theme";
import { relativeTime } from "../lib/time";
import { batteryColor, deviceIconName, deviceTypeLabel } from "../lib/deviceMeta";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
];

export const DevicesScreen = ({ navigation }) => {
  const { devices, loading, refresh } = useDashboard();
  const { device: thisDevice } = useOrbit();

  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const visible = devices.filter((device) => {
    if (filter === "online") return device.isOnline;
    if (filter === "offline") return !device.isOnline;

    return true;
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const counts = {
    all: devices.length,
    online: devices.filter((device) => device.isOnline).length,
    offline: devices.filter((device) => !device.isOnline).length,
  };

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        {FILTERS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setFilter(option.value)}
            style={[styles.filter, filter === option.value && styles.filterActive]}
          >
            <Text
              style={[
                styles.filterText,
                filter === option.value && styles.filterTextActive,
              ]}
            >
              {option.label} {counts[option.value]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => navigation.navigate("Geofences")}
        style={styles.geofenceLink}
      >
        <Ionicons name="scan-outline" size={16} color={colors.accent} />
        <Text style={styles.geofenceLinkText}>Geofences</Text>
        <Ionicons name="chevron-forward" size={15} color={colors.inkFaint} />
      </Pressable>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {loading ? "Loading devices" : "No devices"}
            </Text>
            {!loading && (
              <Text style={styles.emptyBody}>
                Register a device from this app or the web dashboard and it
                appears here.
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              navigation.navigate("DeviceDetail", { deviceId: item.id })
            }
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View
              style={[
                styles.iconWrap,
                item.isOnline && { borderColor: `${colors.accent}33` },
              ]}
            >
              <Ionicons
                name={deviceIconName(item.type)}
                size={20}
                color={item.isOnline ? colors.accent : colors.inkFaint}
              />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <PulseDot active={item.isOnline} size={8} />
                {/* Knowing which entry is the phone in your hand matters when
                    every device is called something like "Pixel 8". */}
                {thisDevice?.id === item.id && (
                  <View style={styles.thisTag}>
                    <Text style={styles.thisTagText}>This device</Text>
                  </View>
                )}
              </View>

              <Text style={styles.meta} numberOfLines={1}>
                {deviceTypeLabel(item.type)}
                {item.model ? ` · ${item.model}` : ""}
              </Text>

              <View style={styles.footRow}>
                <Text style={styles.foot}>
                  {item.isOnline ? "Online" : relativeTime(item.lastSeen)}
                </Text>
                {item.batteryLevel !== null && (
                  <Text style={[styles.foot, { color: batteryColor(item.batteryLevel) }]}>
                    {item.batteryLevel}%
                  </Text>
                )}
                {!item.trackingEnabled && (
                  <Text style={[styles.foot, { color: colors.warning }]}>
                    Tracking off
                  </Text>
                )}
              </View>
            </View>

            <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
          </Pressable>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.void },
  filters: {
    flexDirection: "row",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
    paddingBottom: spacing(2),
  },
  filter: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterActive: { backgroundColor: colors.overlay, borderColor: colors.lineStrong },
  filterText: { fontSize: 12, color: colors.inkMuted },
  filterTextActive: { color: colors.ink },
  geofenceLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
    marginHorizontal: spacing(4),
    marginTop: spacing(1),
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(3),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.raised,
  },
  geofenceLinkText: { flex: 1, fontSize: 13, color: colors.ink, fontWeight: "500" },
  list: { padding: spacing(4), paddingTop: spacing(3), gap: spacing(3) },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    backgroundColor: colors.raised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing(4),
  },
  cardPressed: { opacity: 0.75 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.line,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing(2) },
  name: { fontSize: 15, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  thisTag: {
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: `${colors.accent}1a`,
  },
  thisTagText: { fontSize: 10, color: colors.accent, fontWeight: "600" },
  meta: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  footRow: { flexDirection: "row", gap: spacing(3), marginTop: spacing(2) },
  foot: { fontSize: 11, color: colors.inkMuted },
  empty: { alignItems: "center", paddingVertical: spacing(16) },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
  emptyBody: {
    fontSize: 13,
    color: colors.inkMuted,
    textAlign: "center",
    marginTop: spacing(2),
    paddingHorizontal: spacing(6),
  },
});
