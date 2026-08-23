import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { OrbitMap } from "../components/OrbitMap";
import { Button, Card, Divider, PulseDot, Row } from "../components/ui";
import { useDashboard } from "../context/DashboardContext";
import { useOrbit } from "../context/OrbitContext";
import * as api from "../lib/api";
import { colors, radius, spacing } from "../theme";
import { absoluteTime, formatAccuracy, formatDistance, relativeTime } from "../lib/time";
import { batteryColor, deviceIconName, deviceTypeLabel } from "../lib/deviceMeta";
import { distanceMeters } from "../lib/geo";

const RANGES = [
  { hours: 24, label: "24h" },
  { hours: 72, label: "3d" },
  { hours: 168, label: "7d" },
];

export const DeviceDetailScreen = ({ route, navigation }) => {
  const { deviceId } = route.params;
  const { devices, setDeviceTracking, removeDevice } = useDashboard();
  const { device: thisDevice } = useOrbit();

  const device = devices.find((entry) => entry.id === deviceId);

  const [trail, setTrail] = useState([]);
  const [hours, setHours] = useState(24);
  const [loadingTrail, setLoadingTrail] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: device?.name || "Device" });
  }, [navigation, device?.name]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingTrail(true);

      try {
        const from = new Date(Date.now() - hours * 60 * 60 * 1000);
        const data = await api.getHistory(deviceId, { from, limit: 500 });

        // Oldest-first, so the path draws in the direction of travel.
        if (!cancelled) {
          setTrail([...data.locations].reverse());
        }
      } catch {
        if (!cancelled) {
          setTrail([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingTrail(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deviceId, hours]);

  if (!device) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingTitle}>Device not found</Text>
        <Text style={styles.missingBody}>
          It may have been deleted from another client.
        </Text>
      </View>
    );
  }

  const isThisPhone = thisDevice?.id === device.id;

  const travelled = trail.reduce(
    (total, fix, index) =>
      index === 0 ? 0 : total + distanceMeters(trail[index - 1], fix),
    0
  );

  const toggleTracking = async (next) => {
    setBusy(true);

    try {
      await setDeviceTracking(device.id, next);
    } catch (error) {
      Alert.alert("Could not change tracking", error.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      `Delete ${device.name}?`,
      isThisPhone
        ? "This is the phone you are holding. Deleting it also unlinks Orbit on this device, along with its entire location history."
        : "Its entire location history and any share links pointing at it are deleted too.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy(true);

            try {
              await removeDevice(device.id);
              navigation.goBack();
            } catch (error) {
              Alert.alert("Could not delete", error.message);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.void }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.mapWrap}>
        {device.lastLocation ? (
          <OrbitMap
            devices={[device]}
            trail={trail}
            showAccuracy
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={styles.noMap}>
            <Ionicons name="location-outline" size={22} color={colors.inkFaint} />
            <Text style={styles.noMapText}>No position reported yet</Text>
          </View>
        )}
      </View>

      <View style={styles.ranges}>
        {RANGES.map((range) => (
          <Text
            key={range.hours}
            onPress={() => setHours(range.hours)}
            style={[styles.range, hours === range.hours && styles.rangeActive]}
          >
            {range.label}
          </Text>
        ))}
        <Text style={styles.rangeMeta}>
          {loadingTrail
            ? "Loading"
            : trail.length
              ? `${trail.length} points · ${formatDistance(travelled)}`
              : "No history in range"}
        </Text>
      </View>

      <Card>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons
              name={deviceIconName(device.type)}
              size={20}
              color={device.isOnline ? colors.accent : colors.inkFaint}
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{device.name}</Text>
              <PulseDot active={device.isOnline} size={9} />
            </View>
            <Text style={styles.sub}>
              {deviceTypeLabel(device.type)}
              {device.model ? ` · ${device.model}` : ""}
            </Text>
          </View>
        </View>

        <Divider />

        <Row
          label="Status"
          value={device.isOnline ? "Online" : "Offline"}
          valueColor={device.isOnline ? colors.positive : colors.inkMuted}
        />
        <Row label="Last seen" value={relativeTime(device.lastSeen)} />
        <Row
          label="Battery"
          value={device.batteryLevel === null ? "-" : `${device.batteryLevel}%`}
          valueColor={batteryColor(device.batteryLevel)}
        />
        {device.lastLocation && (
          <>
            <Row
              label="Position"
              value={`${device.lastLocation.latitude.toFixed(5)}, ${device.lastLocation.longitude.toFixed(5)}`}
            />
            <Row label="Accuracy" value={formatAccuracy(device.lastLocation.accuracy)} />
            <Row label="Fix taken" value={absoluteTime(device.lastLocation.timestamp)} />
          </>
        )}
        <Row label="Registered" value={absoluteTime(device.createdAt)} />
      </Card>

      <Card style={{ marginTop: spacing(4) }}>
        <View style={styles.trackRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.trackTitle}>Location tracking</Text>
            <Text style={styles.trackBody}>
              When off, Orbit refuses this device&apos;s reports at the server —
              not just in its app.
            </Text>
          </View>
          <Switch
            value={device.trackingEnabled}
            disabled={busy}
            onValueChange={toggleTracking}
            trackColor={{ false: colors.lineStrong, true: `${colors.accent}88` }}
            thumbColor={device.trackingEnabled ? colors.accent : colors.inkFaint}
            ios_backgroundColor={colors.lineStrong}
          />
        </View>
      </Card>

      <Button
        label={isThisPhone ? "Delete this phone from Orbit" : `Delete ${device.name}`}
        variant="danger"
        onPress={confirmDelete}
        loading={busy}
        style={{ marginTop: spacing(5) }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: spacing(4), paddingBottom: spacing(10) },
  mapWrap: {
    height: 260,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#05070d",
  },
  noMap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: spacing(2) },
  noMapText: { fontSize: 13, color: colors.inkFaint },
  ranges: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    paddingVertical: spacing(3),
  },
  range: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.inkMuted,
    fontSize: 12,
    overflow: "hidden",
  },
  rangeActive: {
    color: colors.accent,
    borderColor: `${colors.accent}55`,
    backgroundColor: `${colors.accent}12`,
  },
  rangeMeta: { marginLeft: "auto", fontSize: 11, color: colors.inkFaint },
  header: { flexDirection: "row", alignItems: "center", gap: spacing(3), marginBottom: spacing(2) },
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
  name: { fontSize: 17, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  trackRow: { flexDirection: "row", alignItems: "center", gap: spacing(4) },
  trackTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  trackBody: { fontSize: 12, lineHeight: 18, color: colors.inkMuted, marginTop: spacing(1.5) },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.void },
  missingTitle: { fontSize: 16, fontWeight: "600", color: colors.ink },
  missingBody: { fontSize: 13, color: colors.inkMuted, marginTop: spacing(2) },
});
