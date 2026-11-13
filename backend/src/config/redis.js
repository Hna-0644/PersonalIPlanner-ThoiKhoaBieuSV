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
  let warnedOffline = false;
  const client = createClient({
    url: buildRedisUrl(config),
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 2500,
      reconnectStrategy: false
    }
  });

  client.on('error', err => {
    if (!warnedOffline) {
      warnedOffline = true;
      const reason = err?.message || err?.code || 'ECONNREFUSED';
      console.warn(`[Redis] Không thể kết nối Redis (${reason}) — Hệ thống tự động dùng trực tiếp MySQL.`);
    }
  });

  client.on('connect', () => {
    warnedOffline = false;
    console.log('Connected to Redis (planner_redis on port 6379)');
  });

  return client;
}

const redisClient = createRedisClient();

async function connectRedis(client = redisClient) {
  try {
    if (!client.isOpen) {
      await client.connect();
    }
  } catch {
    // Đã xử lý cảnh báo ở sự kiện 'error', hệ thống tiếp tục chạy bình thường với MySQL
  }
  return client;
}

async function closeRedis(client = redisClient) {
  try {
    if (client && client.isOpen) {
      await client.quit();
    }
  } catch {
    // ignore
  }
}

redisClient.redisClient = redisClient;
redisClient.connectRedis = connectRedis;
redisClient.closeRedis = closeRedis;
redisClient.createRedisClient = createRedisClient;

module.exports = redisClient;
