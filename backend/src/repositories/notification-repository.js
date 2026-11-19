const { nowUtc, toSqlUtcString } = require('../utils/timezone');

async function findNotificationsByUserId(pool, userId, limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const [rows] = await pool.execute(
    `SELECT id, type, title, message, read_at, scheduled_at, delivery_status, created_at
     FROM notifications WHERE user_id = ?
     ORDER BY created_at DESC LIMIT ${safeLimit}`,
    [userId]
  );
  return rows;
}

async function markNotificationRead(pool, userId, notificationId) {
  await pool.execute(
    `UPDATE notifications SET read_at = COALESCE(read_at, UTC_TIMESTAMP(3))
     WHERE id = ? AND user_id = ?`,
    [notificationId, userId]
  );
  const [rows] = await pool.execute(
    'SELECT id FROM notifications WHERE id = ? AND user_id = ? LIMIT 1',
    [notificationId, userId]
  );
  return rows.length > 0;
}

async function markAllNotificationsRead(pool, userId) {
  const [result] = await pool.execute(
    `UPDATE notifications SET read_at = UTC_TIMESTAMP(3)
     WHERE user_id = ? AND read_at IS NULL`,
    [userId]
  );
  return result.affectedRows;
}

async function createReminderNotificationIfNotExists(
  pool,
  userId,
  { type = 'urgent', title, message, scheduledAt = null, deliveryStatus = 'scheduled' }
) {
  const [existingRows] = await pool.execute(
    `SELECT id, type, title, message, read_at, scheduled_at, delivery_status, created_at
     FROM notifications
     WHERE user_id = ? AND read_at IS NULL AND title = ? AND message = ?
     LIMIT 1`,
    [userId, title, message]
  );
  if (existingRows[0]) {
    return { created: false, notification: existingRows[0] };
  }

  const scheduledSql = scheduledAt ? toSqlUtcString(scheduledAt) : toSqlUtcString(nowUtc());
  const [result] = await pool.execute(
    `INSERT INTO notifications (user_id, type, title, message, scheduled_at, delivery_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, type, title, message, scheduledSql, deliveryStatus]
  );

  const [insertedRows] = await pool.execute(
    `SELECT id, type, title, message, read_at, scheduled_at, delivery_status, created_at
     FROM notifications
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [result.insertId, userId]
  );

  return {
    created: true,
    notification: insertedRows[0] || {
      id: result.insertId,
      type,
      title,
      message,
      read_at: null,
      scheduled_at: scheduledSql,
      delivery_status: deliveryStatus,
      created_at: scheduledSql
    }
  };
}

function createNotificationRepository({ pool }) {
  return {
    findNotificationsByUserId: (userId, limit) => findNotificationsByUserId(pool, userId, limit),
    markNotificationRead: (userId, notificationId) => markNotificationRead(pool, userId, notificationId),
    markAllNotificationsRead: (userId) => markAllNotificationsRead(pool, userId),
    createReminderNotificationIfNotExists: (userId, payload) =>
      createReminderNotificationIfNotExists(pool, userId, payload)
  };
}

module.exports = {
  createNotificationRepository,
  findNotificationsByUserId,
  markNotificationRead,
  markAllNotificationsRead,
  createReminderNotificationIfNotExists
};
