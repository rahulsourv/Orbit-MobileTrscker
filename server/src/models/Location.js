const mongoose = require("mongoose");

const env = require("../config/env");

// One document per reported fix. This is the append-only history; the device's
// current position is mirrored onto Device.lastLocation for fast dashboard reads.
const locationSchema = new mongoose.Schema(
  {
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
    },

    // Denormalised owner, so history queries can filter by owner without a
    // join and can never accidentally cross accounts.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (value) => value.length === 2,
          message: "coordinates must be [longitude, latitude]",
        },
      },
    },

    accuracy: { type: Number, min: 0, default: null },
    altitude: { type: Number, default: null },
    speed: { type: Number, min: 0, default: null },
    heading: { type: Number, min: 0, max: 360, default: null },
    battery: { type: Number, min: 0, max: 100, default: null },

    // When the device recorded the fix, which for queued offline points is
    // well before createdAt, when the server received it.
    timestamp: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

locationSchema.index({ deviceId: 1, timestamp: -1 });
locationSchema.index({ userId: 1, timestamp: -1 });
locationSchema.index({ location: "2dsphere" });

// Offline sync replays a queue that may overlap with what already arrived.
// A unique key on (device, instant) makes ingestion idempotent: duplicates are
// rejected by the index instead of piling up as phantom history.
locationSchema.index({ deviceId: 1, timestamp: 1 }, { unique: true });

// Location history is personal data, so it expires rather than accumulating
// forever.
locationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: env.locationHistorySeconds }
);

locationSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    deviceId: this.deviceId.toString(),
    latitude: this.location.coordinates[1],
    longitude: this.location.coordinates[0],
    accuracy: this.accuracy,
    altitude: this.altitude,
    speed: this.speed,
    heading: this.heading,
    battery: this.battery,
    timestamp: this.timestamp,
  };
};

const Location = mongoose.model("Location", locationSchema);

module.exports = Location;
