const express = require('express');
const { classSchema, classUpdateSchema } = require('../schemas');
const { validate, validateId } = require('../middleware/validate');
const { asyncHandler } = require('../utils/async-handler');

function createClassRouter(classService, authenticate) {
  const router = express.Router();

  router.use(authenticate);
  router.get('/', asyncHandler(async (req, res) => {
    res.json({ data: await classService.list(req.user.id) });
  }));
  router.post('/', validate(classSchema), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await classService.create(req.user.id, req.body) });
  }));
  const updateClass = asyncHandler(async (req, res) => {
    res.json({ data: await classService.update(req.user.id, req.databaseId, req.body) });
  });
  router.patch('/:id', validateId('class'), validate(classUpdateSchema), updateClass);
  router.put('/:id', validateId('class'), validate(classUpdateSchema), updateClass);
  router.delete('/:id', validateId('class'), asyncHandler(async (req, res) => {
    res.json({ data: await classService.remove(req.user.id, req.databaseId) });
  }));

  return router;
}

module.exports = { createClassRouter };
