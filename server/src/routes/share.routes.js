const express = require("express");
const { z } = require("zod");

const env = require("../config/env");
const shareController = require("../controllers/share.controller");
const { validate } = require("../middleware/validate.middleware");
const { requireAuth } = require("../middleware/auth.middleware");
const { publicShareLimiter } = require("../middleware/rateLimit.middleware");

const router = express.Router();

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "A valid id is required");

// Share tokens are base64url, so the character class is narrow on purpose:
// anything else is rejected before it reaches the database.
const shareTokenParams = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{20,128}$/, "Invalid share link"),
});

const createShareSchema = z.object({
  deviceId: objectId,
  expiresInMinutes: z
    .number()
    .int()
    .min(5, "A share must last at least 5 minutes")
    .max(env.SHARE_MAX_TTL_HOURS * 60),
  label: z.string().trim().max(60).optional(),
});

const listQuerySchema = z.object({ deviceId: objectId.optional() });

const shareIdParams = z.object({ shareId: objectId });

// Public, unauthenticated, and declared before requireAuth. This is the only
// endpoint in the API a stranger can reach, which is why it is rate limited by
// address and returns the smallest useful payload.
router.get(
  "/public/:token",
  publicShareLimiter,
  validate(shareTokenParams, "params"),
  shareController.resolveShare
);

router.use(requireAuth);

router.post("/", validate(createShareSchema), shareController.createShare);
router.get("/", validate(listQuerySchema, "query"), shareController.listShares);

router.delete(
  "/:shareId",
  validate(shareIdParams, "params"),
  shareController.revokeShare
);

module.exports = router;
