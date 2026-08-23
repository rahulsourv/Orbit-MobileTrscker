const express = require("express");
const { z } = require("zod");

const notificationController = require("../controllers/notification.controller");
const { validate } = require("../middleware/validate.middleware");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(requireAuth);

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "A valid id is required");

const notificationIdParams = z.object({ notificationId: objectId });

const listQuerySchema = z.object({
  unreadOnly: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((value) => value === true || value === "true")
    .optional(),
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

router.get(
  "/",
  validate(listQuerySchema, "query"),
  notificationController.listNotifications
);

router.get("/unread-count", notificationController.getUnreadCount);

router.patch("/read-all", notificationController.markAllAsRead);

router.patch(
  "/:notificationId/read",
  validate(notificationIdParams, "params"),
  notificationController.markAsRead
);

router.delete(
  "/:notificationId",
  validate(notificationIdParams, "params"),
  notificationController.deleteNotification
);

router.delete("/", notificationController.clearNotifications);

module.exports = router;
