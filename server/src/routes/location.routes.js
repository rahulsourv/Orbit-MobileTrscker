const express = require("express");
const { z } = require("zod");

const locationController = require("../controllers/location.controller");
const { validate } = require("../middleware/validate.middleware");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

// Cross-device views. Per-device history lives under /api/devices/:deviceId,
// next to the device it belongs to.
router.use(requireAuth);

const nearbyQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(100000).default(1000),
});

// Every device with a known position, for the live map's first paint. Updates
// after that arrive over Socket.IO rather than by polling.
router.get("/live", locationController.getLiveSnapshot);

router.get(
  "/nearby",
  validate(nearbyQuerySchema, "query"),
  locationController.findNearby
);

module.exports = router;
