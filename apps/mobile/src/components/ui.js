import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, radius, spacing } from "../theme";

export const Card = ({ style, children }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const Button = ({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
}) => {
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        variant === "ghost" && styles.buttonGhost,
        pressed && !inactive && styles.buttonPressed,
        inactive && styles.buttonDisabled,
        style,
      ]}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? colors.void : colors.ink}
          style={{ marginRight: spacing(2) }}
        />
      )}
      <Text
        style={[
          styles.buttonLabel,
          variant === "primary" && styles.buttonLabelPrimary,
          variant === "danger" && styles.buttonLabelDanger,
          variant === "ghost" && styles.buttonLabelGhost,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export const Field = ({ label, error, hint, children }) => (
  <View style={{ marginBottom: spacing(4) }}>
    {label && <Text style={styles.fieldLabel}>{label}</Text>}
    {children}
    {error ? (
      <Text style={styles.fieldError}>{error}</Text>
    ) : hint ? (
      <Text style={styles.fieldHint}>{hint}</Text>
    ) : null}
  </View>
);

export const Input = ({ style, ...props }) => (
  <TextInput
    placeholderTextColor={colors.inkFaint}
    style={[styles.input, style]}
    {...props}
  />
);

export const Banner = ({ tone = "accent", message, onDismiss }) => {
  if (!message) {
    return null;
  }

  const toneColor =
    { accent: colors.accent, warning: colors.warning, danger: colors.danger, positive: colors.positive }[
      tone
    ] || colors.accent;

  return (
    <Pressable onPress={onDismiss} style={[styles.banner, { borderColor: `${toneColor}44` }]}>
      <View style={[styles.bannerDot, { backgroundColor: toneColor }]} />
      <Text style={styles.bannerText}>{message}</Text>
    </Pressable>
  );
};

export const Row = ({ label, value, valueColor }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, valueColor && { color: valueColor }]} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

/**
 * The live indicator.
 *
 * Orbit will not track quietly, so while reporting is on there is always
 * something visibly moving on screen saying so.
 */
export const PulseDot = ({ active, color = colors.positive, size = 10 }) => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );

    loop.start();

    return () => loop.stop();
  }, [active, pulse]);

  return (
    <View style={{ width: size, height: size }}>
      {active && (
        <Animated.View
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: size,
            backgroundColor: color,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) },
            ],
          }}
        />
      )}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: active ? color : colors.inkFaint,
        }}
      />
    </View>
  );
};

export const OrbitMark = ({ size = 36 }) => (
  <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    <View
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size,
        borderWidth: 1,
        borderColor: `${colors.accent}44`,
      }}
    />
    <View
      style={{
        position: "absolute",
        width: size * 0.62,
        height: size * 0.62,
        borderRadius: size,
        borderWidth: 1,
        borderColor: `${colors.accent}77`,
      }}
    />
    <View
      style={{
        width: size * 0.22,
        height: size * 0.22,
        borderRadius: size,
        backgroundColor: colors.accent,
      }}
    />
  </View>
);

export const Divider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.raised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing(4),
  },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: spacing(5),
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: {
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonDanger: {
    backgroundColor: `${colors.danger}1f`,
    borderWidth: 1,
    borderColor: `${colors.danger}44`,
  },
  buttonGhost: { backgroundColor: "transparent" },
  buttonPressed: { opacity: 0.8 },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { fontSize: 15, fontWeight: "600", color: colors.ink },
  buttonLabelPrimary: { color: colors.void },
  buttonLabelDanger: { color: colors.danger },
  buttonLabelGhost: { color: colors.inkMuted },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.inkMuted,
    marginBottom: spacing(1.5),
  },
  fieldError: { fontSize: 12, color: colors.danger, marginTop: spacing(1.5) },
  fieldHint: { fontSize: 12, color: colors.inkFaint, marginTop: spacing(1.5) },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.void,
    paddingHorizontal: spacing(3.5),
    color: colors.ink,
    fontSize: 15,
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing(2.5),
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.overlay,
    padding: spacing(3),
    marginBottom: spacing(4),
  },
  bannerDot: { width: 8, height: 8, borderRadius: 8, marginTop: 5 },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.inkMuted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing(2.5),
    gap: spacing(4),
  },
  rowLabel: { fontSize: 13, color: colors.inkMuted },
  rowValue: { fontSize: 13, color: colors.ink, fontWeight: "500", flexShrink: 1 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing(1) },
});
