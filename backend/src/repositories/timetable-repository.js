const { AppError } = require('../utils/app-error');

const CLASS_FIELDS = [
  'title', 'code', 'room', 'lecturer', 'dayOfWeek', 'startTime', 'endTime',
  'semesterStart', 'semesterEnd', 'color', 'notes'
];

const CLASS_COLUMNS = {
  title: 'title',
  code: 'code',
  room: 'room',
  lecturer: 'lecturer',
  dayOfWeek: 'day_of_week',
  startTime: 'start_time',
  endTime: 'end_time',
  semesterStart: 'semester_start',
  semesterEnd: 'semester_end',
  color: 'color',
  notes: 'notes'
};

const WORK_SCHEDULE_FIELDS = [
  'title', 'workplace', 'dayOfWeek', 'workDate', 'startTime', 'endTime',
  'startDate', 'endDate', 'color', 'notes'
];

const WORK_SCHEDULE_COLUMNS = {
  title: 'title',
  workplace: 'workplace',
  dayOfWeek: 'day_of_week',
  workDate: 'work_date',
  startTime: 'start_time',
  endTime: 'end_time',
  startDate: 'start_date',
  endDate: 'end_date',
  color: 'color',
  notes: 'notes'
};

/**
 * Khóa dòng user để chống race condition khi kiểm tra trùng lịch và apply kế hoạch.
 */
async function lockUser(connection, userId) {
  const [rows] = await connection.execute(
    'SELECT id FROM users WHERE id = ? FOR UPDATE',
    [userId]
  );
  if (!rows.length) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng.');
  }
}

// ============================================================================
// CLASSES REPOSITORY
// ============================================================================

async function listClassesByUser(executor, userId) {
  const [rows] = await executor.execute(
    `SELECT id, title, code, room, lecturer, day_of_week, start_time, end_time,
            semester_start, semester_end, color, notes
     FROM classes WHERE user_id = ? ORDER BY day_of_week, start_time`,
    [userId]
  );
  return rows;
}

async function listClassSlotsByUser(executor, userId) {
  const [rows] = await executor.execute(
    `SELECT id, title, day_of_week, start_time, end_time, semester_start, semester_end
     FROM classes WHERE user_id = ?`,
    [userId]
  );
  return rows;
}

async function findClassForUpdate(connection, classId, userId) {
  const [rows] = await connection.execute(
    `SELECT id, title, code, room, lecturer, day_of_week, start_time, end_time,
            semester_start, semester_end, color, notes
     FROM classes WHERE id = ? AND user_id = ? FOR UPDATE`,
    [classId, userId]
  );
  return rows[0] || null;
}

async function findClassConflicts(connection, userId, entry, excludeId = null) {
  const [rows] = await connection.execute(
    `SELECT id, title, start_time, end_time
     FROM classes
     WHERE user_id = ? AND day_of_week = ?
       AND start_time < ? AND end_time > ?
       AND (? IS NULL OR semester_start IS NULL OR semester_start <= ?)
       AND (? IS NULL OR semester_end IS NULL OR semester_end >= ?)
       AND (? IS NULL OR id <> ?)`,
    [
      userId,
      entry.dayOfWeek,
      entry.endTime,
      entry.startTime,
      entry.semesterEnd || null,
      entry.semesterEnd || null,
      entry.semesterStart || null,
      entry.semesterStart || null,
      excludeId,
      excludeId
    ]
  );
  return rows;
}

async function insertClass(connection, userId, input) {
  const columns = CLASS_FIELDS.map(field => CLASS_COLUMNS[field]);
  const values = CLASS_FIELDS.map(field => input[field] ?? null);
  const [result] = await connection.execute(
    `INSERT INTO classes (user_id, ${columns.join(', ')})
     VALUES (?, ${columns.map(() => '?').join(', ')})`,
    [userId, ...values]
  );
  return result.insertId;
}

