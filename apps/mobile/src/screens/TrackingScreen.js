import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import {
  Banner,
  Button,
  Card,
  Divider,
  OrbitMark,
  PulseDot,
  Row,
} from "../components/ui";
import { useOrbit } from "../context/OrbitContext";
import { colors, radius, spacing } from "../theme";

const relative = (value) => {
  if (!value) {
    return "Never";
  }

  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);

  if (seconds < 45) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;

  return `${Math.floor(seconds / 86400)} d ago`;
};

export const TrackingScreen = ({ navigation }) => {
  const {
    device,
    tracking,
    trackingMode,
    permissions,
    queued,
    lastSync,
    lastFix,
    reportInterval,
    banner,
    setBanner,
    start,
    stop,
    syncNow,
    reportOnce,
    refreshLocalState,
  } = useOrbit();

  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const toggle = async (next) => {
    setBusy(true);

    if (next) {
      await start();
    } else {
      await stop();
    }

    setBusy(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshLocalState();
    setRefreshing(false);
  };

  const sync = async () => {
    setBusy(true);

    try {
      const result = await syncNow();

      setBanner({
        tone: result.flushed > 0 ? "positive" : "accent",
        message:
          result.flushed > 0
            ? `Uploaded ${result.flushed} queued position${result.flushed === 1 ? "" : "s"}.`
            : result.remaining > 0
              ? "Still offline — positions are being kept for later."
              : "Nothing waiting to upload.",
      });
    } finally {
      setBusy(false);
    }
  };

  const reportNow = async () => {
    setBusy(true);

    try {
      const result = await reportOnce();

      const message = {
        sent: "Position sent to Orbit.",
        queued: "No connection — position saved to upload later.",
        duplicate: "Orbit already has this exact position.",
        forbidden: "Tracking is switched off for this device in your account.",
        unauthorized: "This device's token is no longer valid.",
        unlinked: "This device is not linked to an account.",
      }[result.status];

      setBanner({
        tone: result.status === "sent" ? "positive" : result.status === "queued" ? "warning" : "accent",
        message,
      });
    } catch (error) {
      setBanner({ tone: "danger", message: error.message });
    } finally {
      setBusy(false);
    }
  };

  const confirmStop = () => {
    Alert.alert(
      "Stop sharing location?",
      "Orbit will stop reporting this device's position until you switch it back on.",
      [
        { text: "Keep sharing", style: "cancel" },
        { text: "Stop", style: "destructive", onPress: () => toggle(false) },
      ]
    );
  };

  const trackingDisabledByOwner = device && device.trackingEnabled === false;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      <View style={styles.header}>
        <OrbitMark size={30} />
        <Text style={styles.brand}>Orbit</Text>
        <Pressable
          onPress={() => navigation.navigate("Settings")}
          hitSlop={12}
          style={styles.settingsButton}
        >
          <Text style={styles.settingsLabel}>Settings</Text>
        </Pressable>
      </View>

      <Banner tone={banner?.tone} message={banner?.message} onDismiss={() => setBanner(null)} />

      {/* The status card is the whole point of this screen: whether this phone
          is reporting right now must be unmissable. */}
      <Card style={[styles.statusCard, tracking && styles.statusCardLive]}>
        <View style={styles.statusTop}>
          <PulseDot active={tracking} size={12} />
          <Text style={[styles.statusText, tracking && styles.statusTextLive]}>
            {tracking ? "Sharing location" : "Not sharing"}
          </Text>
          <Switch
            value={tracking}
            disabled={busy || trackingDisabledByOwner}
            onValueChange={(next) => (next ? toggle(true) : confirmStop())}
            trackColor={{ false: colors.lineStrong, true: `${colors.accent}88` }}
            thumbColor={tracking ? colors.accent : colors.inkFaint}
            ios_backgroundColor={colors.lineStrong}
          />
        </View>

        <Text style={styles.statusHint}>
          {trackingDisabledByOwner
            ? "Tracking is switched off for this device in your Orbit account. Turn it back on there first."
            : tracking
              ? trackingMode === "foreground"
                ? `Reporting every ${reportInterval}s while Orbit is open. Leave the app and it stops — this runtime cannot track in the background.`
                : `Reporting every ${reportInterval}s to your Orbit account. Your phone shows a notification while this is on.`
              : "Nothing is being reported. Turn this on to put this device on your Orbit map."}
        </Text>

        <Text style={styles.deviceName}>{device?.name}</Text>
      </Card>

      <Card style={{ marginTop: spacing(4) }}>
        <Text style={styles.cardTitle}>Status</Text>
        <Divider />
        <Row
          label="Reporting every"
          value={
            reportInterval >= 60
              ? `${Math.round(reportInterval / 60)} min`
              : `${reportInterval} sec`
          }
        />
        <Row
          label="Last upload"
          value={relative(lastSync)}
          valueColor={lastSync ? colors.ink : colors.inkFaint}
        />
        <Row
          label="Waiting to upload"
          value={queued === 0 ? "Nothing" : `${queued} position${queued === 1 ? "" : "s"}`}
          valueColor={queued > 0 ? colors.warning : colors.ink}
        />
        <Row
          label="Mode"
          value={
            trackingMode === "foreground"
              ? "While app is open"
              : trackingMode === "background"
                ? "Background"
                : "Stopped"
          }
          valueColor={trackingMode === "foreground" ? colors.warning : colors.ink}
        />
        <Row
          label="Background location"
          value={permissions.background ? "Allowed" : "Not allowed"}
          valueColor={permissions.background ? colors.positive : colors.warning}
        />
        <Row
          label="Location services"
          value={permissions.servicesEnabled ? "On" : "Off"}
          valueColor={permissions.servicesEnabled ? colors.positive : colors.danger}
        />

        {lastFix && (
          <>
            <Divider />
            <Row
              label="Last position"
              value={`${lastFix.latitude.toFixed(5)}, ${lastFix.longitude.toFixed(5)}`}
            />
            {lastFix.accuracy !== undefined && (
              <Row label="Accuracy" value={`±${Math.round(lastFix.accuracy)} m`} />
            )}
          </>
        )}
      </Card>

      {queued > 0 && (
        <Card style={[styles.queueCard, { marginTop: spacing(4) }]}>
          <Text style={styles.queueTitle}>{queued} positions waiting</Text>
          <Text style={styles.queueBody}>
            GPS keeps working without a signal, so these were recorded while
            offline. They upload automatically once Orbit is reachable, in the
            order they happened.
          </Text>
          <Button
            label="Try uploading now"
            variant="secondary"
            onPress={sync}
            loading={busy}
            style={{ marginTop: spacing(3) }}
          />
        </Card>
      )}

      {!permissions.background && permissions.foreground && trackingMode !== "foreground" && (
        <Card style={{ marginTop: spacing(4) }}>
          <Text style={styles.cardTitle}>Only reporting while open</Text>
          <Text style={styles.queueBody}>
            Background location was not granted, so Orbit stops reporting when
            you leave the app. Allow &quot;Always&quot; in system settings to
            keep it running.
          </Text>
          <Button
            label="Open system settings"
            variant="secondary"
            onPress={() => Linking.openSettings()}
            style={{ marginTop: spacing(3) }}
          />
        </Card>
      )}

      <Button
        label="Send one position now"
        variant="secondary"
        onPress={reportNow}
        loading={busy}
        style={{ marginTop: spacing(4) }}
      />

      <Text style={styles.footnote}>
        Orbit never tracks silently. While this device is reporting, it says so
        here and in your phone&apos;s notifications.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: spacing(5), paddingBottom: spacing(10) },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
    marginBottom: spacing(5),
  },
  brand: { fontSize: 17, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },
  settingsButton: { marginLeft: "auto" },
  settingsLabel: { fontSize: 13, color: colors.inkMuted },
  statusCard: { paddingVertical: spacing(5) },
  statusCardLive: { borderColor: `${colors.positive}55` },
  statusTop: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  statusText: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.inkMuted },
  statusTextLive: { color: colors.positive },
  statusHint: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkMuted,
    marginTop: spacing(3),
  },
  deviceName: {
    fontSize: 12,
    color: colors.inkFaint,
    marginTop: spacing(3),
  },
  cardTitle: { fontSize: 14, fontWeight: "600", color: colors.ink, marginBottom: spacing(2) },
  queueCard: { borderColor: `${colors.warning}44` },
  queueTitle: { fontSize: 14, fontWeight: "600", color: colors.warning },
  queueBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkMuted,
    marginTop: spacing(2),
  },
  footnote: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.inkFaint,
    textAlign: "center",
    marginTop: spacing(6),
  },
});
