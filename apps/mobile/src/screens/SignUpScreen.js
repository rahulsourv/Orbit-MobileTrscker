import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Banner, Button, Field, Input, OrbitMark } from "../components/ui";
import { useOrbit } from "../context/OrbitContext";
import { colors, spacing } from "../theme";

// Mirrors what the API enforces, so the rules are visible before submitting
// rather than arriving as a rejection afterwards.
const RULES = [
  { label: "At least 8 characters", test: (value) => value.length >= 8 },
  { label: "One letter", test: (value) => /[a-zA-Z]/.test(value) },
  { label: "One number", test: (value) => /\d/.test(value) },
];

export const SignUpScreen = ({ onSignIn }) => {
  const { signUp } = useOrbit();

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const checks = useMemo(
    () => RULES.map((rule) => ({ ...rule, passed: rule.test(form.password) })),
    [form.password]
  );

  const update = (field) => (value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: null }));
    setMessage(null);
  };

  const submit = async () => {
    setSubmitting(true);
    setMessage(null);
    setErrors({});

    try {
      await signUp(form);
    } catch (error) {
      if (error.errors?.length) {
        setErrors(
          Object.fromEntries(
            error.errors.map((issue) => [issue.field, issue.message])
          )
        );
      }

      setMessage(error.message);
      setSubmitting(false);
    }
  };

  const ready =
    form.name.trim().length >= 2 &&
    form.email.includes("@") &&
    form.password.length >= 8;

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
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Then connect this phone — it takes a minute.
          </Text>
        </View>

        <Banner tone="danger" message={message} onDismiss={() => setMessage(null)} />

        <Field label="Name" error={errors.name}>
          <Input
            value={form.name}
            onChangeText={update("name")}
            placeholder="Rahul"
            autoCapitalize="words"
            textContentType="name"
          />
        </Field>

        <Field label="Email" error={errors.email}>
          <Input
            value={form.email}
            onChangeText={update("email")}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />
        </Field>

        <Field label="Password" error={errors.password}>
          <Input
            value={form.password}
            onChangeText={update("password")}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
          />
        </Field>

        {form.password.length > 0 && (
          <View style={styles.rules}>
            {checks.map((check) => (
              <View key={check.label} style={styles.rule}>
                <Ionicons
                  name={check.passed ? "checkmark-circle" : "ellipse-outline"}
                  size={14}
                  color={check.passed ? colors.positive : colors.inkFaint}
                />
                <Text
                  style={[
                    styles.ruleText,
                    check.passed && { color: colors.positive },
                  ]}
                >
                  {check.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Button
          label="Create account"
          onPress={submit}
          loading={submitting}
          disabled={!ready}
          style={{ marginTop: spacing(2) }}
        />

        <Pressable onPress={onSignIn} style={styles.switchLink}>
          <Text style={styles.switchText}>
            Already have an account? <Text style={styles.switchAccent}>Sign in</Text>
          </Text>
        </Pressable>

        <Text style={styles.footnote}>
          Orbit only tracks devices you register yourself, and only while you
          leave tracking switched on.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: spacing(6) },
  header: { alignItems: "center", marginBottom: spacing(7) },
  title: {
    fontSize: 24,
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
  rules: { gap: spacing(1.5), marginBottom: spacing(4) },
  rule: { flexDirection: "row", alignItems: "center", gap: spacing(2) },
  ruleText: { fontSize: 12, color: colors.inkFaint },
  switchLink: { paddingVertical: spacing(5), alignItems: "center" },
  switchText: { fontSize: 13, color: colors.inkMuted },
  switchAccent: { color: colors.accent, fontWeight: "600" },
  footnote: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.inkFaint,
    textAlign: "center",
  },
});

export default SignUpScreen;
