const express = require('express');
const { taskSchema, taskUpdateSchema } = require('../schemas');
const { validate, validateId } = require('../middleware/validate');
const { asyncHandler } = require('../utils/async-handler');

function createTaskRouter(taskService, authenticate) {
  const router = express.Router();

  router.use(authenticate);
  router.get('/', asyncHandler(async (req, res) => {
    res.json({ data: await taskService.list(req.user.id) });
  }));
  router.post('/', validate(taskSchema), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await taskService.create(req.user.id, req.body) });
  }));
  const updateTask = asyncHandler(async (req, res) => {
    res.json({ data: await taskService.update(req.user.id, req.databaseId, req.body) });
  });
  router.patch('/:id', validateId('task'), validate(taskUpdateSchema), updateTask);
  router.put('/:id', validateId('task'), validate(taskUpdateSchema), updateTask);
  router.delete('/:id', validateId('task'), asyncHandler(async (req, res) => {
    res.json({ data: await taskService.remove(req.user.id, req.databaseId) });
  }));

  return router;
}

module.exports = { createTaskRouter };
