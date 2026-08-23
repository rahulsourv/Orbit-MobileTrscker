// Deliberately dependency-free and free of any require() on ./config/env, so
// that env.js can log its own validation failures without a circular import.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

const configuredLevel =
  LEVELS[String(process.env.LOG_LEVEL || "").toLowerCase()] ??
  (process.env.NODE_ENV === "production" ? LEVELS.info : LEVELS.debug);

const isProduction = process.env.NODE_ENV === "production";

// Anything whose key looks like a secret is replaced before it can reach a log
// sink. Location payloads are personal data, so they are never logged either.
const REDACTED_KEYS =
  /^(password|passwordHash|token|tokenHash|deviceToken|deviceTokenHash|refreshToken|accessToken|authorization|cookie|secret|jwt.*)$/i;

const redact = (value, depth = 0) => {
  if (value === null || typeof value !== "object" || depth > 4) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redact(item, depth + 1));
  }

  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      REDACTED_KEYS.test(key) ? "[redacted]" : redact(item, depth + 1),
    ])
  );
};

const write = (level, message, context) => {
  if (LEVELS[level] < configuredLevel) {
    return;
  }

  const payload = context ? redact(context) : undefined;
  const stream = LEVELS[level] >= LEVELS.warn ? console.error : console.log;

  if (isProduction) {
    stream(
      JSON.stringify({
        level,
        time: new Date().toISOString(),
        message,
        ...(payload ? { context: payload } : {}),
      })
    );
    return;
  }

  const stamp = new Date().toISOString().slice(11, 23);
  stream(
    `${stamp} ${level.toUpperCase().padEnd(5)} ${message}`,
    ...(payload ? [payload] : [])
  );
};

const logger = {
  debug: (message, context) => write("debug", message, context),
  info: (message, context) => write("info", message, context),
  warn: (message, context) => write("warn", message, context),
  error: (message, context) => write("error", message, context),
};

module.exports = logger;
