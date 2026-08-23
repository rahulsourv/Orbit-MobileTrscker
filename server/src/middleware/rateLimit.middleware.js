const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const env = require("../config/env");
const logger = require("../utils/logger");
const { getRedis } = require("../config/redis");

// With Redis every instance shares one counter; without it each process keeps
// its own, which still blunts abuse on a single-node deployment.
const buildStore = () => {
  const redis = getRedis();

  if (!redis) {
    return undefined;
  }

  try {
    const { RedisStore } = require("rate-limit-redis");

    return new RedisStore({
      prefix: "orbit:rl:",
      sendCommand: (...args) => redis.call(...args),
    });
  } catch (error) {
    logger.warn(`Redis rate-limit store unavailable: ${error.message}`);
    return undefined;
  }
};

// IPv6 clients get a whole /64 each, so the raw address is normalised before it
// is used as (or folded into) a key.
const clientIp = (req) => ipKeyGenerator(req.ip || "");

const createLimiter = ({ windowMs, limit, message, keyGenerator }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator,
    store: buildStore(),
    // A Redis blip should not take the API down with it. Requests are allowed
    // through while the store is unreachable; losing rate limiting for a few
    // seconds is the lesser failure.
    passOnStoreError: true,
    // Rate-limit rejections use the same envelope as every other error.
    handler: (req, res) =>
      res.status(429).json({ success: false, message }),
    skip: () => env.isTest,
  });

// Registration is expensive (Argon2) and is the obvious spam target.
const registerLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: "Too many accounts created from this address. Try again later.",
  keyGenerator: clientIp,
});

// Keyed by address *and* email so one attacker cannot lock out a real user by
// hammering their address, and a botnet cannot spread a single account's
// guesses across many IPs for free.
const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many login attempts. Try again in a few minutes.",
  keyGenerator: (req) =>
    `${clientIp(req)}:${String(req.body?.email || "").toLowerCase()}`,
});

const refreshLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: "Too many token refresh attempts. Try again later.",
  keyGenerator: clientIp,
});

// Generous ceiling for authenticated dashboard traffic, keyed by user so a
// shared office NAT is not one bucket.
const apiLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 300,
  message: "Too many requests. Slow down.",
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : clientIp(req)),
});

// Telemetry is high-volume by design: a device reporting every few seconds is
// normal, a device reporting hundreds of times a second is not. Batch uploads
// after an offline stretch count as one request, which is why this can stay tight.
const ingestLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 120,
  message: "Location reporting rate exceeded.",
  keyGenerator: (req) => (req.device ? `device:${req.device.id}` : clientIp(req)),
});

// Public share links are unauthenticated, so they are the one surface a
// stranger can hit. Keyed by address only.
const publicShareLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 60,
  message: "Too many requests. Slow down.",
  keyGenerator: clientIp,
});

// Asking to follow someone is the one action here that reaches a stranger's
// inbox and notifications, so it is throttled hard. Being able to fire off
// dozens of these would be harassment, not a feature.
const connectionRequestLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: "Too many location requests sent. Try again later.",
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : clientIp(req)),
});

// Routing calls out to a third party on every request, so this protects the
// provider's fair-use policy as much as our own server.
const routingLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 30,
  message: "Too many direction requests. Slow down.",
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : clientIp(req)),
});

module.exports = {
  registerLimiter,
  connectionRequestLimiter,
  routingLimiter,
  loginLimiter,
  refreshLimiter,
  apiLimiter,
  ingestLimiter,
  publicShareLimiter,
};
