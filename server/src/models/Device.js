const mongoose = require("mongoose");

const DEVICE_TYPES = ["phone", "laptop", "tablet", "desktop", "wearable", "other"];
const PLATFORMS = ["android", "ios", "windows", "macos", "linux", "web", "other"];

// The device's most recent fix, denormalised onto the device so the dashboard
// can render every marker from a single query. The durable history lives in
// the Location collection.
const lastLocationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (value) => value.length === 2,
        message: "coordinates must be [longitude, latitude]",
      },
    },
    accuracy: { type: Number, default: null },
    battery: { type: Number, default: null },
    timestamp: { type: Date, required: true },
  },
  { _id: false }
);

const deviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 60,
    },

    type: {
      type: String,
      enum: DEVICE_TYPES,
      default: "other",
    },

    platform: {
      type: String,
      enum: PLATFORMS,
      default: "other",
    },

    model: {
      type: String,
      trim: true,
      maxlength: 80,
      default: null,
    },

    // Stable identifier supplied by the client (installation id, machine id).
    // Unique per user so re-registering the same hardware is caught.
    deviceIdentifier: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
    },

    // Only the SHA-256 hash of the device token is stored. The raw token is
    // shown to the owner once, at registration or rotation, and never again.
    deviceTokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },

    tokenIssuedAt: {
      type: Date,
      default: Date.now,
    },

    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    isOnline: {
      type: Boolean,
      default: false,
    },

    lastSeen: {
      type: Date,
      default: null,
    },

    lastLocation: {
      type: lastLocationSchema,
      default: undefined,
    },

    // The owner's kill switch. While false the backend rejects location
    // ingestion outright, so revoking tracking is enforced server-side rather
    // than trusted to the client.
    trackingEnabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

deviceSchema.index({ userId: 1, deviceIdentifier: 1 }, { unique: true });
deviceSchema.index({ userId: 1, isOnline: 1 });
deviceSchema.index({ lastLocation: "2dsphere" });
// Drives the sweeper that flips stale devices to offline.
deviceSchema.index({ isOnline: 1, lastSeen: 1 });

deviceSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    type: this.type,
    platform: this.platform,
    model: this.model,
    deviceIdentifier: this.deviceIdentifier,
    batteryLevel: this.batteryLevel,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
    lastLocation: this.lastLocation
      ? {
          latitude: this.lastLocation.coordinates[1],
          longitude: this.lastLocation.coordinates[0],
          accuracy: this.lastLocation.accuracy,
          battery: this.lastLocation.battery,
          timestamp: this.lastLocation.timestamp,
        }
      : null,
    trackingEnabled: this.trackingEnabled,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Device = mongoose.model("Device", deviceSchema);

module.exports = Device;
module.exports.DEVICE_TYPES = DEVICE_TYPES;
module.exports.PLATFORMS = PLATFORMS;
