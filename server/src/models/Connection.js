const mongoose = require("mongoose");

const CONNECTION_STATUSES = ["pending", "accepted", "denied", "revoked", "expired"];

/**
 * A consent relationship between two accounts.
 *
 * This is the only way one person's location becomes visible to another, and
 * it is deliberately one-directional and opt-in: the requester asks, and sees
 * nothing at all until the target explicitly accepts. The target chooses which
 * of their devices are included, and either side can end it instantly.
 *
 * The asymmetry matters. Accepting does not grant the requester any control -
 * they can see a position, never change a setting, read a device token, or
 * stop the target from revoking.
 */
const connectionSchema = new mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Denormalised so a pending request can be displayed to someone who has
    // no account yet, without exposing the requester's user document.
    requesterName: { type: String, required: true },
    requesterEmail: { type: String, required: true, lowercase: true, trim: true },

    // The address that was invited. Kept even after the account is resolved,
    // because it is what the requester typed and recognises.
    targetEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    // Null until an account with that address exists and responds.
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: CONNECTION_STATUSES,
      default: "pending",
      index: true,
    },

    // Empty means every device the target owns, including ones registered
    // later. A non-empty list is an explicit allowlist.
    sharedDeviceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Device",
      },
    ],

    message: { type: String, trim: true, maxlength: 200, default: null },

    // Only the hash of the invite token is stored, like every other bearer
    // credential in Orbit.
    inviteTokenHash: { type: String, required: true, unique: true },

    // A request that is never answered should not sit open forever.
    expiresAt: { type: Date, required: true },

    respondedAt: { type: Date, default: null },

    // Who ended it, so each side can be shown an honest reason.
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

// One live request per pair. Without this, a requester could bury someone in
// invitations, which is harassment rather than a feature.
connectionSchema.index(
  { requesterId: 1, targetEmail: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

connectionSchema.index({ targetUserId: 1, status: 1 });
connectionSchema.index({ requesterId: 1, status: 1 });

connectionSchema.methods.isActive = function isActive() {
  return this.status === "accepted";
};

connectionSchema.methods.isPending = function isPending() {
  return this.status === "pending" && this.expiresAt.getTime() > Date.now();
};

connectionSchema.methods.includesDevice = function includesDevice(deviceId) {
  if (!this.sharedDeviceIds.length) {
    return true;
  }

  const id = deviceId.toString();

  return this.sharedDeviceIds.some((entry) => entry.toString() === id);
};

// What the requester is allowed to know about the relationship.
connectionSchema.methods.toRequesterView = function toRequesterView() {
  return {
    id: this._id.toString(),
    direction: "outgoing",
    email: this.targetEmail,
    status: this.status,
    sharedDeviceIds: this.sharedDeviceIds.map((entry) => entry.toString()),
    message: this.message,
    expiresAt: this.expiresAt,
    respondedAt: this.respondedAt,
    createdAt: this.createdAt,
  };
};

// What the target sees: who is asking, and what they would be able to see.
connectionSchema.methods.toTargetView = function toTargetView() {
  return {
    id: this._id.toString(),
    direction: "incoming",
    requesterName: this.requesterName,
    requesterEmail: this.requesterEmail,
    status: this.status,
    sharedDeviceIds: this.sharedDeviceIds.map((entry) => entry.toString()),
    message: this.message,
    expiresAt: this.expiresAt,
    respondedAt: this.respondedAt,
    createdAt: this.createdAt,
  };
};

const Connection = mongoose.model("Connection", connectionSchema);

module.exports = Connection;
module.exports.CONNECTION_STATUSES = CONNECTION_STATUSES;
