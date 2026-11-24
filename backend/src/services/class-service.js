const { AppError } = require('../utils/app-error');
const { toPublicId } = require('../utils/public-id');
const {
  CLASS_FIELDS,
  lockUser,
  listClassesByUser,
  findClassForUpdate,
  findClassConflicts,
  insertClass,
  updateClassById,
  deleteClassById
} = require('../repositories/timetable-repository');

function createClassService({ pool, redisClient }) {
  async function list(userId) {
    const rows = await listClassesByUser(pool, userId);
    return rows.map(mapClass);
  }

  async function create(userId, input) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await lockUser(connection, userId);
      await ensureNoConflict(connection, userId, input);
      const insertId = await insertClass(connection, userId, input);
      await connection.commit();
      await invalidateScheduleCache(redisClient, userId);
      return {
        id: toPublicId('class', insertId),
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
      const existingRow = await findClassForUpdate(connection, classId, userId);
      if (!existingRow) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thời khóa biểu.');
      const merged = { ...mapClass(existingRow), ...input };
      if (merged.startTime >= merged.endTime) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Giờ kết thúc phải sau giờ bắt đầu.');
      }
      if (merged.semesterStart && merged.semesterEnd && merged.semesterStart > merged.semesterEnd) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Ngày kết thúc học kỳ không được trước ngày bắt đầu.');
      }
      await ensureNoConflict(connection, userId, merged, classId);
      await updateClassById(connection, userId, classId, input);
      await connection.commit();
      await invalidateScheduleCache(redisClient, userId);
      return { ...merged, id: toPublicId('class', classId) };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function remove(userId, classId) {
    const affectedRows = await deleteClassById(pool, userId, classId);
    if (!affectedRows) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thời khóa biểu.');
    await invalidateScheduleCache(redisClient, userId);
    return { id: toPublicId('class', classId), deleted: true };
  }

  return { list, create, update, remove };
}

async function invalidateScheduleCache(redisClient, userId) {
  if (redisClient && redisClient.isReady === false) {
    console.error('Failed to invalidate schedule events cache: Redis client is not ready.');
  } else if (redisClient) {
    try {
      const nextVersion = await redisClient.incr(`schedule:events:version:${userId}`);
      await redisClient.del(`schedule:events:${userId}:${nextVersion - 1}`);
    } catch (error) {
      console.error('Failed to invalidate schedule events cache:', error);
    }
  }
}

async function ensureNoConflict(connection, userId, entry, excludeId = null) {
  const rows = await findClassConflicts(connection, userId, entry, excludeId);
  if (rows.length) {
    throw new AppError(409, 'CONFLICT', 'Thời khóa biểu bị trùng giờ.', rows.map(row => ({
      id: toPublicId('class', row.id),
      title: row.title,
      startTime: normalizeTime(row.start_time),
      endTime: normalizeTime(row.end_time)
    })));
  }
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
