const mongoose = require("mongoose");

const MIN_RADIUS_METERS = 50;
const MAX_RADIUS_METERS = 50000;

// Per-device membership state. Enter and exit alerts are edge-triggered, so the
// previous state has to be remembered somewhere; keeping it on the geofence
// avoids a separate collection for what is a handful of booleans.
const deviceStateSchema = new mongoose.Schema(
  {
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
    },
    inside: { type: Boolean, required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const geofenceSchema = new mongoose.Schema(
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

    center: {
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

    radius: {
      type: Number,
      required: true,
      min: MIN_RADIUS_METERS,
      max: MAX_RADIUS_METERS,
    },

    // Empty means "every device this user owns".
    deviceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Device",
      },
    ],

    enterAlert: { type: Boolean, default: true },
    exitAlert: { type: Boolean, default: true },
    active: { type: Boolean, default: true },

    color: { type: String, default: null },

    deviceStates: {
      type: [deviceStateSchema],
      default: [],
    },
  },
  { timestamps: true }
);

geofenceSchema.index({ center: "2dsphere" });
geofenceSchema.index({ userId: 1, active: 1 });

geofenceSchema.methods.stateFor = function stateFor(deviceId) {
  const id = deviceId.toString();

  return this.deviceStates.find((state) => state.deviceId.toString() === id);
};

geofenceSchema.methods.appliesTo = function appliesTo(deviceId) {
  if (!this.deviceIds.length) {
    return true;
  }

  const id = deviceId.toString();

  return this.deviceIds.some((device) => device.toString() === id);
};

geofenceSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    latitude: this.center.coordinates[1],
    longitude: this.center.coordinates[0],
    radius: this.radius,
    deviceIds: this.deviceIds.map((device) => device.toString()),
    enterAlert: this.enterAlert,
    exitAlert: this.exitAlert,
    active: this.active,
    color: this.color,
    devicesInside: this.deviceStates
      .filter((state) => state.inside)
      .map((state) => state.deviceId.toString()),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Geofence = mongoose.model("Geofence", geofenceSchema);

module.exports = Geofence;
module.exports.MIN_RADIUS_METERS = MIN_RADIUS_METERS;
module.exports.MAX_RADIUS_METERS = MAX_RADIUS_METERS;
