/**
 * Redis prefix wrapper.
 *
 * Wraps a redis client so that every key-based operation automatically has the
 * service-specific prefix prepended.  This guarantees complete data isolation
 * when multiple services (e.g. SATT and Medical-Website) share the same Redis
 * instance.
 *
 * Supported commands:
 *   GET, SET, DEL, EXISTS, EXPIRE, TTL, PERSIST, TYPE,
 *   INCR, INCRBY, DECR, DECRBY,
 *   LPUSH, RPUSH, LPOP, RPOP, LRANGE, LLEN,
 *   HSET, HGET, HDEL, HGETALL, HMSET, HMGET, HEXISTS, HLEN,
 *   SADD, SREM, SMEMBERS, SISMEMBER, SCARD,
 *   ZADD, ZREM, ZRANGE, ZRANGEBYSCORE, ZSCORE, ZCARD,
 *   GETSET, SETNX, SETEX, PSETEX, GETEX, GETDEL
 */

const logger = require('./logger');

/**
 * Validate that a key already carries the expected prefix.
 * Throws if the key is missing the prefix so that callers cannot accidentally
 * reach another service's data.
 *
 * @param {string} key
 * @param {string} prefix
 */
function assertPrefix(key, prefix) {
  if (!key.startsWith(prefix)) {
    const msg = `Redis key "${key}" does not start with the required prefix "${prefix}". Operation blocked to prevent cross-service data access.`;
    logger.warn(msg);
    throw new Error(msg);
  }
}

/**
 * Prepend the prefix to a single key.
 *
 * @param {string} key
 * @param {string} prefix
 * @returns {string}
 */
function prefixKey(key, prefix) {
  return `${prefix}${key}`;
}

/**
 * Prepend the prefix to every key in an array.
 *
 * @param {string[]} keys
 * @param {string} prefix
 * @returns {string[]}
 */
function prefixKeys(keys, prefix) {
  return keys.map((k) => prefixKey(k, prefix));
}

/**
 * Create a prefixed Redis client that wraps the provided raw client.
 *
 * All key-based operations will automatically have `prefix` prepended to the
 * key argument(s).  The wrapper also validates that any key passed in does NOT
 * already carry the prefix (to avoid double-prefixing) and that the resulting
 * key starts with the prefix (to prevent cross-service access).
 *
 * The raw client is still accessible via `prefixedClient.raw` for operations
 * that genuinely need to bypass the prefix (e.g. administrative scripts).
 *
 * @param {import('redis').RedisClientType} client  Connected redis client.
 * @param {string} prefix  The prefix string, e.g. "satt_" or "medical_".
 * @returns {object}  Proxy object exposing the same API as the redis client.
 */
