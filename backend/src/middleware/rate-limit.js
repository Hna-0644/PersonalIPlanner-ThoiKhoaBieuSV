const { AppError } = require('../utils/app-error');

/**
 * Rate Limiter chống spam đăng tin Marketplace
 * Giới hạn theo userId (nếu đã xác thực) hoặc IP
 */
function createRateLimiter({ windowMs = 60 * 1000, maxRequests = 5 } = {}) {
  const hits = new Map();

  return (req, res, next) => {
    const key = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip || 'unknown'}`;
    const now = Date.now();
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
