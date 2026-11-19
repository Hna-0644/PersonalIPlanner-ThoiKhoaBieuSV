const { DateTime } = require('luxon');
const { AppError } = require('../utils/app-error');
const { toPublicId, toDatabaseId } = require('../utils/public-id');
const { toIsoUtcString, nowUtc } = require('../utils/timezone');
const {
  lockUser,
  listWorkSchedulesByUser,
  listWorkSchedulesForUpdate,
  findWorkScheduleForUpdate,
  insertWorkSchedule,
  updateWorkScheduleById,
  deleteWorkScheduleById
} = require('../repositories/timetable-repository');

function createWorkScheduleService({ pool, redisClient }) {
  async function list(userId) {
    const rows = await listWorkSchedulesByUser(pool, userId);
    return rows.map(mapWorkSchedule);
  }

  async function create(userId, input) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await lockUser(connection, userId);

      const existingShifts = await listWorkSchedulesForUpdate(connection, userId);
      ensureNoShiftConflict(existingShifts, input);

      const normalizedInput = {
        ...input,
        color: input.color || '#0d7480'
      };

      const insertId = await insertWorkSchedule(connection, userId, normalizedInput);

      await connection.commit();
      await invalidateScheduleCache(redisClient, userId);

      const nowIso = nowUtc().toISO();
      return {
        id: toPublicId('work', insertId),
        title: normalizedInput.title,
        workplace: normalizedInput.workplace ?? null,
        dayOfWeek: normalizedInput.dayOfWeek !== undefined && normalizedInput.dayOfWeek !== null
          ? Number(normalizedInput.dayOfWeek)
          : null,
        workDate: formatDateOnly(normalizedInput.workDate),
        startTime: normalizeTime(normalizedInput.startTime),
        endTime: normalizeTime(normalizedInput.endTime),
        startDate: formatDateOnly(normalizedInput.startDate),
        endDate: formatDateOnly(normalizedInput.endDate),
        color: normalizedInput.color,
        notes: normalizedInput.notes ?? null,
        createdAt: nowIso,
        updatedAt: nowIso
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function update(userId, scheduleId, input) {
    const dbId = resolveScheduleDbId(scheduleId);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await lockUser(connection, userId);

      const existingRow = await findWorkScheduleForUpdate(connection, dbId, userId);
      if (!existingRow) {
        throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy ca làm việc.');
      }

      const current = mapWorkSchedule(existingRow);
      const merged = { ...current, ...input };

      if (merged.startTime >= merged.endTime) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Giờ kết thúc phải sau giờ bắt đầu.');
      }
      if (merged.dayOfWeek === null && merged.workDate === null) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Cần có thứ trong tuần (lịch lặp) hoặc ngày làm việc cụ thể.');
      }
      if (merged.startDate && merged.endDate && merged.startDate > merged.endDate) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Ngày kết thúc không được trước ngày bắt đầu.');
      }

      const existingShifts = await listWorkSchedulesForUpdate(connection, userId);
      ensureNoShiftConflict(existingShifts, merged, dbId);

      await updateWorkScheduleById(connection, userId, dbId, input);

      await connection.commit();
      await invalidateScheduleCache(redisClient, userId);

      return {
        ...merged,
        id: toPublicId('work', dbId),
        updatedAt: nowUtc().toISO()
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function remove(userId, scheduleId) {
    const dbId = resolveScheduleDbId(scheduleId);
    const affectedRows = await deleteWorkScheduleById(pool, userId, dbId);

    if (!affectedRows) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy ca làm việc.');
    }

    await invalidateScheduleCache(redisClient, userId);
    return { id: toPublicId('work', dbId), success: true, deleted: true };
  }

  return { list, create, update, remove };
}

function resolveScheduleDbId(scheduleId) {
  if (typeof scheduleId === 'string' && scheduleId.startsWith('wrk_')) {
    return toDatabaseId(scheduleId, 'work');
  }
  if (typeof scheduleId === 'number' || (typeof scheduleId === 'string' && /^[1-9]\d*$/.test(scheduleId))) {
    return String(scheduleId);
  }
  return toDatabaseId(scheduleId, 'work');
}

