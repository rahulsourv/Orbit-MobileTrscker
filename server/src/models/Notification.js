const mongoose = require("mongoose");

const NOTIFICATION_TYPES = [
  "LOW_BATTERY",
  "DEVICE_OFFLINE",
  "DEVICE_ONLINE",
  "GEOFENCE_ENTER",
  "GEOFENCE_EXIT",
  "NEW_LOGIN",
  // Consent-based sharing between accounts.
  "CONNECTION_REQUEST",
  "CONNECTION_ACCEPTED",
  "CONNECTION_DENIED",
  "CONNECTION_REVOKED",
];

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      default: null,
    },

    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },

    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 300 },

    // Small, non-sensitive extras for the UI (geofence name, battery level).
    // Never put tokens or precise coordinates here.
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

notificationSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    deviceId: this.deviceId ? this.deviceId.toString() : null,
    type: this.type,
    title: this.title,
    message: this.message,
    data: this.data,
    read: this.read,
    createdAt: this.createdAt,
  };
};

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
