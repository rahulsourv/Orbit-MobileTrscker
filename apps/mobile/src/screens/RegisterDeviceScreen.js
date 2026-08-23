import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Device from "expo-device";

import { Banner, Button, Card, Field, Input, OrbitMark } from "../components/ui";
import { useOrbit } from "../context/OrbitContext";
import { colors, spacing } from "../theme";

const PROMISES = [
  "This device appears on your Orbit dashboard, and nowhere else.",
  "Nothing is reported until you switch tracking on, on the next screen.",
  "While tracking runs, your phone shows a permanent notification saying so.",
  "You can stop it here, or switch it off from the dashboard, at any time.",
];

export const RegisterDeviceScreen = () => {
  const { registerThisDevice, signOut, user } = useOrbit();

  const [name, setName] = useState(Device.deviceName || Device.modelName || "My phone");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await registerThisDevice(name);
    } catch (registerError) {
      // A device already registered under this identifier means the app was
      // reinstalled or its token was lost. The device has to be removed from
      // the dashboard first, since Orbit will not silently reissue a token.
      setError(
        registerError.status === 409
          ? "This device is already registered on your account. Delete it from the Orbit dashboard first, then try again."
          : registerError.message
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <OrbitMark size={40} />
          <Text style={styles.title}>Connect this device</Text>
          <Text style={styles.subtitle}>
            Signed in as {user?.email}
          </Text>
        </View>

        <Banner tone="danger" message={error} onDismiss={() => setError(null)} />

        <Card>
          <Field
            label="Device name"
            hint="This is what you'll see on the map."
          >
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Pixel 8"
              autoCapitalize="words"
            />
          </Field>

          <View style={styles.detected}>
            <Text style={styles.detectedLabel}>Detected</Text>
            <Text style={styles.detectedValue}>
              {[Device.modelName, Device.osName, Device.osVersion]
                .filter(Boolean)
                .join(" · ") || "Unknown device"}
            </Text>
          </View>

          <Button
            label="Register this device"
            onPress={submit}
            loading={submitting}
            disabled={!name.trim()}
            style={{ marginTop: spacing(4) }}
          />
        </Card>

        <View style={styles.promises}>
          {PROMISES.map((promise) => (
            <View key={promise} style={styles.promiseRow}>
              <View style={styles.promiseDot} />
              <Text style={styles.promiseText}>{promise}</Text>
            </View>
          ))}
        </View>

        <Button
          label="Sign out"
          variant="ghost"
          onPress={signOut}
          style={{ marginTop: spacing(4) }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: spacing(6) },
  header: { alignItems: "center", marginBottom: spacing(6) },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    marginTop: spacing(3),
    letterSpacing: -0.4,
  },
  subtitle: { fontSize: 13, color: colors.inkMuted, marginTop: spacing(1.5) },
  detected: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing(3),
  },
  detectedLabel: {
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.inkFaint,
  },
  detectedValue: { fontSize: 13, color: colors.ink, marginTop: spacing(1) },
  promises: { marginTop: spacing(6), gap: spacing(3) },
  promiseRow: { flexDirection: "row", gap: spacing(3), alignItems: "flex-start" },
  promiseDot: {
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: colors.accent,
    marginTop: 7,
  },
  promiseText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.inkMuted },
});
