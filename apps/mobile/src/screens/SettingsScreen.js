import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Device from "expo-device";

import { Button, Card, Divider, Field, Input, Row } from "../components/ui";
import { useOrbit } from "../context/OrbitContext";
import { colors, spacing } from "../theme";

const INTERVALS = [
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 60, label: "1 min" },
  { value: 300, label: "5 min" },
  { value: 900, label: "15 min" },
];

export const SettingsScreen = ({ navigation }) => {
  const {
    user,
    device,
    updateProfile,
    changePassword,
    apiUrl,
    queued,
    reportInterval,
    changeReportInterval,
    changeApiUrl,
    signOut,
    unlinkDevice,
  } = useOrbit();

  const [serverDraft, setServerDraft] = useState(apiUrl);
  const [saving, setSaving] = useState(false);

  const [nameDraft, setNameDraft] = useState(user?.name || "");
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const saveName = async () => {
    setSavingName(true);

    try {
      await updateProfile(nameDraft.trim());
      Alert.alert("Saved", "Your name was updated.");
    } catch (error) {
      Alert.alert("Could not save", error.message);
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async () => {
    setSavingPassword(true);

    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert(
        "Password changed",
        "Every other session was signed out."
      );
    } catch (error) {
      Alert.alert("Could not change password", error.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const saveServer = async () => {
    setSaving(true);

    try {
      const next = await changeApiUrl(serverDraft);

      setServerDraft(next);
      Alert.alert("Server updated", `Orbit will now talk to ${next}`);
    } finally {
      setSaving(false);
    }
  };

  const confirmUnlink = () => {
    Alert.alert(
      "Unlink this device?",
      queued > 0
        ? `This removes the device from your Orbit account along with its location history. ${queued} position${queued === 1 ? "" : "s"} still waiting to upload will be discarded.`
        : "This removes the device from your Orbit account, along with its location history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: async () => {
            await unlinkDevice();
          },
        },
      ]
    );
  };

  const confirmSignOut = () => {
    Alert.alert(
      "Sign out?",
      "Tracking stops, but this device stays registered. Sign in again to resume.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ marginLeft: "auto" }}>
            <Text style={styles.close}>Done</Text>
          </Pressable>
        </View>

        <Card>
          <Text style={styles.cardTitle}>Your details</Text>
          <Divider />
          <Row label="Email" value={user?.email || "Not signed in"} />

          <Field label="Name" hint="How you appear in Orbit.">
            <Input
              value={nameDraft}
              onChangeText={setNameDraft}
              autoCapitalize="words"
            />
          </Field>
          <Button
            label="Save name"
            variant="secondary"
            onPress={saveName}
            loading={savingName}
            disabled={
              nameDraft.trim().length < 2 || nameDraft.trim() === user?.name
            }
          />
        </Card>

        <Card style={{ marginTop: spacing(4) }}>
          <Text style={styles.cardTitle}>Password</Text>
          <Divider />
          <Text style={styles.note}>
            Changing it signs out every other session. Your current password is
            required even though you are signed in — it is what stops someone
            using an unlocked phone to take the account.
          </Text>

          <View style={{ marginTop: spacing(4) }}>
            <Field label="Current password">
              <Input
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </Field>

            <Field label="New password" hint="At least 8 characters.">
              <Input
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </Field>

            <Field
              label="Confirm new password"
              error={
                confirmPassword.length > 0 && newPassword !== confirmPassword
                  ? "These do not match"
                  : null
              }
            >
              <Input
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </Field>

            <Button
              label="Change password"
              variant="secondary"
              onPress={savePassword}
              loading={savingPassword}
              disabled={
                !currentPassword ||
                newPassword.length < 8 ||
                newPassword !== confirmPassword
              }
            />
          </View>
        </Card>

        <Card style={{ marginTop: spacing(4) }}>
          <Text style={styles.cardTitle}>This device</Text>
          <Divider />
          <Row label="Name" value={device?.name || "Not registered"} />
          <Row
            label="Model"
            value={[Device.modelName, Device.osName].filter(Boolean).join(" · ") || "Unknown"}
          />
          <Row
            label="Tracking allowed"
            value={device?.trackingEnabled ? "Yes" : "No"}
            valueColor={device?.trackingEnabled ? colors.positive : colors.warning}
          />
          <Text style={styles.note}>
            Orbit stores only a hash of this device&apos;s token, so it can never
            be shown again. If you lose it, rotate the token from the dashboard
            and register this device once more.
          </Text>
        </Card>

        <Card style={{ marginTop: spacing(4) }}>
          <Text style={styles.cardTitle}>Reporting</Text>
          <Divider />
          <Text style={styles.note}>
            How often this device sends its position while tracking is on.
            Shorter means a fresher map and a shorter battery life.
          </Text>
          <View style={styles.intervals}>
            {INTERVALS.map((option) => {
              const active = reportInterval === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => changeReportInterval(option.value)}
                  style={[styles.interval, active && styles.intervalActive]}
                >
                  <Text
                    style={[styles.intervalText, active && { color: colors.accent }]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card style={{ marginTop: spacing(4) }}>
          <Text style={styles.cardTitle}>Server</Text>
          <Divider />
          <Field
            label="Orbit API URL"
            hint="Include the /api suffix. Changing this does not move your data."
          >
            <Input
              value={serverDraft}
              onChangeText={setServerDraft}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </Field>
          <Button
            label="Save server"
            variant="secondary"
            onPress={saveServer}
            loading={saving}
          />
        </Card>

        <Card style={{ marginTop: spacing(4) }}>
          <Text style={styles.cardTitle}>Privacy</Text>
          <Divider />
          <Text style={styles.note}>
            This device reports its position only while you have tracking
            switched on, and only to your own Orbit account. Your phone shows a
            permanent notification the whole time it is running.
          </Text>
          <Text style={styles.note}>
            Positions recorded while offline are kept on this device until they
            can be uploaded, and are discarded if you unlink.
          </Text>
        </Card>

        <Button
          label="Sign out"
          variant="secondary"
          onPress={confirmSignOut}
          style={{ marginTop: spacing(5) }}
        />

        <Button
          label="Unlink this device"
          variant="danger"
          onPress={confirmUnlink}
          style={{ marginTop: spacing(3) }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { padding: spacing(5), paddingBottom: spacing(10) },
  header: { flexDirection: "row", alignItems: "center", marginBottom: spacing(5) },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink, letterSpacing: -0.4 },
  close: { fontSize: 14, color: colors.accent, fontWeight: "600" },
  cardTitle: { fontSize: 14, fontWeight: "600", color: colors.ink, marginBottom: spacing(2) },
  note: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.inkFaint,
    marginTop: spacing(3),
  },
  intervals: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing(2),
    marginTop: spacing(3),
  },
  interval: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  intervalActive: {
    borderColor: `${colors.accent}55`,
    backgroundColor: `${colors.accent}12`,
  },
  intervalText: { fontSize: 12, color: colors.inkMuted },
});
