const mongoose = require("mongoose");

// Stores only a SHA-256 hash of the refresh token, never the raw value.
// One document per active session, so a user can be signed in on many devices.
const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    // Set when rotation replaces this token, so reuse can be traced.
    replacedByTokenHash: {
      type: String,
      default: null,
    },

    userAgent: {
      type: String,
      default: null,
    },

    ip: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Mongo removes expired sessions on its own.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ userId: 1, revokedAt: 1 });

refreshTokenSchema.methods.isActive = function isActive() {
  return !this.revokedAt && this.expiresAt.getTime() > Date.now();
};

const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);

module.exports = RefreshToken;