function createPrefixedClient(client, prefix) {
  if (!prefix || typeof prefix !== 'string') {
    throw new Error('A non-empty string prefix is required to create a prefixed Redis client.');
  }

  /**
   * Wrap a single-key command so the prefix is applied automatically.
   * The key is always the first argument.
   *
   * @param {string} method  Name of the method on the underlying client.
   * @returns {Function}
   */
  function wrapSingleKey(method) {
    return function (key, ...args) {
      const prefixed = prefixKey(key, prefix);
      assertPrefix(prefixed, prefix);
      return client[method](prefixed, ...args);
    };
  }

  /**
   * Wrap a multi-key command where ALL positional arguments are keys.
   * Used for commands like DEL and EXISTS that accept variadic key lists.
   *
   * @param {string} method
   * @returns {Function}
   */
  function wrapMultiKey(method) {
    return function (...keys) {
      const prefixed = prefixKeys(keys, prefix);
      prefixed.forEach((k) => assertPrefix(k, prefix));
      return client[method](...prefixed);
    };
  }

  const prefixedClient = {
    // ── Expose the raw client for administrative / escape-hatch use ──────────
    raw: client,

    // ── Passthrough non-key properties ───────────────────────────────────────
    get isReady() {
      return client.isReady;
    },
    get isOpen() {
      return client.isOpen;
    },
    on(...args) {
      return client.on(...args);
    },
    connect(...args) {
      return client.connect(...args);
    },
    disconnect(...args) {
      return client.disconnect(...args);
    },
    quit(...args) {
      return client.quit(...args);
    },

    // ── String commands ───────────────────────────────────────────────────────
    get: wrapSingleKey('get'),
    set: wrapSingleKey('set'),
    getSet: wrapSingleKey('getSet'),
    getEx: wrapSingleKey('getEx'),
    getDel: wrapSingleKey('getDel'),
    setNX: wrapSingleKey('setNX'),
    setEx: wrapSingleKey('setEx'),
    pSetEx: wrapSingleKey('pSetEx'),

    // ── Key commands ──────────────────────────────────────────────────────────
    del: wrapMultiKey('del'),
    exists: wrapMultiKey('exists'),
    expire: wrapSingleKey('expire'),
    expireAt: wrapSingleKey('expireAt'),
    pExpire: wrapSingleKey('pExpire'),
    pExpireAt: wrapSingleKey('pExpireAt'),
    ttl: wrapSingleKey('ttl'),
    pTtl: wrapSingleKey('pTtl'),
    persist: wrapSingleKey('persist'),
    type: wrapSingleKey('type'),
    rename(key, newKey) {
      const prefixedKey = prefixKey(key, prefix);
      const prefixedNewKey = prefixKey(newKey, prefix);
      assertPrefix(prefixedKey, prefix);
      assertPrefix(prefixedNewKey, prefix);
      return client.rename(prefixedKey, prefixedNewKey);
    },

    // ── Numeric commands ──────────────────────────────────────────────────────
    incr: wrapSingleKey('incr'),
    incrBy: wrapSingleKey('incrBy'),
    incrByFloat: wrapSingleKey('incrByFloat'),
    decr: wrapSingleKey('decr'),
    decrBy: wrapSingleKey('decrBy'),

    // ── List commands ─────────────────────────────────────────────────────────
    lPush: wrapSingleKey('lPush'),
    rPush: wrapSingleKey('rPush'),
    lPop: wrapSingleKey('lPop'),
    rPop: wrapSingleKey('rPop'),
    lRange: wrapSingleKey('lRange'),
    lLen: wrapSingleKey('lLen'),
    lRem: wrapSingleKey('lRem'),
    lSet: wrapSingleKey('lSet'),
    lIndex: wrapSingleKey('lIndex'),
    lInsert: wrapSingleKey('lInsert'),
    lTrim: wrapSingleKey('lTrim'),

    // ── Hash commands ─────────────────────────────────────────────────────────
    hSet: wrapSingleKey('hSet'),
    hGet: wrapSingleKey('hGet'),
    hDel: wrapSingleKey('hDel'),
    hGetAll: wrapSingleKey('hGetAll'),
    hmSet: wrapSingleKey('hmSet'),
    hmGet: wrapSingleKey('hmGet'),
    hExists: wrapSingleKey('hExists'),
    hLen: wrapSingleKey('hLen'),
    hKeys: wrapSingleKey('hKeys'),
    hVals: wrapSingleKey('hVals'),
    hIncrBy: wrapSingleKey('hIncrBy'),
    hIncrByFloat: wrapSingleKey('hIncrByFloat'),

    // ── Set commands ──────────────────────────────────────────────────────────
    sAdd: wrapSingleKey('sAdd'),
    sRem: wrapSingleKey('sRem'),
    sMembers: wrapSingleKey('sMembers'),
    sIsMember: wrapSingleKey('sIsMember'),
    sCard: wrapSingleKey('sCard'),
    sPop: wrapSingleKey('sPop'),
    sRandMember: wrapSingleKey('sRandMember'),

    // ── Sorted-set commands ───────────────────────────────────────────────────
    zAdd: wrapSingleKey('zAdd'),
    zRem: wrapSingleKey('zRem'),
    zRange: wrapSingleKey('zRange'),
    zRangeByScore: wrapSingleKey('zRangeByScore'),
    zRangeByLex: wrapSingleKey('zRangeByLex'),
    zRevRange: wrapSingleKey('zRevRange'),
    zRevRangeByScore: wrapSingleKey('zRevRangeByScore'),
    zScore: wrapSingleKey('zScore'),
    zCard: wrapSingleKey('zCard'),
    zCount: wrapSingleKey('zCount'),
    zRank: wrapSingleKey('zRank'),
    zRevRank: wrapSingleKey('zRevRank'),
    zIncrBy: wrapSingleKey('zIncrBy'),
    zRemRangeByRank: wrapSingleKey('zRemRangeByRank'),
    zRemRangeByScore: wrapSingleKey('zRemRangeByScore'),
  };

  return prefixedClient;
}

module.exports = { createPrefixedClient };
