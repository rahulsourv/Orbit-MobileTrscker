import { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Button, Field, Input } from "../components/ui";
import { useDashboard } from "../context/DashboardContext";
import * as tracker from "../tracking/tracker";
import { colors, radius, spacing } from "../theme";
import { formatDistance } from "../lib/time";
import { distanceMeters } from "../lib/geo";

const RADII = [100, 250, 500, 1000, 2000];

export const GeofencesScreen = () => {
  const { geofences, devices, refresh, addGeofence, toggleGeofence, removeGeofence } =
    useDashboard();

  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const confirmDelete = (fence) => {
    Alert.alert(
      `Delete ${fence.name}?`,
      "You will stop receiving arrival and departure alerts for this area.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => removeGeofence(fence.id).catch(() => {}),
        },
      ]
    );
  };

  // Which devices sit inside right now, from their last known fix.
  const insideCount = (fence) =>
    devices.filter(
      (device) =>
        device.lastLocation &&
        (!fence.deviceIds.length || fence.deviceIds.includes(device.id)) &&
        distanceMeters(device.lastLocation, fence) <= fence.radius
    ).length;

  return (
    <View style={styles.container}>
      <FlatList
        data={geofences}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <Button
            label="New geofence"
            onPress={() => setFormOpen(true)}
            style={{ marginBottom: spacing(4) }}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="scan-outline" size={24} color={colors.inkFaint} />
            <Text style={styles.emptyTitle}>No geofences</Text>
            <Text style={styles.emptyBody}>
              Add one around home or work. Orbit alerts you on the crossing, not
              for every minute a device sits inside.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const inside = insideCount(item);

          return (
            <View style={[styles.card, !item.active && { opacity: 0.6 }]}>
              <View style={styles.cardTop}>
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor: `${item.color || colors.violet}1a`,
                      borderColor: `${item.color || colors.violet}33`,
                    },
                  ]}
                >
                  <Ionicons
                    name="scan-outline"
                    size={17}
                    color={item.color || colors.violet}
                  />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.meta}>
                    {formatDistance(item.radius)} radius ·{" "}
                    {item.deviceIds.length
                      ? `${item.deviceIds.length} device${item.deviceIds.length === 1 ? "" : "s"}`
                      : "All devices"}
                  </Text>
                </View>

                <Switch
                  value={item.active}
                  onValueChange={(next) => toggleGeofence(item.id, next).catch(() => {})}
                  trackColor={{ false: colors.lineStrong, true: `${colors.accent}88` }}
                  thumbColor={item.active ? colors.accent : colors.inkFaint}
                  ios_backgroundColor={colors.lineStrong}
                />
              </View>

              <View style={styles.tags}>
                {item.enterAlert && (
                  <Text style={[styles.tag, { color: colors.accent }]}>Arrivals</Text>
                )}
                {item.exitAlert && (
                  <Text style={[styles.tag, { color: colors.violet }]}>Departures</Text>
                )}
                {inside > 0 && (
                  <Text style={[styles.tag, { color: colors.positive }]}>
                    {inside} inside
                  </Text>
                )}
                <Pressable onPress={() => confirmDelete(item)} hitSlop={8} style={{ marginLeft: "auto" }}>
                  <Text style={[styles.tag, { color: colors.danger }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      {formOpen && (
        <GeofenceForm
          devices={devices}
          onClose={() => setFormOpen(false)}
          onCreate={addGeofence}
        />
      )}
    </View>
  );
};

// Mounted only while open, so it seeds itself once and needs no reset effect.
const GeofenceForm = ({ devices, onClose, onCreate }) => {
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState(500);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const useMyLocation = async () => {
    try {
      const permission = await tracker.requestPermissions({ background: false });

      if (!permission.granted) {
        setError(permission.message);
        return;
      }

      const position = await tracker.getCurrentPosition();

      setLatitude(String(position.coords.latitude));
      setLongitude(String(position.coords.longitude));
      setError(null);
    } catch {
      setError("Could not read your location");
    }
  };

  const useDevice = (device) => {
    if (!device.lastLocation) {
      return;
    }

    setLatitude(String(device.lastLocation.latitude));
    setLongitude(String(device.lastLocation.longitude));
  };

  const submit = async () => {
    setSaving(true);
    setError(null);

    try {
      await onCreate({
        name: name.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius: Number(radius),
        enterAlert: true,
        exitAlert: true,
      });

      onClose();
    } catch (createError) {
      setError(createError.message);
    } finally {
      setSaving(false);
    }
  };

  const positioned = devices.filter((device) => device.lastLocation);
  const valid = name.trim() && latitude && longitude;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New geofence</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={20} color={colors.inkFaint} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing(5) }} keyboardShouldPersistTaps="handled">
            <Field label="Name">
              <Input value={name} onChangeText={setName} placeholder="Home" />
            </Field>

            <View style={styles.coordRow}>
              <View style={{ flex: 1 }}>
                <Field label="Latitude">
                  <Input
                    value={latitude}
                    onChangeText={setLatitude}
                    placeholder="28.6139"
                    keyboardType="numbers-and-punctuation"
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Longitude">
                  <Input
                    value={longitude}
                    onChangeText={setLongitude}
                    placeholder="77.2090"
                    keyboardType="numbers-and-punctuation"
                  />
                </Field>
              </View>
            </View>

            <Button
              label="Use my current location"
              variant="secondary"
              onPress={useMyLocation}
              style={{ marginBottom: spacing(3) }}
            />

            {positioned.length > 0 && (
              <View style={{ marginBottom: spacing(4) }}>
                <Text style={styles.pickLabel}>Or centre on a device</Text>
                <View style={styles.chips}>
                  {positioned.map((device) => (
                    <Pressable
                      key={device.id}
                      onPress={() => useDevice(device)}
                      style={styles.chip}
                    >
                      <Text style={styles.chipText}>{device.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <Text style={styles.pickLabel}>Radius</Text>
            <View style={styles.chips}>
              {RADII.map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setRadius(value)}
                  style={[styles.chip, radius === value && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, radius === value && { color: colors.accent }]}
                  >
                    {formatDistance(value)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              label="Create geofence"
              onPress={submit}
              loading={saving}
              disabled={!valid}
              style={{ marginTop: spacing(5) }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.void },
  list: { padding: spacing(4), gap: spacing(3) },
  card: {
    backgroundColor: colors.raised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing(4),
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  name: { fontSize: 15, fontWeight: "600", color: colors.ink },
  meta: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  tags: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    marginTop: spacing(3),
    paddingTop: spacing(3),
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  tag: { fontSize: 11, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: spacing(12), gap: spacing(2) },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
  emptyBody: {
    fontSize: 13,
    color: colors.inkMuted,
    textAlign: "center",
    paddingHorizontal: spacing(6),
  },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(6,7,10,0.85)", justifyContent: "flex-end" },
  modalCard: {
    maxHeight: "88%",
    backgroundColor: colors.base,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing(5),
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.ink },
  coordRow: { flexDirection: "row", gap: spacing(3) },
  pickLabel: { fontSize: 12, color: colors.inkMuted, marginBottom: spacing(2) },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing(2) },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { borderColor: `${colors.accent}55`, backgroundColor: `${colors.accent}12` },
  chipText: { fontSize: 12, color: colors.inkMuted },
  error: {
    fontSize: 12,
    color: colors.danger,
    marginTop: spacing(3),
  },
});
