/**
 * Session Store Configuration
 * Automatically uses Redis (Upstash for Vercel, local for Railway)
 */

const connectRedis = require('connect-redis');
const RedisStoreCtor = connectRedis.default || connectRedis.RedisStore || connectRedis;
const { createRedisConnection } = require('./redisClient');

function createSessionStore(session) {
  const redisClient = createRedisConnection();
  
  return new RedisStoreCtor({
    client: redisClient,
    prefix: 'sess:',
  });
}

module.exports = {
  createSessionStore,
};