function ensureNoShiftConflict(existingShifts, candidateShift, excludeId = null) {
  const conflicts = [];
  for (const existing of existingShifts) {
    if (excludeId && String(existing.id) === String(excludeId)) continue;
    const existingObj = {
      workDate: existing.work_date,
      dayOfWeek: existing.day_of_week,
      startDate: existing.start_date,
      endDate: existing.end_date,
      startTime: existing.start_time,
      endTime: existing.end_time
    };
    if (shiftsOverlap(candidateShift, existingObj)) {
      conflicts.push(existing);
    }
  }
  if (conflicts.length > 0) {
    throw new AppError(409, 'CONFLICT', 'Ca làm việc bị trùng giờ.', conflicts.map(row => ({
      id: toPublicId('work', row.id),
      title: row.title,
      startTime: normalizeTime(row.start_time),
      endTime: normalizeTime(row.end_time)
    })));
  }
}

function shiftsOverlap(shiftA, shiftB) {
  let sameDayPossible = false;

  const dateA = formatDateOnly(shiftA.workDate);
  const dateB = formatDateOnly(shiftB.workDate);
  const dayA = shiftA.dayOfWeek !== null && shiftA.dayOfWeek !== undefined ? Number(shiftA.dayOfWeek) : null;
  const dayB = shiftB.dayOfWeek !== null && shiftB.dayOfWeek !== undefined ? Number(shiftB.dayOfWeek) : null;

  if (dateA && dateB) {
    sameDayPossible = dateA === dateB;
  } else if (dayA !== null && dayB !== null) {
    if (dayA === dayB) {
      const startA = formatDateOnly(shiftA.startDate);
      const endA = formatDateOnly(shiftA.endDate);
      const startB = formatDateOnly(shiftB.startDate);
      const endB = formatDateOnly(shiftB.endDate);
      const dateOverlap = (!startA || !endB || startA <= endB) && (!endA || !startB || endA >= startB);
      sameDayPossible = dateOverlap;
    }
  } else if (dateA && dayB !== null) {
    const dt = DateTime.fromISO(dateA, { zone: 'utc' });
    if (dt.isValid && (dt.weekday % 7) === dayB) {
      const startB = formatDateOnly(shiftB.startDate);
      const endB = formatDateOnly(shiftB.endDate);
      sameDayPossible = (!startB || startB <= dateA) && (!endB || endB >= dateA);
    }
  } else if (dateB && dayA !== null) {
    const dt = DateTime.fromISO(dateB, { zone: 'utc' });
    if (dt.isValid && (dt.weekday % 7) === dayA) {
      const startA = formatDateOnly(shiftA.startDate);
      const endA = formatDateOnly(shiftA.endDate);
      sameDayPossible = (!startA || startA <= dateB) && (!endA || endA >= dateB);
    }
  }

  if (!sameDayPossible) return false;

  const startAMin = timeToMinutes(shiftA.startTime);
  const endAMin = timeToMinutes(shiftA.endTime);
  const startBMin = timeToMinutes(shiftB.startTime);
  const endBMin = timeToMinutes(shiftB.endTime);

  return startAMin < endBMin && endAMin > startBMin;
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

function timeToMinutes(value) {
  const [hours, minutes] = normalizeTime(value).split(':').map(Number);
  return hours * 60 + minutes;
}

function normalizeTime(value) {
  return String(value).slice(0, 5);
}

function formatDateOnly(val) {
  if (!val) return null;
  if (typeof val === 'string') return val.slice(0, 10);
  if (val instanceof Date) return DateTime.fromJSDate(val).toISODate();
  return String(val).slice(0, 10);
}

function formatIso(val) {
  if (!val) return null;
  const iso = toIsoUtcString(val);
  return iso || String(val);
}

function mapWorkSchedule(row) {
  return {
    id: toPublicId('work', row.id),
    title: row.title,
    workplace: row.workplace || null,
    dayOfWeek: row.day_of_week === null || row.day_of_week === undefined ? null : Number(row.day_of_week),
    workDate: formatDateOnly(row.work_date),
    startTime: normalizeTime(row.start_time),
    endTime: normalizeTime(row.end_time),
    startDate: formatDateOnly(row.start_date),
    endDate: formatDateOnly(row.end_date),
    color: row.color || '#0d7480',
    notes: row.notes || null,
    createdAt: formatIso(row.created_at),
    updatedAt: formatIso(row.updated_at)
  };
}

module.exports = {
  createWorkScheduleService,
  shiftsOverlap,
  mapWorkSchedule,
  lockUser
};
