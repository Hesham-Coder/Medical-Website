const { createClient } = require('redis');
const {
  REDIS_URL,
  REDIS_HOST,
  REDIS_PORT,
  REDIS_PASSWORD,
  REDIS_PREFIX,
} = require('./config');
const { createPrefixedClient } = require('./redisClientWithPrefix');

function createRedisConnection() {
  const socketOptions = {
    connectTimeout: 5000,
    reconnectStrategy(retries) {
      if (retries >= 2) return false;
      return Math.min(250 * (retries + 1), 1000);
    },
  };

  const options = REDIS_URL
    ? {
        url: REDIS_URL,
        socket: socketOptions,
      }
    : {
        socket: {
          ...socketOptions,
          host: REDIS_HOST,
          port: REDIS_PORT,
        },
        password: REDIS_PASSWORD || undefined,
      };

  const rawClient = createClient(options);
  const prefixedClient = createPrefixedClient(rawClient, REDIS_PREFIX);

  return prefixedClient;
}

/**
 * Create a raw (un-prefixed) Redis connection.
 * Use this only when you explicitly need to bypass the prefix, e.g. in
 * administrative scripts or health-check probes.
 */
function createRawRedisConnection() {
  const socketOptions = {
    connectTimeout: 5000,
    reconnectStrategy(retries) {
      if (retries >= 2) return false;
      return Math.min(250 * (retries + 1), 1000);
    },
  };

  const options = REDIS_URL
    ? {
        url: REDIS_URL,
        socket: socketOptions,
      }
    : {
        socket: {
          ...socketOptions,
          host: REDIS_HOST,
          port: REDIS_PORT,
        },
        password: REDIS_PASSWORD || undefined,
      };

  return createClient(options);
}

module.exports = {
  createRedisConnection,
  createRawRedisConnection,
};
