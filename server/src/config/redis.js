const Redis = require("ioredis");

const env = require("./env");
const logger = require("../utils/logger");

// Redis is a performance and scaling layer, never the source of truth. MongoDB
// holds every durable record, so the API must keep working when Redis is
// missing or briefly unreachable.
let client = null;

const createClient = (label) => {
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: false,
    retryStrategy: (attempt) => Math.min(attempt * 200, 5000),
  });

  connection.on("connect", () => logger.info(`Redis connected (${label})`));
  connection.on("error", (error) =>
    logger.warn(`Redis error (${label}): ${error.message}`)
  );

  return connection;
};

const connectRedis = () => {
  if (!env.REDIS_URL) {
    logger.info("REDIS_URL not set - running without Redis");
    return null;
  }

  if (!client) {
    client = createClient("main");
  }

  return client;
};

const getRedis = () => client;

const isRedisReady = () => client?.status === "ready";

// Socket.IO's adapter needs its own pair of connections because a subscribed
// client cannot run normal commands.
const createAdapterClients = () => {
  if (!env.REDIS_URL) {
    return null;
  }

  const pubClient = createClient("socket:pub");

  return { pubClient, subClient: pubClient.duplicate() };
};

const closeRedis = async () => {
  if (!client) {
    return;
  }

  try {
    await client.quit();
  } catch {
    client.disconnect();
  }

  client = null;
};

module.exports = {
  connectRedis,
  getRedis,
  isRedisReady,
  createAdapterClients,
  closeRedis,
};
