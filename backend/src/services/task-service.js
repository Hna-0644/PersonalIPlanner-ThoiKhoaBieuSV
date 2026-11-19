const { AppError } = require('../utils/app-error');
const { toPublicId } = require('../utils/public-id');
const { toDatabaseUtc, toIsoUtcString } = require('../utils/timezone');
const { createCacheManager } = require('../utils/cache-manager');
const {
  findTasksByUserId,
  findTaskByIdAndUser,
  insertTask,
  updateTaskByIdAndUser,
  deleteTaskByIdAndUser
} = require('../repositories/task-repository');

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
const TASKS_CACHE_TTL_SECONDS = 3600;

function createTaskService({ pool, redisClient } = {}) {
  const cache = createCacheManager(redisClient, {
    prefix: 'tasks:list',
    ttlSeconds: TASKS_CACHE_TTL_SECONDS
  });

  async function list(userId) {
    const cachedTasks = await cache.get(userId);
    if (Array.isArray(cachedTasks)) {
      return cachedTasks;
    }

    const rows = await findTasksByUserId(pool, userId);
    const tasks = rows.map(mapTask);
    await cache.set(userId, tasks);
    return tasks;
  }

  async function create(userId, input) {
    const fields = TASK_FIELDS.filter(field => Object.hasOwn(input, field));
    const columns = fields.map(field => TASK_COLUMNS[field]);
    const values = fields.map(field => normalizeValue(field, input[field]));

    const insertId = await insertTask(pool, userId, columns, values);
    const row = await findTaskByIdAndUser(pool, insertId, userId);
    await cache.invalidate(userId);
    return mapTask(row);
  }

  async function update(userId, taskId, input) {
    const existingRow = await findTaskByIdAndUser(pool, taskId, userId);
    if (!existingRow) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy công việc.');
    }

    const merged = { ...existingRow, ...input };
    if ((merged.status === 'done') !== (merged.progress === 100)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Trạng thái hoàn thành và tiến độ 100% phải được cập nhật cùng nhau.'
      );
    }

    const fields = Object.keys(input).filter(field => Object.hasOwn(TASK_COLUMNS, field));
    const assignments = fields.map(field => `${TASK_COLUMNS[field]} = ?`).join(', ');
    const values = fields.map(field => normalizeValue(field, input[field]));

    await updateTaskByIdAndUser(pool, taskId, userId, assignments, values);
    const row = await findTaskByIdAndUser(pool, taskId, userId);
    await cache.invalidate(userId);
    return mapTask(row);
  }

  async function remove(userId, taskId) {
    const affectedRows = await deleteTaskByIdAndUser(pool, taskId, userId);
    if (!affectedRows) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy công việc.');
    }
    await cache.invalidate(userId);
    return { id: toPublicId('task', taskId), deleted: true };
  }

  return { list, create, update, remove };
}

function normalizeValue(field, value) {
  if (field === 'deadline' && value) return toDatabaseUtc(value);
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
    deadline: row.deadline ? toIsoUtcString(row.deadline) : null,
    createdAt: row.created_at ? toIsoUtcString(row.created_at) : null,
    updatedAt: row.updated_at ? toIsoUtcString(row.updated_at) : null
  };
}

module.exports = { createTaskService, mapTask, normalizeValue };
