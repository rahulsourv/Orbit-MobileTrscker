import { useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Button } from "../components/ui";
import { useDashboard } from "../context/DashboardContext";
import { colors, radius, spacing } from "../theme";
import { relativeTime } from "../lib/time";
import { notificationMeta } from "../lib/deviceMeta";

export const AlertsScreen = () => {
  const {
    incoming,
    acceptConnection,
    denyConnection,
    notifications,
    unreadCount,
    loading,
    refresh,
    markRead,
    markAllRead,
    clearAlerts,
  } = useDashboard();

  const [refreshing, setRefreshing] = useState(false);
  const [answering, setAnswering] = useState(null);

  // Requests about *your* location need a decision, so they belong wherever you
  // go to see what needs your attention - here, not buried a tab away.
  const pending = incoming.filter((entry) => entry.status === "pending");

  const answer = async (request, accept) => {
    setAnswering(request.id);

    try {
      if (accept) {
        // An empty list means every device, the sensible default when
        // answering from a notification. The scope can be narrowed later on
        // the People tab.
        await acceptConnection(request.id, []);
        Alert.alert("Sharing started", "You can stop at any time.");
      } else {
        await denyConnection(request.id);
        Alert.alert("Declined", "Nothing was shared.");
      }
    } catch (error) {
      Alert.alert("Could not respond", error.message);
    } finally {
      setAnswering(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const confirmClear = () => {
    Alert.alert(
      "Clear all alerts?",
      "Every alert is removed from your account. New ones will still arrive.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: clearAlerts },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        <Text style={styles.barText}>
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        </Text>

        <View style={styles.barActions}>
          {unreadCount > 0 && (
            <Pressable onPress={markAllRead} hitSlop={8}>
              <Text style={styles.barAction}>Mark all read</Text>
            </Pressable>
          )}
          {notifications.length > 0 && (
            <Pressable onPress={confirmClear} hitSlop={8}>
              <Text style={[styles.barAction, { color: colors.danger }]}>Clear</Text>
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          pending.length > 0 ? (
            <View style={styles.pendingCard}>
              <Text style={styles.pendingTitle}>
                {pending.length} person{pending.length === 1 ? "" : "s"} asking to
                see your location
              </Text>
              <Text style={styles.pendingBody}>
                Nothing is shared unless you accept.
              </Text>

              {pending.map((request) => (
                <View key={request.id} style={styles.pendingRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.pendingName}>{request.requesterName}</Text>
                    <Text style={styles.pendingEmail} numberOfLines={1}>
                      {request.requesterEmail}
                    </Text>
                    {request.message ? (
                      <Text style={styles.pendingQuote}>“{request.message}”</Text>
                    ) : null}
                  </View>

                  <View style={styles.pendingActions}>
                    <Button
                      label="Accept"
                      onPress={() => answer(request, true)}
                      loading={answering === request.id}
                      style={styles.pendingButton}
                    />
                    <Button
                      label="Deny"
                      variant="ghost"
                      onPress={() => answer(request, false)}
                      disabled={answering === request.id}
                      style={styles.pendingButton}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={24} color={colors.inkFaint} />
            <Text style={styles.emptyTitle}>
              {loading ? "Loading alerts" : "No alerts yet"}
            </Text>
            {!loading && (
              <Text style={styles.emptyBody}>
                Battery warnings, geofence crossings, devices going offline and
                new sign-ins all land here.
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const meta = notificationMeta(item.type);

          return (
            <Pressable
              onPress={() => !item.read && markRead(item.id)}
              style={[styles.card, !item.read && styles.cardUnread]}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: `${meta.color}1a`, borderColor: `${meta.color}33` },
                ]}
              >
                <Ionicons name={meta.icon} size={17} color={meta.color} />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {!item.read && <View style={styles.dot} />}
                </View>
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.void },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  barText: { fontSize: 13, color: colors.inkMuted },
  barActions: { flexDirection: "row", gap: spacing(4), marginLeft: "auto" },
  barAction: { fontSize: 13, color: colors.accent, fontWeight: "600" },
  list: { padding: spacing(4), paddingTop: 0, gap: spacing(2.5) },
  pendingCard: {
    backgroundColor: colors.raised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: `${colors.accent}44`,
    padding: spacing(4),
    marginBottom: spacing(3),
  },
  pendingTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  pendingBody: { fontSize: 12, color: colors.inkMuted, marginTop: spacing(1) },
  pendingRow: {
    marginTop: spacing(4),
    paddingTop: spacing(3),
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  pendingName: { fontSize: 14, fontWeight: "600", color: colors.ink },
  pendingEmail: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  pendingQuote: {
    fontSize: 12,
    fontStyle: "italic",
    color: colors.inkMuted,
    marginTop: spacing(2),
  },
  pendingActions: { flexDirection: "row", gap: spacing(2), marginTop: spacing(3) },
  pendingButton: { flex: 1, minHeight: 40 },
  card: {
    flexDirection: "row",
    gap: spacing(3),
    backgroundColor: colors.raised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing(4),
  },
  cardUnread: { borderColor: `${colors.accent}33` },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing(2) },
  title: { fontSize: 14, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 6, backgroundColor: colors.accent },
  message: { fontSize: 12, lineHeight: 18, color: colors.inkMuted, marginTop: 3 },
  time: { fontSize: 11, color: colors.inkFaint, marginTop: spacing(2) },
  empty: { alignItems: "center", paddingVertical: spacing(16), gap: spacing(2) },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
  emptyBody: {
    fontSize: 13,
    color: colors.inkMuted,
    textAlign: "center",
    paddingHorizontal: spacing(6),
  },
});
