const express = require("express");
const { z } = require("zod");

const authController = require("../controllers/auth.controller");
const { validate } = require("../middleware/validate.middleware");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  registerLimiter,
  loginLimiter,
  refreshLimiter,
  passwordChangeLimiter,
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

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50),
});

router.patch(
  "/me",
  requireAuth,
  validate(updateProfileSchema),
  authController.updateProfile
);

// The current password is required even with a valid session, so an unlocked
// borrowed device cannot quietly take the account.
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Your current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128),
});

router.post(
  "/change-password",
  requireAuth,
  passwordChangeLimiter,
  validate(changePasswordSchema),
  authController.changePassword
);
router.get("/sessions", requireAuth, authController.listSessions);

module.exports = router;
