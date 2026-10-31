const { AppError } = require('../utils/app-error');
const { toPublicId } = require('../utils/public-id');

const TASK_COLUMNS = {
  title: 'title',
  subject: 'subject',
  description: 'description',
  priority: 'priority',
  status: 'status',
  progress: 'progress',
  estimatedHours: 'estimated_hours',
  deadline: 'deadline'
};
const TASK_FIELDS = Object.keys(TASK_COLUMNS);

function createTaskService({ pool }) {
  async function list(userId) {
    const [rows] = await pool.execute(
      `SELECT id, title, subject, description, priority, status, progress,
              estimated_hours, deadline, created_at, updated_at
       FROM tasks WHERE user_id = ? ORDER BY deadline IS NULL, deadline, created_at DESC`,
      [userId]
    );
    return rows.map(mapTask);
  }

  async function create(userId, input) {
    const fields = TASK_FIELDS.filter(field => Object.hasOwn(input, field));
    const columns = fields.map(field => TASK_COLUMNS[field]);
    const values = fields.map(field => normalizeValue(field, input[field]));
    const [result] = await pool.execute(
      `INSERT INTO tasks (user_id, ${columns.join(', ')})
       VALUES (?, ${columns.map(() => '?').join(', ')})`,
      [userId, ...values]
    );
    const [rows] = await pool.execute(
      `SELECT id, title, subject, description, priority, status, progress,
              estimated_hours, deadline, created_at, updated_at
       FROM tasks WHERE id = ? AND user_id = ? LIMIT 1`,
      [result.insertId, userId]
    );
    return mapTask(rows[0]);
  }

  async function update(userId, taskId, input) {
    const [existingRows] = await pool.execute(
      'SELECT status, progress FROM tasks WHERE id = ? AND user_id = ? LIMIT 1',
      [taskId, userId]
    );
    if (!existingRows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy công việc.');
    const merged = { ...existingRows[0], ...input };
    if ((merged.status === 'done') !== (merged.progress === 100)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Trạng thái hoàn thành và tiến độ 100% phải được cập nhật cùng nhau.'
      );
    }

    const fields = Object.keys(input);
    const assignments = fields.map(field => `${TASK_COLUMNS[field]} = ?`).join(', ');
    await pool.execute(
      `UPDATE tasks SET ${assignments} WHERE id = ? AND user_id = ?`,
      [...fields.map(field => normalizeValue(field, input[field])), taskId, userId]
    );
    const [rows] = await pool.execute(
      `SELECT id, title, subject, description, priority, status, progress,
              estimated_hours, deadline, created_at, updated_at
       FROM tasks WHERE id = ? AND user_id = ? LIMIT 1`,
      [taskId, userId]
    );
    return mapTask(rows[0]);
  }

  async function remove(userId, taskId) {
    const [result] = await pool.execute(
      'DELETE FROM tasks WHERE id = ? AND user_id = ?',
      [taskId, userId]
    );
    if (!result.affectedRows) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy công việc.');
    return { id: toPublicId('task', taskId), deleted: true };
  }

  return { list, create, update, remove };
}

function normalizeValue(field, value) {
  if (field === 'deadline' && value) return new Date(value);
  if (value === undefined) return null;
  return value;
}

function mapTask(row) {
  return {
    id: toPublicId('task', row.id),
    title: row.title,
    subject: row.subject,
    description: row.description,
    priority: row.priority,
    status: row.status,
    progress: Number(row.progress),
    estimatedHours: row.estimated_hours === null ? null : Number(row.estimated_hours),
    deadline: row.deadline ? new Date(`${row.deadline}Z`).toISOString() : null,
    createdAt: row.created_at ? new Date(`${row.created_at}Z`).toISOString() : null,
    updatedAt: row.updated_at ? new Date(`${row.updated_at}Z`).toISOString() : null
  };
}

module.exports = { createTaskService };
