const express = require('express');
const { scheduleRequestSchema, scheduleApplySchema } = require('../schemas');
const { validate } = require('../middleware/validate');
const { createScheduleController } = require('../controllers/timetable-controller');

function createScheduleRouter(scheduleService, authenticate) {
  const router = express.Router();
  const controller = createScheduleController(scheduleService);

  router.use(authenticate);
  router.get('/events', controller.listEvents);
  router.post('/auto-generate', validate(scheduleRequestSchema), controller.autoGenerate);
  router.post('/apply', validate(scheduleApplySchema), controller.applyPlan);

  return router;
}

module.exports = { createScheduleRouter };
