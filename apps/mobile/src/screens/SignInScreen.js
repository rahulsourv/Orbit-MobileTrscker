import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Banner, Button, Field, Input, OrbitMark } from "../components/ui";
import { useOrbit } from "../context/OrbitContext";
import { colors, radius, spacing } from "../theme";

export const SignInScreen = ({ onSignUp }) => {
  const { signIn, apiUrl, changeApiUrl } = useOrbit();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showServer, setShowServer] = useState(false);
  const [serverDraft, setServerDraft] = useState(apiUrl);

  const submit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await signIn(email.trim(), password);
    } catch (signInError) {
      setError(signInError.message);
      setSubmitting(false);
    }
  };

  const saveServer = async () => {
    const next = await changeApiUrl(serverDraft);

    setServerDraft(next);
    setShowServer(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <OrbitMark size={44} />
          <Text style={styles.title}>Orbit</Text>
          <Text style={styles.subtitle}>
            Sign in to connect this device to your account.
          </Text>
        </View>

        <Banner tone="danger" message={error} onDismiss={() => setError(null)} />

        <Field label="Email">
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />
        </Field>

        <Field label="Password">
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            onSubmitEditing={submit}
            returnKeyType="go"
          />
        </Field>

        <Button
          label="Sign in"
          onPress={submit}
          loading={submitting}
          disabled={!email || !password}
        />

        <Pressable onPress={onSignUp} style={styles.switchLink}>
          <Text style={styles.switchText}>
            New to Orbit? <Text style={styles.switchAccent}>Create an account</Text>
          </Text>
        </Pressable>

        {/* A phone cannot reach the laptop's localhost, and this app is meant
            to point at a deployed API too, so the server has to be editable
            without rebuilding. */}
        <Pressable onPress={() => setShowServer((value) => !value)} style={styles.serverToggle}>
          <Text style={styles.serverToggleText}>
            {showServer ? "Hide server settings" : "Connecting to a different server?"}
          </Text>
        </Pressable>

        {showServer && (
          <View style={styles.serverBox}>
            <Field
              label="Orbit API URL"
              hint="Include the /api suffix, for example https://orbit-api.onrender.com/api"
            >
              <Input
                value={serverDraft}
                onChangeText={setServerDraft}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="http://192.168.1.10:5000/api"
              />
            </Field>
            <Button label="Save server" variant="secondary" onPress={saveServer} />
          </View>
        )}

        <Text style={styles.footnote}>
          Orbit only tracks devices you register yourself, and only while you
          leave tracking switched on.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing(6),
  },
  header: { alignItems: "center", marginBottom: spacing(8) },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.ink,
    marginTop: spacing(3),
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.inkMuted,
    marginTop: spacing(2),
    textAlign: "center",
  },
  switchLink: { paddingVertical: spacing(5), alignItems: "center" },
  switchText: { fontSize: 13, color: colors.inkMuted },
  switchAccent: { color: colors.accent, fontWeight: "600" },
  serverToggle: { paddingVertical: spacing(4), alignItems: "center" },
  serverToggleText: { fontSize: 13, color: colors.inkMuted },
  serverBox: {
    backgroundColor: colors.raised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing(4),
  },
  footnote: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.inkFaint,
    textAlign: "center",
    marginTop: spacing(8),
  },
});
