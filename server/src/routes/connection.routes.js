const express = require("express");
const { z } = require("zod");

const connectionController = require("../controllers/connection.controller");
const { validate } = require("../middleware/validate.middleware");
const { requireAuth } = require("../middleware/auth.middleware");
const { connectionRequestLimiter } = require("../middleware/rateLimit.middleware");

const router = express.Router();

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "A valid id is required");

const connectionIdParams = z.object({ connectionId: objectId });

const inviteTokenParams = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{20,128}$/, "Invalid invite link"),
});

const createRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email address is required"),
  message: z.string().trim().max(200).optional(),
  // The requester may suggest a scope, but the target decides it on accept.
  deviceIds: z.array(objectId).max(50).optional(),
});

const deviceScopeSchema = z.object({
  deviceIds: z.array(objectId).max(50).optional(),
});

// Public, so someone without an Orbit account can see who is asking before
// deciding whether to sign up and answer.
router.get(
  "/invite/:token",
  validate(inviteTokenParams, "params"),
  connectionController.resolveInvite
);

router.use(requireAuth);

router.post(
  "/",
  connectionRequestLimiter,
  validate(createRequestSchema),
  connectionController.createRequest
);

router.get("/", connectionController.listConnections);

// Devices other people have chosen to share with this user.
router.get("/shared-devices", connectionController.listSharedDevices);

router.post(
  "/:connectionId/accept",
  validate(connectionIdParams, "params"),
  validate(deviceScopeSchema),
  connectionController.acceptRequest
);

router.post(
  "/:connectionId/deny",
  validate(connectionIdParams, "params"),
  connectionController.denyRequest
);

router.put(
  "/:connectionId/devices",
  validate(connectionIdParams, "params"),
  validate(deviceScopeSchema),
  connectionController.updateSharedDevices
);

router.delete(
  "/:connectionId",
  validate(connectionIdParams, "params"),
  connectionController.revokeConnection
);

module.exports = router;
