const express = require('express');
const { workScheduleSchema, workScheduleUpdateSchema } = require('../schemas');
const { validate, validateId } = require('../middleware/validate');
const { createWorkScheduleController } = require('../controllers/timetable-controller');

function createWorkScheduleRouter(workScheduleService, authenticate) {
  const router = express.Router();
  const controller = createWorkScheduleController(workScheduleService);

  router.use(authenticate);
  router.get('/', controller.listWorkSchedules);
  router.post('/', validate(workScheduleSchema), controller.createWorkSchedule);
  router.patch('/:id', validateId('work'), validate(workScheduleUpdateSchema), controller.updateWorkSchedule);
  router.put('/:id', validateId('work'), validate(workScheduleUpdateSchema), controller.updateWorkSchedule);
  router.delete('/:id', validateId('work'), controller.deleteWorkSchedule);

  return router;
}

module.exports = { createWorkScheduleRouter };
