const express = require("express");
const { z } = require("zod");

const deviceController = require("../controllers/device.controller");
const locationController = require("../controllers/location.controller");
const { validate } = require("../middleware/validate.middleware");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  requireDevice,
  requireTrackingEnabled,
} = require("../middleware/deviceAuth.middleware");
const { ingestLimiter } = require("../middleware/rateLimit.middleware");
const { DEVICE_TYPES, PLATFORMS } = require("../models/Device");

const router = express.Router();

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "A valid id is required");

const deviceIdParams = z.object({ deviceId: objectId });

const registerDeviceSchema = z.object({
  name: z.string().trim().min(1, "Device name is required").max(60),
  type: z.enum(DEVICE_TYPES).default("other"),
  platform: z.enum(PLATFORMS).default("other"),
  model: z.string().trim().max(80).optional(),
  deviceIdentifier: z
    .string()
    .trim()
    .min(8, "Device identifier must be at least 8 characters")
    .max(128),
  trackingEnabled: z.boolean().optional(),
  // Set by a client that knows this is the same physical device coming back -
  // a reinstall, say - rather than a new one. Opt-in, so an accidental
  // duplicate still fails loudly with a 409.
  reclaim: z.boolean().optional(),
});

const updateDeviceSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    type: z.enum(DEVICE_TYPES).optional(),
    model: z.string().trim().max(80).nullable().optional(),
    trackingEnabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

const trackingSchema = z.object({ trackingEnabled: z.boolean() });

const heartbeatSchema = z.object({
  batteryLevel: z.number().int().min(0).max(100).optional(),
});

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).optional(),
  altitude: z.number().min(-500).max(20000).optional(),
  speed: z.number().min(0).max(1000).optional(),
  heading: z.number().min(0).max(360).optional(),
  battery: z.number().int().min(0).max(100).optional(),
  timestamp: z.coerce.date().optional(),
});

const batchLocationSchema = z.object({
  locations: z.array(locationSchema).min(1, "At least one location is required"),
});

const historyQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

const deleteHistoryQuerySchema = z.object({
  before: z.coerce.date().optional(),
});

/* ---------------------------------------------------------------------------
 * Device-authenticated routes.
 *
 * These are called by the device itself using its own device token, so they are
 * declared before requireAuth is applied. A device token grants exactly these
 * three capabilities and nothing else: say I am alive, report where I am, and
 * ask whether my owner still permits tracking.
 * ------------------------------------------------------------------------- */
router.get("/self", requireDevice, deviceController.getDeviceSelf);

router.post(
  "/:deviceId/heartbeat",
  validate(deviceIdParams, "params"),
  requireDevice,
  ingestLimiter,
  validate(heartbeatSchema),
  deviceController.heartbeat
);

router.post(
  "/:deviceId/locations",
  validate(deviceIdParams, "params"),
  requireDevice,
  requireTrackingEnabled,
  ingestLimiter,
  validate(locationSchema),
  locationController.recordLocation
);

// Offline sync: one request carrying everything the device queued while it had
// no connectivity.
router.post(
  "/:deviceId/locations/batch",
  validate(deviceIdParams, "params"),
  requireDevice,
  requireTrackingEnabled,
  ingestLimiter,
  validate(batchLocationSchema),
  locationController.recordLocationBatch
);

/* ---------------------------------------------------------------------------
 * Owner routes. Everything below requires a user access token.
 * ------------------------------------------------------------------------- */
router.use(requireAuth);

router.post("/", validate(registerDeviceSchema), deviceController.registerDevice);
router.get("/", deviceController.listDevices);

router.get(
  "/:deviceId",
  validate(deviceIdParams, "params"),
  deviceController.getDevice
);

router.patch(
  "/:deviceId",
  validate(deviceIdParams, "params"),
  validate(updateDeviceSchema),
  deviceController.updateDevice
);

router.put(
  "/:deviceId/tracking",
  validate(deviceIdParams, "params"),
  validate(trackingSchema),
  deviceController.setTracking
);

router.post(
  "/:deviceId/token/rotate",
  validate(deviceIdParams, "params"),
  deviceController.rotateToken
);

router.delete(
  "/:deviceId",
  validate(deviceIdParams, "params"),
  deviceController.deleteDevice
);

router.get(
  "/:deviceId/locations",
  validate(deviceIdParams, "params"),
  validate(historyQuerySchema, "query"),
  locationController.getHistory
);

router.get(
  "/:deviceId/locations/latest",
  validate(deviceIdParams, "params"),
  locationController.getLatest
);

router.delete(
  "/:deviceId/locations",
  validate(deviceIdParams, "params"),
  validate(deleteHistoryQuerySchema, "query"),
  locationController.deleteHistory
);

module.exports = router;
