const express = require('express');
const { workScheduleSchema, workScheduleUpdateSchema } = require('../schemas');
const { validate, validateId } = require('../middleware/validate');
const { asyncHandler } = require('../utils/async-handler');

function createWorkScheduleRouter(workScheduleService, authenticate) {
  const router = express.Router();

  router.use(authenticate);

  router.get('/', asyncHandler(async (req, res) => {
    res.json({ data: await workScheduleService.list(req.user.id) });
  }));

  router.post('/', validate(workScheduleSchema), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await workScheduleService.create(req.user.id, req.body) });
  }));

  const updateWorkSchedule = asyncHandler(async (req, res) => {
    res.json({ data: await workScheduleService.update(req.user.id, req.params.id, req.body) });
  });

  router.patch('/:id', validateId('work'), validate(workScheduleUpdateSchema), updateWorkSchedule);
  router.put('/:id', validateId('work'), validate(workScheduleUpdateSchema), updateWorkSchedule);

  router.delete('/:id', validateId('work'), asyncHandler(async (req, res) => {
    await workScheduleService.remove(req.user.id, req.params.id);
    res.json({ data: { success: true } });
  }));

  return router;
}

module.exports = { createWorkScheduleRouter };
