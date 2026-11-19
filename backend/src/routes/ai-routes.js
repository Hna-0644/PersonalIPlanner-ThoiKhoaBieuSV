const express = require('express');
const { createAiController } = require('../controllers/timetable-controller');

function createAiRouter(aiVisionService, profileService, authenticate) {
  const router = express.Router();
  const controller = createAiController(aiVisionService, profileService);

  // Yêu cầu xác thực JWT
  router.use(authenticate);

  /**
   * POST /api/ai/scan-schedule
   * Nhận ảnh chụp thời khóa biểu (base64) và trả về danh sách các lớp học nhận diện được
   */
  router.post('/scan-schedule', controller.scanSchedule);

  return router;
}

module.exports = { createAiRouter };
