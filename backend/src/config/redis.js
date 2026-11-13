const { createClient } = require('redis');

function buildRedisUrl(config = process.env) {
  if (config.REDIS_URL) {
    return config.REDIS_URL;
  }
  const host = config.REDIS_HOST || '127.0.0.1';
  const port = config.REDIS_PORT || 6379;
  return `redis://${host}:${port}`;
}

function createRedisClient(config = process.env) {
  const client = createClient({
    url: buildRedisUrl(config),
    disableOfflineQueue: true
  });

  client.on('error', err => {
    console.error('Redis Client Error:', err.message);
  });

  client.on('connect', () => {
    console.log('Connected to Redis (planner_redis on port 6379)');
  });

  return client;
}

const redisClient = createRedisClient();

async function connectRedis(client = redisClient) {
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
}

redisClient.redisClient = redisClient;
redisClient.connectRedis = connectRedis;
redisClient.createRedisClient = createRedisClient;

module.exports = redisClient;
