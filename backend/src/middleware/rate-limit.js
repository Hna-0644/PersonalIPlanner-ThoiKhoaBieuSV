const { AppError } = require('../utils/app-error');

/**
 * Fixed-window rate limit keyed by authenticated user ID or client IP.
 */
function createRateLimiter({
  windowMs = 60 * 1000,
  maxRequests = 5,
  store = new Map(),
  now: getNow = Date.now
} = {}) {
  const hits = store;
  let nextCleanupAt = 0;

  return (req, res, next) => {
    const key = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip || 'unknown'}`;
    const now = getNow();
    if (now >= nextCleanupAt) {
      for (const [storedKey, record] of hits) {
        if (now >= record.expiresAt) {
          hits.delete(storedKey);
        }
      }
      nextCleanupAt = now + windowMs;
    }
    const record = hits.get(key);

    if (!record || now >= record.expiresAt) {
      hits.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return next(
        new AppError(
          429,
          'RATE_LIMIT_EXCEEDED',
          'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.'
        )
      );
    }

    record.count += 1;
    return next();
  };
}

module.exports = { createRateLimiter };
