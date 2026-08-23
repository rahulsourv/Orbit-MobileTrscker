const express = require("express");
const { z } = require("zod");

const authController = require("../controllers/auth.controller");
const { validate } = require("../middleware/validate.middleware");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  registerLimiter,
  loginLimiter,
  refreshLimiter,
} = require("../middleware/rateLimit.middleware");

const router = express.Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50),
  email: z.string().trim().toLowerCase().email("A valid email address is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email address is required"),
  password: z.string().min(1, "Password is required"),
});

// Present only for native clients; web sends the token as a cookie.
const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

router.post(
  "/register",
  registerLimiter,
  validate(registerSchema),
  authController.register
);

router.post("/login", loginLimiter, validate(loginSchema), authController.login);

router.post(
  "/refresh",
  refreshLimiter,
  validate(refreshSchema),
  authController.refresh
);

router.post("/logout", validate(refreshSchema), authController.logout);

// Ends every session everywhere, which is what a user reaches for after seeing
// a login they do not recognise.
router.post("/logout-all", requireAuth, authController.logoutAll);

router.get("/me", requireAuth, authController.me);
router.get("/sessions", requireAuth, authController.listSessions);

module.exports = router;
