const express = require('express');
const { asyncHandler } = require('../utils/async-handler');

function createAiRouter(aiVisionService, profileService, authenticate) {
  const router = express.Router();

  // Yêu cầu xác thực JWT
  router.use(authenticate);

  /**
   * POST /api/ai/scan-schedule
   * Nhận ảnh chụp thời khóa biểu (base64) và trả về danh sách các lớp học nhận diện được
   */
  router.post('/scan-schedule', asyncHandler(async (req, res) => {
    const { image, periodFormat } = req.body;
    const profile = await profileService.getProfile(req.user.id);
    const result = await aiVisionService.scanScheduleImage({
      image,
      periodFormat,
      university: profile.university
    });
    res.json({ data: result });
  }));

  return router;
}

module.exports = { createAiRouter };

