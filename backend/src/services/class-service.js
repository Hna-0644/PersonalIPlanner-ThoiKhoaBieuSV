const { AppError } = require('../utils/app-error');
const { toPublicId } = require('../utils/public-id');

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

function createClassService({ pool }) {
  async function list(userId) {
    const [rows] = await pool.execute(
      `SELECT id, title, code, room, lecturer, day_of_week, start_time, end_time,
              semester_start, semester_end, color, notes
       FROM classes WHERE user_id = ? ORDER BY day_of_week, start_time`,
      [userId]
    );
    return rows.map(mapClass);
  }

  async function create(userId, input) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await lockUser(connection, userId);
      await ensureNoConflict(connection, userId, input);
      const columns = CLASS_FIELDS.map(field => CLASS_COLUMNS[field]);
      const values = CLASS_FIELDS.map(field => input[field] ?? null);
      const [result] = await connection.execute(
        `INSERT INTO classes (user_id, ${columns.join(', ')})
         VALUES (?, ${columns.map(() => '?').join(', ')})`,
        [userId, ...values]
      );
      await connection.commit();
      return {
        id: toPublicId('class', result.insertId),
        ...Object.fromEntries(CLASS_FIELDS.map(field => [field, input[field] ?? null]))
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function update(userId, classId, input) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await lockUser(connection, userId);
      const [rows] = await connection.execute(
        `SELECT id, title, code, room, lecturer, day_of_week, start_time, end_time,
                semester_start, semester_end, color, notes
         FROM classes WHERE id = ? AND user_id = ? FOR UPDATE`,
        [classId, userId]
      );
      if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thời khóa biểu.');
      const merged = { ...mapClass(rows[0]), ...input };
      if (merged.startTime >= merged.endTime) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Giờ kết thúc phải sau giờ bắt đầu.');
      }
      if (merged.semesterStart && merged.semesterEnd && merged.semesterStart > merged.semesterEnd) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Ngày kết thúc học kỳ không được trước ngày bắt đầu.');
      }
      await ensureNoConflict(connection, userId, merged, classId);
      const entries = Object.entries(input);
      const assignments = entries.map(([field]) => `${CLASS_COLUMNS[field]} = ?`).join(', ');
      await connection.execute(
        `UPDATE classes SET ${assignments} WHERE id = ? AND user_id = ?`,
        [...entries.map(([, value]) => value ?? null), classId, userId]
      );
      await connection.commit();
      return { ...merged, id: toPublicId('class', classId) };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function remove(userId, classId) {
    const [result] = await pool.execute(
      'DELETE FROM classes WHERE id = ? AND user_id = ?',
      [classId, userId]
    );
    if (!result.affectedRows) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thời khóa biểu.');
    return { id: toPublicId('class', classId), deleted: true };
  }

  return { list, create, update, remove };
}

async function ensureNoConflict(connection, userId, entry, excludeId = null) {
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
  if (rows.length) {
    throw new AppError(409, 'CONFLICT', 'Thời khóa biểu bị trùng giờ.', rows.map(row => ({
      id: toPublicId('class', row.id),
      title: row.title,
      startTime: normalizeTime(row.start_time),
      endTime: normalizeTime(row.end_time)
    })));
  }
}

async function lockUser(connection, userId) {
  const [rows] = await connection.execute(
    'SELECT id FROM users WHERE id = ? FOR UPDATE',
    [userId]
  );
  if (!rows.length) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng.');
}

function normalizeTime(value) {
  return String(value).slice(0, 5);
}

function mapClass(row) {
  return {
    id: toPublicId('class', row.id),
    title: row.title,
    code: row.code,
    room: row.room,
    lecturer: row.lecturer,
    dayOfWeek: Number(row.day_of_week),
    startTime: normalizeTime(row.start_time),
    endTime: normalizeTime(row.end_time),
    semesterStart: row.semester_start || null,
    semesterEnd: row.semester_end || null,
    color: row.color,
    notes: row.notes
  };
}

module.exports = { createClassService, lockUser };
