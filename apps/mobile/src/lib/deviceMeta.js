import { colors } from "../theme";

// One place deciding how each device type and alert is drawn, so the list, the
// detail screen and the alerts tab cannot drift apart.
const DEVICE_ICONS = {
  phone: "phone-portrait-outline",
  tablet: "tablet-portrait-outline",
  laptop: "laptop-outline",
  desktop: "desktop-outline",
  wearable: "watch-outline",
  other: "hardware-chip-outline",
};

export const deviceIconName = (type) => DEVICE_ICONS[type] || DEVICE_ICONS.other;

export const deviceTypeLabel = (type) =>
  ({
    phone: "Phone",
    tablet: "Tablet",
    laptop: "Laptop",
    desktop: "Desktop",
    wearable: "Wearable",
    other: "Device",
  })[type] || "Device";

export const batteryColor = (level) => {
  if (level === null || level === undefined) return colors.inkFaint;
  if (level < 20) return colors.danger;
  if (level < 40) return colors.warning;

  return colors.positive;
};

export const NOTIFICATION_META = {
  LOW_BATTERY: { icon: "battery-dead-outline", color: colors.warning, label: "Low battery" },
  DEVICE_OFFLINE: { icon: "cloud-offline-outline", color: colors.danger, label: "Went offline" },
  DEVICE_ONLINE: { icon: "cloud-done-outline", color: colors.positive, label: "Came online" },
  GEOFENCE_ENTER: { icon: "enter-outline", color: colors.accent, label: "Entered zone" },
  GEOFENCE_EXIT: { icon: "exit-outline", color: colors.violet, label: "Left zone" },
  NEW_LOGIN: { icon: "log-in-outline", color: colors.violet, label: "New sign-in" },
  CONNECTION_REQUEST: { icon: "person-add-outline", color: colors.accent, label: "Sharing request" },
  CONNECTION_ACCEPTED: { icon: "person-outline", color: colors.positive, label: "Request accepted" },
  CONNECTION_DENIED: { icon: "person-remove-outline", color: colors.inkMuted, label: "Request declined" },
  CONNECTION_REVOKED: { icon: "person-remove-outline", color: colors.warning, label: "Sharing ended" },
};

export const notificationMeta = (type) =>
  NOTIFICATION_META[type] || {
    icon: "notifications-outline",
    color: colors.accent,
    label: "Update",
  };