async function updateClassById(connection, userId, classId, input) {
  const entries = Object.entries(input).filter(([field]) => CLASS_COLUMNS[field]);
  if (!entries.length) return 0;
  const assignments = entries.map(([field]) => `${CLASS_COLUMNS[field]} = ?`).join(', ');
  const [result] = await connection.execute(
    `UPDATE classes SET ${assignments} WHERE id = ? AND user_id = ?`,
    [...entries.map(([, value]) => value ?? null), classId, userId]
  );
  return result.affectedRows;
}

async function deleteClassById(executor, userId, classId) {
  const [result] = await executor.execute(
    'DELETE FROM classes WHERE id = ? AND user_id = ?',
    [classId, userId]
  );
  return result.affectedRows;
}

// ============================================================================
// WORK SCHEDULES REPOSITORY
// ============================================================================

async function listWorkSchedulesByUser(executor, userId) {
  const [rows] = await executor.execute(
    `SELECT id, user_id, title, workplace, day_of_week, work_date, start_time, end_time,
            start_date, end_date, color, notes, created_at, updated_at
     FROM work_schedules
     WHERE user_id = ?
     ORDER BY day_of_week, work_date, start_time`,
    [userId]
  );
  return rows;
}

async function listWorkScheduleSlotsByUser(executor, userId) {
  const [rows] = await executor.execute(
    `SELECT id, title, workplace, day_of_week, work_date, start_time, end_time,
            start_date, end_date, color, notes
     FROM work_schedules WHERE user_id = ?`,
    [userId]
  );
  return rows;
}

