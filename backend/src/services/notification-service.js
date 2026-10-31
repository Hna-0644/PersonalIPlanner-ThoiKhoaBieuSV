const { AppError } = require('../utils/app-error');
const { toPublicId } = require('../utils/public-id');

function createNotificationService({ pool }) {
  async function list(userId) {
    const [rows] = await pool.execute(
      `SELECT id, type, title, message, read_at, created_at
       FROM notifications WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 100`,
      [userId]
    );
    return rows.map(mapNotification);
  }

  async function markRead(userId, notificationId) {
    await pool.execute(
      `UPDATE notifications SET read_at = COALESCE(read_at, UTC_TIMESTAMP(3))
       WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );
    const [rows] = await pool.execute(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ? LIMIT 1',
      [notificationId, userId]
    );
    if (!rows.length) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thông báo.');
    return { id: toPublicId('notification', notificationId), read: true };
  }

  async function markAllRead(userId) {
    const [result] = await pool.execute(
      `UPDATE notifications SET read_at = UTC_TIMESTAMP(3)
       WHERE user_id = ? AND read_at IS NULL`,
      [userId]
    );
    return { updatedCount: result.affectedRows };
  }

  return { list, markRead, markAllRead };
}

function mapNotification(row) {
  const createdAt = row.created_at instanceof Date
    ? row.created_at
    : new Date(`${row.created_at}Z`);
  return {
    id: toPublicId('notification', row.id),
    type: row.type,
    title: row.title,
    message: row.message,
    read: Boolean(row.read_at),
    createdAt: createdAt.toISOString()
  };
}

module.exports = { createNotificationService };
