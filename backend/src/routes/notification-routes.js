const express = require('express');
const { validate, validateId } = require('../middleware/validate');
const { z } = require('zod');
const { asyncHandler } = require('../utils/async-handler');
const markReadSchema = z.object({ read: z.literal(true) }).strict();
const markAllReadSchema = z.object({ readAll: z.literal(true) }).strict();

function createNotificationRouter(notificationService, authenticate) {
  const router = express.Router();

  router.use(authenticate);
  router.get('/', asyncHandler(async (req, res) => {
    res.json({ data: await notificationService.list(req.user.id) });
  }));
  const markAllRead = asyncHandler(async (req, res) => {
    res.json({ data: await notificationService.markAllRead(req.user.id) });
  });
  router.patch('/', validate(markAllReadSchema), markAllRead);
  router.put('/read-all', markAllRead);
  const markOneRead = asyncHandler(async (req, res) => {
    res.json({ data: await notificationService.markRead(req.user.id, req.databaseId) });
  });
  router.patch('/:id', validateId('notification'), validate(markReadSchema), markOneRead);
  router.put('/:id/read', validateId('notification'), markOneRead);

  return router;
}

module.exports = { createNotificationRouter };
