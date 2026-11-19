const express = require('express');
const { validate, validateId } = require('../middleware/validate');
const { z } = require('zod');
const { createNotificationController } = require('../controllers/notification-controller');

const markReadSchema = z.object({ read: z.literal(true) }).strict();
const markAllReadSchema = z.object({ readAll: z.literal(true) }).strict();
const scanRemindersSchema = z.object({
  withinHours: z.number().int().min(1).max(720).optional()
}).strict();

function createNotificationRouter(notificationService, authenticate, notificationController) {
  const router = express.Router();
  const controller = notificationController || createNotificationController(notificationService);

  router.use(authenticate);
  router.get('/', controller.listNotifications);
  router.patch('/', validate(markAllReadSchema), controller.markAllRead);
  router.put('/read-all', controller.markAllRead);
  router.post('/reminders/scan', validate(scanRemindersSchema), controller.scanReminders);
  router.patch('/:id', validateId('notification'), validate(markReadSchema), controller.markRead);
  router.put('/:id/read', validateId('notification'), controller.markRead);

  return router;
}

module.exports = { createNotificationRouter };
