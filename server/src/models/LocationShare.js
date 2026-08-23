const mongoose = require("mongoose");

// A read-only, expiring window onto one device's current position. Like refresh
// tokens, only the hash of the share token is stored, so a database leak cannot
// be turned into working share links.
const locationShareSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    // Free-text reminder of who the link went to, for the owner's eyes only.
    label: {
      type: String,
      trim: true,
      maxlength: 60,
      default: null,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    viewCount: {
      type: Number,
      default: 0,
    },

    lastViewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Expired shares linger for a week so the owner can still see them in the UI,
// then Mongo removes them.
locationShareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 604800 });

locationShareSchema.methods.isActive = function isActive() {
  return !this.revokedAt && this.expiresAt.getTime() > Date.now();
};

locationShareSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    deviceId: this.deviceId.toString(),
    label: this.label,
    expiresAt: this.expiresAt,
    revokedAt: this.revokedAt,
    active: this.isActive(),
    viewCount: this.viewCount,
    lastViewedAt: this.lastViewedAt,
    createdAt: this.createdAt,
  };
};

const LocationShare = mongoose.model("LocationShare", locationShareSchema);

module.exports = LocationShare;
