function isRedisReady(redisClient) {
  return Boolean(redisClient && redisClient.isReady !== false);
}

function createCacheManager(redisClient, { prefix, ttlSeconds = 3600 } = {}) {
  if (!prefix) {
    throw new Error('Cache manager prefix is required.');
  }

  function getVersionKey(userId) {
    return `${prefix}:version:${userId}`;
  }

  function getDataKey(userId, version) {
    return `${prefix}:${userId}:${version}`;
  }

  async function resolveCurrentVersion(userId) {
    if (!isRedisReady(redisClient)) return null;
    try {
      const version = await redisClient.get(getVersionKey(userId));
      return version || '0';
    } catch (error) {
      console.error(`Failed to read cache version for ${prefix}:`, error);
      return null;
    }
  }

  async function get(userId) {
    if (!isRedisReady(redisClient)) return null;
    try {
      const version = await resolveCurrentVersion(userId);
      if (version === null) return null;

      const cacheKey = getDataKey(userId, version);
      const cachedValue = await redisClient.get(cacheKey);
      if (cachedValue === null || cachedValue === undefined) {
        return null;
      }

      try {
        return JSON.parse(cachedValue);
      } catch (parseError) {
        console.error(`Failed to parse cached JSON for ${cacheKey}:`, parseError);
        return null;
      }
    } catch (error) {
      console.error(`Failed to read cache for ${prefix}:`, error);
      return null;
    }
  }

  async function set(userId, data) {
    if (!isRedisReady(redisClient)) return false;
    try {
      const version = await resolveCurrentVersion(userId);
      if (version === null) return false;

      const cacheKey = getDataKey(userId, version);
      const payload = JSON.stringify(data);
      if (typeof redisClient.setEx === 'function') {
        await redisClient.setEx(cacheKey, ttlSeconds, payload);
      } else if (typeof redisClient.set === 'function') {
        await redisClient.set(cacheKey, payload, { EX: ttlSeconds });
      }
      return true;
    } catch (error) {
      console.error(`Failed to write cache for ${prefix}:`, error);
      return false;
    }
  }

  async function invalidate(userId) {
    if (!redisClient) return false;
    if (redisClient.isReady === false) {
      console.error(`Failed to invalidate cache for ${prefix}: Redis client is not ready.`);
      return false;
    }
    try {
      const versionKey = getVersionKey(userId);
      if (typeof redisClient.incr === 'function') {
        const nextVersion = await redisClient.incr(versionKey);
        if (typeof redisClient.del === 'function') {
          await redisClient.del(getDataKey(userId, nextVersion - 1));
        }
      } else if (typeof redisClient.del === 'function') {
        await redisClient.del(versionKey);
        await redisClient.del(getDataKey(userId, '0'));
      }
      return true;
    } catch (error) {
      console.error(`Failed to invalidate cache for ${prefix}:`, error);
      return false;
    }
  }

  return {
    get,
    set,
    invalidate,
    getVersionKey,
    getDataKey
  };
}

module.exports = {
  createCacheManager,
  isRedisReady
};
