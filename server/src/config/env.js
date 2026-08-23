const path = require("path");
const { z } = require("zod");

const logger = require("../utils/logger");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  // Redis is optional. Without it the API still runs: rate limiting falls back
  // to per-process memory and Socket.IO runs unclustered.
  REDIS_URL: z.string().optional(),

  // Device and tracking behaviour.
  DEVICE_OFFLINE_AFTER_MINUTES: z.coerce.number().int().positive().default(15),
  LOW_BATTERY_THRESHOLD: z.coerce.number().int().min(1).max(99).default(20),
  LOCATION_HISTORY_DAYS: z.coerce.number().int().positive().default(90),
  LOCATION_BATCH_MAX: z.coerce.number().int().positive().max(1000).default(200),
  SHARE_MAX_TTL_HOURS: z.coerce.number().int().positive().default(72),

  // Routing provider. Defaults to OSRM's public demo server, which needs no
  // key but is not intended for production traffic - point this at a
  // self-hosted OSRM before relying on it.
  ROUTING_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Print only the variable names that failed - never their values.
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  logger.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const data = parsed.data;

if (data.JWT_SECRET === data.JWT_REFRESH_SECRET) {
  logger.error(
    "Invalid environment configuration:\n  - JWT_SECRET and JWT_REFRESH_SECRET must be different"
  );
  process.exit(1);
}

const isProduction = data.NODE_ENV === "production";

const env = {
  ...data,
  isProduction,
  isDevelopment: data.NODE_ENV === "development",
  isTest: data.NODE_ENV === "test",
  corsOrigins: data.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Refresh cookie is scoped to the auth routes that actually read it.
  refreshCookie: {
    name: "orbit_refresh_token",
    path: "/api/auth",
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  },
  offlineAfterMs: data.DEVICE_OFFLINE_AFTER_MINUTES * 60 * 1000,
  locationHistorySeconds: data.LOCATION_HISTORY_DAYS * 24 * 60 * 60,
};

module.exports = env;
