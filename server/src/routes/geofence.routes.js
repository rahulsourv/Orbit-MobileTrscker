const express = require("express");
const { z } = require("zod");

const geofenceController = require("../controllers/geofence.controller");
const { validate } = require("../middleware/validate.middleware");
const { requireAuth } = require("../middleware/auth.middleware");
const { MIN_RADIUS_METERS, MAX_RADIUS_METERS } = require("../models/Geofence");

const router = express.Router();

router.use(requireAuth);

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "A valid id is required");

const geofenceIdParams = z.object({ geofenceId: objectId });

const createGeofenceSchema = z.object({
  name: z.string().trim().min(1, "Geofence name is required").max(60),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().min(MIN_RADIUS_METERS).max(MAX_RADIUS_METERS),
  // Empty or omitted means every device the user owns.
  deviceIds: z.array(objectId).max(50).optional(),
  enterAlert: z.boolean().optional(),
  exitAlert: z.boolean().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #22d3ee")
    .nullable()
    .optional(),
});

const updateGeofenceSchema = createGeofenceSchema
  .partial()
  .extend({ active: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  })
  // Moving a geofence means moving its centre, so a stray half-update cannot
  // leave the circle somewhere neither the old nor the new position.
  .refine(
    (value) =>
      (value.latitude === undefined) === (value.longitude === undefined),
    { message: "latitude and longitude must be provided together" }
  );

router.post("/", validate(createGeofenceSchema), geofenceController.createGeofence);
router.get("/", geofenceController.listGeofences);

router.get(
  "/:geofenceId",
  validate(geofenceIdParams, "params"),
  geofenceController.getGeofence
);

router.patch(
  "/:geofenceId",
  validate(geofenceIdParams, "params"),
  validate(updateGeofenceSchema),
  geofenceController.updateGeofence
);

router.delete(
  "/:geofenceId",
  validate(geofenceIdParams, "params"),
  geofenceController.deleteGeofence
);

module.exports = router;
