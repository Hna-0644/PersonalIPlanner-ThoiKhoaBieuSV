const { AppError } = require('../utils/app-error');
const { toPublicId } = require('../utils/public-id');
const {
  toIsoUtcString,
  toPresentationIso,
  nowUtc,
  DEFAULT_TIMEZONE
} = require('../utils/timezone');
const { createCacheManager } = require('../utils/cache-manager');
const {
  findNotificationsByUserId,
  markNotificationRead,
  markAllNotificationsRead,
  createReminderNotificationIfNotExists
} = require('../repositories/notification-repository');
const { findUpcomingDeadlineTasks } = require('../repositories/task-repository');

const NOTIFICATIONS_CACHE_TTL_SECONDS = 300;

function createNotificationService({ pool, redisClient } = {}) {
  const cache = createCacheManager(redisClient, {
    prefix: 'notifications:list',
    ttlSeconds: NOTIFICATIONS_CACHE_TTL_SECONDS
  });

  async function list(userId) {
    const cachedNotifications = await cache.get(userId);
    if (Array.isArray(cachedNotifications)) {
      return cachedNotifications;
    }

    const rows = await findNotificationsByUserId(pool, userId, 100);
    const notifications = rows.map(mapNotification);
    await cache.set(userId, notifications);
    return notifications;
  }

  async function markRead(userId, notificationId) {
    const exists = await markNotificationRead(pool, userId, notificationId);
    if (!exists) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thông báo.');
    }
    await cache.invalidate(userId);
    return { id: toPublicId('notification', notificationId), read: true };
  }

  async function markAllRead(userId) {
    const updatedCount = await markAllNotificationsRead(pool, userId);
    await cache.invalidate(userId);
    return { updatedCount };
  }

  async function generateDeadlineReminders(userId, { withinHours = 24 } = {}) {
    const safeHours = Math.max(1, Number(withinHours) || 24);
    const upcomingTasks = await findUpcomingDeadlineTasks(pool, userId, safeHours);
    const createdNotifications = [];

    for (const task of upcomingTasks) {
      const deadlinePresentation = toPresentationIso(task.deadline, DEFAULT_TIMEZONE);
      const deadlineDisplay = deadlinePresentation
        ? deadlinePresentation.slice(0, 16).replace('T', ' ')
        : toIsoUtcString(task.deadline);
      const title = `Sắp đến hạn: ${task.title}`;
      const message = `Công việc "${task.title}" sẽ đến hạn vào lúc ${deadlineDisplay}. Hãy ưu tiên hoàn thành đúng hạn!`;

      const { created, notification } = await createReminderNotificationIfNotExists(
        pool,
        userId,
        {
          type: 'urgent',
          title,
          message,
          scheduledAt: nowUtc(),
          deliveryStatus: 'scheduled'
        }
      );

      if (created && notification) {
        createdNotifications.push(mapNotification(notification));
      }
    }

    if (createdNotifications.length > 0) {
      await cache.invalidate(userId);
    }

    return {
      scannedCount: upcomingTasks.length,
      createdCount: createdNotifications.length,
      notifications: createdNotifications
    };
  }

  return {
    list,
    markRead,
    markAllRead,
    generateDeadlineReminders
  };
}

function mapNotification(row) {
  return {
    id: toPublicId('notification', row.id),
    type: row.type,
    title: row.title,
    message: row.message,
    read: Boolean(row.read_at),
    createdAt: toIsoUtcString(row.created_at)
  };
}

module.exports = { createNotificationService, mapNotification };
