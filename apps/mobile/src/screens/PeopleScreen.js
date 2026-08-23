import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Button, Card, Divider, Field, Input } from "../components/ui";
import { useDashboard } from "../context/DashboardContext";
import { useOrbit } from "../context/OrbitContext";
import { colors, radius, spacing } from "../theme";
import { relativeTime } from "../lib/time";

/**
 * Consent-based sharing between accounts.
 *
 * The whole screen is built around one rule: a request grants nothing until
 * the person being asked says yes, and either side can end it instantly.
 */
export const PeopleScreen = () => {
  const {
    devices,
    sharedDevices,
    incoming,
    outgoing,
    refresh,
    acceptConnection,
    denyConnection,
    revokeConnection,
  } = useDashboard();

  const [refreshing, setRefreshing] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState(null);

  const pending = incoming.filter((entry) => entry.status === "pending");
  const activeIncoming = incoming.filter((entry) => entry.status === "accepted");
  const activeOutgoing = outgoing.filter((entry) => entry.status === "accepted");
  const waiting = outgoing.filter((entry) => entry.status === "pending");

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const deny = (connection) => {
    denyConnection(connection.id)
      .then(() => Alert.alert("Declined", "Nothing was shared."))
      .catch((error) => Alert.alert("Could not decline", error.message));
  };

  const confirmRevoke = (connection, label) => {
    Alert.alert(
      "Stop sharing?",
      `Whatever was visible becomes invisible immediately, for both sides.${label ? `\n\n${label}` : ""}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop",
          style: "destructive",
          onPress: () =>
            revokeConnection(connection.id).catch((error) =>
              Alert.alert("Could not stop", error.message)
            ),
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.void }}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      <Button
        label="Ask someone to share"
        onPress={() => setAskOpen(true)}
        style={{ marginBottom: spacing(4) }}
      />

      {/* Requests waiting on this user come first: they are the only thing here
          that needs a decision. */}
      {pending.length > 0 && (
        <Card style={[styles.pendingCard, { marginBottom: spacing(4) }]}>
          <Text style={styles.cardTitle}>
            {pending.length} request{pending.length === 1 ? "" : "s"} waiting for you
          </Text>
          <Text style={styles.cardBody}>Nothing is shared unless you accept.</Text>
          <Divider />

          {pending.map((request) => (
            <View key={request.id} style={styles.requestRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name}>{request.requesterName}</Text>
                <Text style={styles.meta}>{request.requesterEmail}</Text>
                {request.message ? (
                  <Text style={styles.quote}>“{request.message}”</Text>
                ) : null}
                <Text style={styles.time}>Asked {relativeTime(request.createdAt)}</Text>
              </View>

              <View style={styles.requestActions}>
                <Button
                  label="Accept"
                  onPress={() => setAcceptTarget(request)}
                  style={styles.smallButton}
                />
                <Button
                  label="Deny"
                  variant="ghost"
                  onPress={() => deny(request)}
                  style={styles.smallButton}
                />
              </View>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <Text style={styles.cardTitle}>You are sharing with</Text>
        <Text style={styles.cardBody}>
          {activeIncoming.length
            ? "They can see the devices you chose."
            : "Nobody can see your location."}
        </Text>
        <Divider />

        {activeIncoming.length === 0 ? (
          <Text style={styles.empty}>Your devices are visible only to you.</Text>
        ) : (
          activeIncoming.map((connection) => (
            <View key={connection.id} style={styles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowName}>{connection.requesterName}</Text>
                <Text style={styles.meta}>
                  {connection.sharedDeviceIds.length
                    ? `${connection.sharedDeviceIds.length} device${connection.sharedDeviceIds.length === 1 ? "" : "s"}`
                    : "All your devices"}
                </Text>
              </View>
              <Pressable
                onPress={() => confirmRevoke(connection, connection.requesterEmail)}
                hitSlop={8}
              >
                <Text style={styles.stop}>Stop</Text>
              </Pressable>
            </View>
          ))
        )}
      </Card>

      <Card style={{ marginTop: spacing(4) }}>
        <Text style={styles.cardTitle}>Sharing with you</Text>
        <Text style={styles.cardBody}>
          {sharedDevices.length
            ? `${sharedDevices.length} device${sharedDevices.length === 1 ? "" : "s"} on your map`
            : "Nobody is sharing their location with you."}
        </Text>
        <Divider />

        {activeOutgoing.length === 0 ? (
          <Text style={styles.empty}>
            Ask someone by email. They decide what — if anything — to share.
          </Text>
        ) : (
          activeOutgoing.map((connection) => {
            const theirDevices = sharedDevices.filter(
              (device) => device.connectionId === connection.id
            );

            return (
              <View key={connection.id} style={styles.row}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowName}>{connection.email}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {theirDevices.length
                      ? theirDevices.map((device) => device.name).join(", ")
                      : "No devices reporting yet"}
                  </Text>
                </View>
                <Pressable onPress={() => confirmRevoke(connection)} hitSlop={8}>
                  <Text style={styles.stop}>Remove</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </Card>

      {waiting.length > 0 && (
        <Card style={{ marginTop: spacing(4) }}>
          <Text style={styles.cardTitle}>Waiting on a reply</Text>
          <Divider />
          {waiting.map((connection) => (
            <View key={connection.id} style={styles.row}>
              <Text style={[styles.rowName, { flex: 1 }]} numberOfLines={1}>
                {connection.email}
              </Text>
              <Pressable onPress={() => confirmRevoke(connection)} hitSlop={8}>
                <Text style={styles.stop}>Cancel</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      <Text style={styles.footnote}>
        Accepting lets someone see a position — never change a setting, read
        history, or stop you revoking. Either side can end it instantly.
      </Text>

      {askOpen && <AskModal onClose={() => setAskOpen(false)} />}

      {acceptTarget && (
        <AcceptModal
          request={acceptTarget}
          devices={devices}
          onAccept={acceptConnection}
          onClose={() => setAcceptTarget(null)}
        />
      )}
    </ScrollView>
  );
};

// Mounted only while open, so it seeds once and needs no reset effect.
const AskModal = ({ onClose }) => {
  const { sendConnectionRequest } = useDashboard();
  const { apiUrl } = useOrbit();

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // The web dashboard serves the invite page, so the link points there rather
  // than at the API.
  const inviteLink = result
    ? `${apiUrl.replace(/\/api\/?$/, "").replace(/:5000$/, ":3000")}/invite/${result.inviteToken}`
    : "";

  const send = async () => {
    setSending(true);
    setError(null);

    try {
      const data = await sendConnectionRequest({
        email: email.trim(),
        message: message.trim() || undefined,
      });

      setResult(data);
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  };

  const copy = async () => {
    await Clipboard.setStringAsync(inviteLink);
    Alert.alert("Copied", "Invite link copied to your clipboard.");
  };

  const shareLink = async () => {
    try {
      await Share.share({
        message: `${result.connection.email ? "" : ""}Orbit location request: ${inviteLink}`,
      });
    } catch {
      // The user dismissed the share sheet.
    }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {result ? "Request sent" : "Ask someone to share"}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={20} color={colors.inkFaint} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: spacing(5) }}
            keyboardShouldPersistTaps="handled"
          >
            {result ? (
              <>
                <View
                  style={[
                    styles.notice,
                    {
                      borderColor: result.hasAccount
                        ? `${colors.positive}44`
                        : `${colors.warning}44`,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: result.hasAccount ? colors.positive : colors.warning,
                    }}
                  >
                    {result.hasAccount
                      ? "They have an Orbit account — the request is already in their app."
                      : "They have no Orbit account yet. Send them this link yourself."}
                  </Text>
                </View>

                <Text style={styles.linkLabel}>Invite link</Text>
                <Text style={styles.link} selectable>
                  {inviteLink}
                </Text>

                <View style={{ flexDirection: "row", gap: spacing(3), marginTop: spacing(4) }}>
                  <Button label="Copy" variant="secondary" onPress={copy} style={{ flex: 1 }} />
                  <Button label="Share" onPress={shareLink} style={{ flex: 1 }} />
                </View>

                <Text style={styles.fine}>
                  The link only shows who is asking. It grants nothing until they
                  sign in and accept, and it expires in 14 days.
                </Text>

                <Button
                  label="Done"
                  variant="ghost"
                  onPress={onClose}
                  style={{ marginTop: spacing(4) }}
                />
              </>
            ) : (
              <>
                <Field label="Their email">
                  <Input
                    value={email}
                    onChangeText={setEmail}
                    placeholder="someone@gmail.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Field>

                <Field label="Message" hint="Optional — they see this when deciding.">
                  <Input
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Let me know you got home safe"
                    maxLength={200}
                  />
                </Field>

                {error && <Text style={styles.error}>{error}</Text>}

                <Button
                  label="Send request"
                  onPress={send}
                  loading={sending}
                  disabled={!email.trim()}
                  style={{ marginTop: spacing(2) }}
                />

                <Text style={styles.fine}>
                  They decide whether to accept, and which of their devices to
                  include. Nothing is shared until they do.
                </Text>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const AcceptModal = ({ request, devices, onAccept, onClose }) => {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggle = (deviceId) =>
    setSelected((current) =>
      current.includes(deviceId)
        ? current.filter((id) => id !== deviceId)
        : [...current, deviceId]
    );

  const accept = async () => {
    setSaving(true);

    try {
      await onAccept(request.id, selected);
      onClose();
    } catch (error) {
      Alert.alert("Could not accept", error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Share with {request.requesterName}?</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={20} color={colors.inkFaint} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing(5) }}>
            <View style={styles.notice}>
              <Text style={styles.meta}>{request.requesterEmail}</Text>
              {request.message ? (
                <Text style={[styles.quote, { marginTop: spacing(2) }]}>
                  “{request.message}”
                </Text>
              ) : null}
            </View>

            <Text style={[styles.linkLabel, { marginTop: spacing(4) }]}>
              Devices to share{" "}
              {selected.length === 0 ? "(all, including future ones)" : ""}
            </Text>

            {devices.length === 0 ? (
              <Text style={styles.empty}>You have no devices registered yet.</Text>
            ) : (
              <View style={styles.chips}>
                {devices.map((device) => {
                  const isSelected = selected.includes(device.id);

                  return (
                    <Pressable
                      key={device.id}
                      onPress={() => toggle(device.id)}
                      style={[styles.chip, isSelected && styles.chipActive]}
                    >
                      <Text
                        style={[styles.chipText, isSelected && { color: colors.accent }]}
                      >
                        {device.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Text style={styles.fine}>
              They will see where these devices are and whether they are online.
              They cannot read your history, change your settings, or stop you
              revoking this.
            </Text>

            <Button
              label="Share"
              onPress={accept}
              loading={saving}
              style={{ marginTop: spacing(4) }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { padding: spacing(4), paddingBottom: spacing(10) },
  pendingCard: { borderColor: `${colors.accent}44` },
  cardTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  cardBody: { fontSize: 12, color: colors.inkMuted, marginTop: spacing(1) },
  requestRow: { paddingTop: spacing(3) },
  requestActions: { flexDirection: "row", gap: spacing(2), marginTop: spacing(3) },
  smallButton: { flex: 1, minHeight: 40 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    paddingVertical: spacing(2.5),
  },
  rowName: { fontSize: 13, fontWeight: "500", color: colors.ink },
  name: { fontSize: 14, fontWeight: "600", color: colors.ink },
  meta: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  quote: { fontSize: 12, fontStyle: "italic", color: colors.inkMuted, marginTop: spacing(2) },
  time: { fontSize: 11, color: colors.inkFaint, marginTop: spacing(2) },
  stop: { fontSize: 12, color: colors.danger, fontWeight: "600" },
  empty: { fontSize: 12, color: colors.inkFaint, paddingVertical: spacing(3) },
  footnote: {
    fontSize: 11,
    lineHeight: 17,
    color: colors.inkFaint,
    textAlign: "center",
    marginTop: spacing(6),
  },
  backdrop: { flex: 1, backgroundColor: "rgba(6,7,10,0.85)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "88%",
    backgroundColor: colors.base,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing(5),
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  sheetTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.ink },
  notice: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.void,
    padding: spacing(3),
  },
  linkLabel: { fontSize: 12, color: colors.inkMuted, marginBottom: spacing(2) },
  link: {
    fontSize: 11,
    color: colors.accent,
    backgroundColor: colors.void,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing(3),
  },
  fine: {
    fontSize: 11,
    lineHeight: 17,
    color: colors.inkFaint,
    marginTop: spacing(3),
  },
  error: { fontSize: 12, color: colors.danger, marginBottom: spacing(3) },
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
});

export default PeopleScreen;
