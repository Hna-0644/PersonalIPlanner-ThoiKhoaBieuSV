const { nowUtc, toSqlUtcString } = require('../utils/timezone');

const TASK_SELECT_COLUMNS = `id, title, subject, description, priority, status, progress,
              estimated_hours, deadline, created_at, updated_at`;

async function findTasksByUserId(pool, userId) {
  const [rows] = await pool.execute(
    `SELECT ${TASK_SELECT_COLUMNS}
     FROM tasks WHERE user_id = ? ORDER BY deadline IS NULL, deadline, created_at DESC`,
    [userId]
  );
  return rows;
}

async function findTaskByIdAndUser(pool, taskId, userId) {
  const [rows] = await pool.execute(
    `SELECT ${TASK_SELECT_COLUMNS}
     FROM tasks WHERE id = ? AND user_id = ? LIMIT 1`,
    [taskId, userId]
  );
  return rows[0] || null;
}

async function insertTask(pool, userId, columns, values) {
  const hasColumns = Array.isArray(columns) && columns.length > 0;
  const columnClause = hasColumns ? `, ${columns.join(', ')}` : '';
  const placeholderClause = hasColumns ? `, ${columns.map(() => '?').join(', ')}` : '';
  const params = hasColumns ? [userId, ...values] : [userId];

  const [result] = await pool.execute(
    `INSERT INTO tasks (user_id${columnClause})
     VALUES (?${placeholderClause})`,
    params
  );
  return result.insertId;
}

async function updateTaskByIdAndUser(pool, taskId, userId, assignments, values) {
  const assignmentClause = Array.isArray(assignments)
    ? assignments.join(', ')
    : String(assignments);
  const [result] = await pool.execute(
    `UPDATE tasks SET ${assignmentClause} WHERE id = ? AND user_id = ?`,
    [...values, taskId, userId]
  );
  return result.affectedRows;
}

async function deleteTaskByIdAndUser(pool, taskId, userId) {
  const [result] = await pool.execute(
    'DELETE FROM tasks WHERE id = ? AND user_id = ?',
    [taskId, userId]
  );
  return result.affectedRows;
}

async function findUpcomingDeadlineTasks(pool, userId, withinHours = 24) {
  const now = nowUtc();
  const upperBound = now.plus({ hours: Number(withinHours) || 24 });
  const [rows] = await pool.execute(
    `SELECT ${TASK_SELECT_COLUMNS}
     FROM tasks
     WHERE user_id = ?
       AND status IN ('todo', 'inprogress')
       AND deadline IS NOT NULL
       AND deadline >= ?
       AND deadline <= ?
     ORDER BY deadline ASC`,
    [userId, toSqlUtcString(now), toSqlUtcString(upperBound)]
  );
  return rows;
}

function createTaskRepository({ pool }) {
  return {
    findTasksByUserId: (userId) => findTasksByUserId(pool, userId),
    findTaskByIdAndUser: (taskId, userId) => findTaskByIdAndUser(pool, taskId, userId),
    insertTask: (userId, columns, values) => insertTask(pool, userId, columns, values),
    updateTaskByIdAndUser: (taskId, userId, assignments, values) =>
      updateTaskByIdAndUser(pool, taskId, userId, assignments, values),
    deleteTaskByIdAndUser: (taskId, userId) => deleteTaskByIdAndUser(pool, taskId, userId),
    findUpcomingDeadlineTasks: (userId, withinHours) =>
      findUpcomingDeadlineTasks(pool, userId, withinHours)
  };
}

module.exports = {
  createTaskRepository,
  findTasksByUserId,
  findTaskByIdAndUser,
  insertTask,
  updateTaskByIdAndUser,
  deleteTaskByIdAndUser,
  findUpcomingDeadlineTasks
};
