const express = require('express');
const { createAiController } = require('../controllers/timetable-controller');
const { createRateLimiter } = require('../middleware/rate-limit');

function createAiRouter(aiVisionService, profileService, authenticate, options = {}) {
  const router = express.Router();
  const controller = createAiController(aiVisionService, profileService);
  const aiScanRateLimiter = createRateLimiter({
    windowMs: options.rateLimitWindowMs || 60 * 1000,
    maxRequests: options.rateLimitMax || 5
  });

  // Yêu cầu xác thực JWT
  router.use(authenticate);
  router.use(aiScanRateLimiter);

  /**
   * POST /api/ai/scan-schedule
   * Nhận ảnh chụp thời khóa biểu (base64) và trả về danh sách các lớp học nhận diện được
   */
  router.post('/scan-schedule', controller.scanSchedule);

  return router;
}

module.exports = { createAiRouter };
