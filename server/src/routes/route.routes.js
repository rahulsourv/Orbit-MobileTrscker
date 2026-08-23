const express = require("express");
const { z } = require("zod");

const routeController = require("../controllers/route.controller");
const { validate } = require("../middleware/validate.middleware");
const { requireAuth } = require("../middleware/auth.middleware");
const { routingLimiter } = require("../middleware/rateLimit.middleware");

const router = express.Router();

router.use(requireAuth);

const directionsQuerySchema = z.object({
  fromLat: z.coerce.number().min(-90).max(90),
  fromLng: z.coerce.number().min(-180).max(180),
  toLat: z.coerce.number().min(-90).max(90),
  toLng: z.coerce.number().min(-180).max(180),
  mode: z.enum(["driving", "walking", "cycling"]).default("driving"),
});

// Proxied rather than called from the clients, so the routing provider can be
// swapped in one place and its credentials never reach a phone.
router.get(
  "/directions",
  routingLimiter,
  validate(directionsQuerySchema, "query"),
  routeController.getDirections
);

module.exports = router;