async function listWorkSchedulesForUpdate(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT id, title, day_of_week, work_date, start_time, end_time, start_date, end_date
     FROM work_schedules
     WHERE user_id = ?
     FOR UPDATE`,
    [userId]
  );
  return rows;
}

async function findWorkScheduleForUpdate(connection, dbId, userId) {
  const [rows] = await connection.execute(
    `SELECT id, user_id, title, workplace, day_of_week, work_date, start_time, end_time,
            start_date, end_date, color, notes, created_at, updated_at
     FROM work_schedules
     WHERE id = ? AND user_id = ?
     FOR UPDATE`,
    [dbId, userId]
  );
  return rows[0] || null;
}

async function insertWorkSchedule(connection, userId, normalizedInput) {
  const columns = WORK_SCHEDULE_FIELDS.map(f => WORK_SCHEDULE_COLUMNS[f]);
  const values = WORK_SCHEDULE_FIELDS.map(f => normalizedInput[f] ?? null);
  const [result] = await connection.execute(
    `INSERT INTO work_schedules (user_id, ${columns.join(', ')})
     VALUES (?, ${columns.map(() => '?').join(', ')})`,
    [userId, ...values]
  );
  return result.insertId;
}

async function updateWorkScheduleById(connection, userId, dbId, input) {
  const entries = Object.entries(input).filter(([field]) => WORK_SCHEDULE_COLUMNS[field]);
  if (!entries.length) return 0;
  const assignments = entries.map(([field]) => `${WORK_SCHEDULE_COLUMNS[field]} = ?`).join(', ');
  const [result] = await connection.execute(
    `UPDATE work_schedules SET ${assignments} WHERE id = ? AND user_id = ?`,
    [...entries.map(([, value]) => value ?? null), dbId, userId]
  );
  return result.affectedRows;
}

async function deleteWorkScheduleById(executor, userId, dbId) {
  const [result] = await executor.execute(
    'DELETE FROM work_schedules WHERE id = ? AND user_id = ?',
    [dbId, userId]
  );
  return result.affectedRows;
}

// ============================================================================
// SCHEDULED EVENTS & AUTO-SCHEDULE REPOSITORY
// ============================================================================

async function listScheduledEventsByUser(executor, userId) {
  const [rows] = await executor.execute(
    `SELECT id, task_id, title, subject, start_at, end_at, source, color
     FROM scheduled_events
     WHERE user_id = ? ORDER BY start_at`,
    [userId]
  );
  return rows;
}

async function findScheduledEventsInWindow(executor, userId, windowEndSql, windowStartSql) {
  const [rows] = await executor.execute(
    `SELECT id, task_id, title, start_at, end_at
     FROM scheduled_events
     WHERE user_id = ? AND start_at < ? AND end_at > ?`,
    [userId, windowEndSql, windowStartSql]
  );
  return rows;
}

async function findScheduledEventsInWindowForUpdate(connection, userId, windowEndSql, windowStartSql) {
  const [rows] = await connection.execute(
    `SELECT id, start_at, end_at FROM scheduled_events
     WHERE user_id = ? AND start_at < ? AND end_at > ?
     FOR UPDATE`,
    [userId, windowEndSql, windowStartSql]
  );
  return rows;
}

async function findScheduledTaskIds(executor, userId, taskIds) {
  const [rows] = await executor.execute(
    `SELECT DISTINCT task_id FROM scheduled_events
     WHERE user_id = ? AND task_id IN (${taskIds.map(() => '?').join(', ')})`,
    [userId, ...taskIds]
  );
  return rows;
}

async function findScheduledTaskIdsForUpdate(connection, userId, taskIds) {
  const [rows] = await connection.execute(
    `SELECT task_id FROM scheduled_events
     WHERE user_id = ? AND task_id IN (${taskIds.map(() => '?').join(', ')})
     FOR UPDATE`,
    [userId, ...taskIds]
  );
  return rows;
}

async function insertScheduledEvent(connection, { userId, taskId, title, subject, startAtSql, endAtSql }) {
  const [result] = await connection.execute(
    `INSERT INTO scheduled_events (user_id, task_id, title, subject, start_at, end_at, source, color)
     VALUES (?, ?, ?, ?, ?, ?, 'auto', '#8b5cf6')`,
    [userId, taskId, title, subject, startAtSql, endAtSql]
  );
  return result.insertId;
}

async function findStudyPreferencesByUser(executor, userId) {
  const [rows] = await executor.execute(
    `SELECT p.preferred_hours, p.break_minutes, p.timezone
     FROM study_preferences p WHERE p.user_id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function findTasksForAutoSchedule(executor, userId, databaseTaskIds) {
  const [rows] = await executor.execute(
    `SELECT id, title, subject, priority, status, estimated_hours, deadline
     FROM tasks WHERE user_id = ? AND id IN (${databaseTaskIds.map(() => '?').join(', ')})`,
    [userId, ...databaseTaskIds]
  );
  return rows;
}

async function findTasksForApplyForUpdate(connection, userId, databaseTaskIds) {
  const [rows] = await connection.execute(
    `SELECT id, title, subject, status, deadline
     FROM tasks
     WHERE user_id = ? AND id IN (${databaseTaskIds.map(() => '?').join(', ')})
     FOR UPDATE`,
    [userId, ...databaseTaskIds]
  );
  return rows;
}

async function insertScheduleNotification(connection, userId, title, message) {
  await connection.execute(
    `INSERT INTO notifications (user_id, type, title, message)
     VALUES (?, 'success', ?, ?)`,
    [userId, title, message]
  );
}

module.exports = {
  CLASS_FIELDS,
  CLASS_COLUMNS,
  WORK_SCHEDULE_FIELDS,
  WORK_SCHEDULE_COLUMNS,
  lockUser,
  listClassesByUser,
  listClassSlotsByUser,
  findClassForUpdate,
  findClassConflicts,
  insertClass,
  updateClassById,
  deleteClassById,
  listWorkSchedulesByUser,
  listWorkScheduleSlotsByUser,
  listWorkSchedulesForUpdate,
  findWorkScheduleForUpdate,
  insertWorkSchedule,
  updateWorkScheduleById,
  deleteWorkScheduleById,
  listScheduledEventsByUser,
  findScheduledEventsInWindow,
  findScheduledEventsInWindowForUpdate,
  findScheduledTaskIds,
  findScheduledTaskIdsForUpdate,
  insertScheduledEvent,
  findStudyPreferencesByUser,
  findTasksForAutoSchedule,
  findTasksForApplyForUpdate,
  insertScheduleNotification
};
