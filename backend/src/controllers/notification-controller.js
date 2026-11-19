const { asyncHandler } = require('../utils/async-handler');

function createNotificationController(notificationServiceInput) {
  const notificationService = notificationServiceInput?.notificationService || notificationServiceInput;

  const listNotifications = asyncHandler(async (req, res) => {
    const data = await notificationService.list(req.user.id);
    res.json({ data });
  });

  const markRead = asyncHandler(async (req, res) => {
    const data = await notificationService.markRead(req.user.id, req.databaseId);
    res.json({ data });
  });

  const markAllRead = asyncHandler(async (req, res) => {
    const data = await notificationService.markAllRead(req.user.id);
    res.json({ data });
  });

  const scanReminders = asyncHandler(async (req, res) => {
    const withinHours = req.body?.withinHours ?? req.query?.withinHours ?? 24;
    const data = await notificationService.generateDeadlineReminders(req.user.id, {
      withinHours: Number(withinHours) || 24
    });
    res.json({ data });
  });

  return {
    listNotifications,
    markRead,
    markAllRead,
    scanReminders
  };
}

module.exports = { createNotificationController };
