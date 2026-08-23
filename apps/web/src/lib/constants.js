import {
  Smartphone,
  Laptop,
  Tablet,
  Monitor,
  Watch,
  HardDrive,
  BatteryLow,
  WifiOff,
  Wifi,
  LogIn,
  MapPin,
  MapPinOff,
  UserPlus,
  UserCheck,
  UserX,
  UserMinus,
} from "lucide-react";

export const DEVICE_TYPES = [
  { value: "phone", label: "Phone", icon: Smartphone },
  { value: "laptop", label: "Laptop", icon: Laptop },
  { value: "tablet", label: "Tablet", icon: Tablet },
  { value: "desktop", label: "Desktop", icon: Monitor },
  { value: "wearable", label: "Wearable", icon: Watch },
  { value: "other", label: "Other", icon: HardDrive },
];

export const PLATFORMS = [
  { value: "android", label: "Android" },
  { value: "ios", label: "iOS" },
  { value: "windows", label: "Windows" },
  { value: "macos", label: "macOS" },
  { value: "linux", label: "Linux" },
  { value: "web", label: "Web" },
  { value: "other", label: "Other" },
];

export const deviceIcon = (type) =>
  DEVICE_TYPES.find((entry) => entry.value === type)?.icon || HardDrive;

export const deviceTypeLabel = (type) =>
  DEVICE_TYPES.find((entry) => entry.value === type)?.label || "Device";

export const platformLabel = (platform) =>
  PLATFORMS.find((entry) => entry.value === platform)?.label || "Unknown";

// One place deciding how each alert type looks, so the alerts page, the
// notification tray and the activity feed cannot drift apart.
export const NOTIFICATION_META = {
  LOW_BATTERY: { icon: BatteryLow, tone: "warning", label: "Low battery" },
  DEVICE_OFFLINE: { icon: WifiOff, tone: "danger", label: "Went offline" },
  DEVICE_ONLINE: { icon: Wifi, tone: "positive", label: "Came online" },
  GEOFENCE_ENTER: { icon: MapPin, tone: "accent", label: "Entered zone" },
  GEOFENCE_EXIT: { icon: MapPinOff, tone: "violet", label: "Left zone" },
  NEW_LOGIN: { icon: LogIn, tone: "violet", label: "New sign-in" },
  CONNECTION_REQUEST: { icon: UserPlus, tone: "accent", label: "Sharing request" },
  CONNECTION_ACCEPTED: { icon: UserCheck, tone: "positive", label: "Request accepted" },
  CONNECTION_DENIED: { icon: UserX, tone: "muted", label: "Request declined" },
  CONNECTION_REVOKED: { icon: UserMinus, tone: "warning", label: "Sharing ended" },
};

export const notificationMeta = (type) =>
  NOTIFICATION_META[type] || { icon: Wifi, tone: "accent", label: "Update" };

export const TONE_CLASS = {
  accent: "text-accent bg-accent/10 ring-accent/25",
  positive: "text-positive bg-positive/10 ring-positive/25",
  warning: "text-warning bg-warning/10 ring-warning/25",
  danger: "text-danger bg-danger/10 ring-danger/25",
  violet: "text-violet bg-violet/10 ring-violet/25",
  muted: "text-ink-muted bg-white/5 ring-white/10",
};

// Battery colour thresholds, shared by the pill and the device detail readout.
export const batteryTone = (level) => {
  if (level === null || level === undefined) return "muted";
  if (level < 20) return "danger";
  if (level < 40) return "warning";

  return "positive";
};

export const SHARE_DURATIONS = [
  { value: 15, label: "15 minutes" },
  { value: 60, label: "1 hour" },
  { value: 240, label: "4 hours" },
  { value: 720, label: "12 hours" },
  { value: 1440, label: "24 hours" },
  { value: 4320, label: "3 days" },
];
