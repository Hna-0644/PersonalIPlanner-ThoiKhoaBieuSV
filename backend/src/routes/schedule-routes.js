const express = require('express');
const { scheduleRequestSchema, scheduleApplySchema } = require('../schemas');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../utils/async-handler');

function createScheduleRouter(scheduleService, authenticate) {
  const router = express.Router();

  router.use(authenticate);
  router.get('/events', asyncHandler(async (req, res) => {
    res.json({ data: await scheduleService.listEvents(req.user.id) });
  }));
  router.post('/auto-generate', validate(scheduleRequestSchema), asyncHandler(async (req, res) => {
    const data = await scheduleService.generate(req.user.id, req.body);
    res.json({ data });
  }));
  router.post('/apply', validate(scheduleApplySchema), asyncHandler(async (req, res) => {
    const data = await scheduleService.apply(
      req.user.id,
      req.body.plan,
      req.body.breakMinutes,
      req.body.timezone
    );
    res.json({ data });
  }));

  return router;
}

module.exports = { createScheduleRouter };
