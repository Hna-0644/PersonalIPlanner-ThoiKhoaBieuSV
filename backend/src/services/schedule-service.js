const { DateTime } = require('luxon');
const { AppError } = require('../utils/app-error');
const { toDatabaseId, toPublicId } = require('../utils/public-id');
const { fromDatabaseUtc, toSqlUtcString } = require('../utils/timezone');
const {
  lockUser,
  listClassSlotsByUser,
  listWorkScheduleSlotsByUser,
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
} = require('../repositories/timetable-repository');

const PRIORITY_WEIGHT = { urgent: 4, high: 3, medium: 2, low: 1 };
const DEFAULT_TASK_MINUTES = 90;
const SCHEDULE_EVENTS_CACHE_TTL_SECONDS = 3600;

function createScheduleService({ pool, redisClient }) {
  async function listEvents(userId) {
    const cacheKeyPrefix = `schedule:events:${userId}`;
    const versionKey = `schedule:events:version:${userId}`;
    let cacheKey;
    if (redisClient && redisClient.isReady !== false) {
      try {
        const version = await redisClient.get(versionKey) || '0';
        cacheKey = `${cacheKeyPrefix}:${version}`;
        const cachedValue = await redisClient.get(cacheKey);
        if (cachedValue !== null) {
          try {
            const cachedEvents = JSON.parse(cachedValue);
            if (Array.isArray(cachedEvents)) return cachedEvents;
            throw new Error('Cached schedule events must be an array.');
          } catch (error) {
            console.error('Failed to parse schedule events cache:', error);
          }
        }
      } catch (error) {
        console.error('Failed to read schedule events cache:', error);
      }
    }

    const rows = await listScheduledEventsByUser(pool, userId);
    const events = rows.map(row => ({
      id: toPublicId('schedule', row.id),
      taskId: toPublicId('task', row.task_id),
      title: row.title,
      subject: row.subject,
      start: fromDatabaseUtc(row.start_at).toISO(),
      end: fromDatabaseUtc(row.end_at).toISO(),
      source: row.source,
      color: row.color
    }));
    if (redisClient && cacheKey) {
      try {
        await redisClient.setEx(
          cacheKey,
          SCHEDULE_EVENTS_CACHE_TTL_SECONDS,
          JSON.stringify(events)
        );
      } catch (error) {
        console.error('Failed to write schedule events cache:', error);
      }
    }
    return events;
  }

  async function generate(userId, input) {
    const userPrefRow = await findStudyPreferencesByUser(pool, userId);
    if (!userPrefRow) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy cấu hình người dùng.');
    const preferences = mapPreferences(userPrefRow);
    const breakMinutes = input.breakMinutes ?? preferences.breakMinutes;
    const databaseTaskIds = input.taskIds.map(taskId => toDatabaseId(taskId, 'task'));
    const taskRows = await findTasksForAutoSchedule(pool, userId, databaseTaskIds);
    if (taskRows.length !== new Set(databaseTaskIds).size) {
      throw new AppError(404, 'NOT_FOUND', 'Một hoặc nhiều công việc không tồn tại.');
    }

    const tasks = taskRows.map(mapTask);
    if (tasks.some(task => task.status === 'done')) {
      throw new AppError(409, 'CONFLICT', 'Không thể xếp lịch cho công việc đã hoàn thành.');
    }
    const scheduledTaskIds = await getScheduledTaskIds(pool, userId, databaseTaskIds);
    if (scheduledTaskIds.size) {
      throw new AppError(409, 'CONFLICT', 'Một hoặc nhiều công việc đã có lịch.', [
        ...scheduledTaskIds].map(taskId => ({ taskId }))
      );
    }

    const today = DateTime.now().setZone(preferences.timezone).startOf('day');
    const lastDate = today.plus({ days: input.days });
    const [classRows, eventRows, workRows] = await Promise.all([
      listClassSlotsByUser(pool, userId),
      findScheduledEventsInWindow(
        pool,
        userId,
        toSqlUtcString(lastDate),
        toSqlUtcString(today)
      ),
      listWorkScheduleSlotsByUser(pool, userId)
    ]);

    const classes = classRows.map(mapClass);
    const workSchedules = (workRows || []).map(mapWorkSchedule);
    const events = eventRows.map(row => ({
      id: String(row.id),
      taskId: String(row.task_id),
      title: row.title,
      start: fromDatabaseUtc(row.start_at),
      end: fromDatabaseUtc(row.end_at)
    }));
    const busyByDate = makeBusyCalendar(today, input.days, classes, events, workSchedules, preferences.timezone);
    const studyWindows = getStudyWindows(preferences.preferredHours);
    const sortedTasks = [...tasks].sort(compareTasks);
    const plan = [];
    const unscheduled = [];
    const now = DateTime.now().setZone(preferences.timezone);

    for (const task of sortedTasks) {
      const durationMinutes = Math.max(
        1,
        Math.round((task.estimatedHours || DEFAULT_TASK_MINUTES / 60) * 60)
      );
      let proposal = null;
      let hasWindowForDuration = false;
      let hadCandidateBeforeDeadline = false;

      for (let dayOffset = 0; dayOffset < input.days && !proposal; dayOffset += 1) {
        const date = today.plus({ days: dayOffset }).toISODate();
        const busy = busyByDate.get(date) || [];
        for (const window of studyWindows) {
          if (durationMinutes > window.end - window.start) continue;
          hasWindowForDuration = true;
          let start = window.start;
          if (dayOffset === 0) {
            start = Math.max(start, now.hour * 60 + now.minute + 15);
          }
          while (start + durationMinutes <= window.end) {
            const end = start + durationMinutes;
            const startAt = localDateTime(date, start, preferences.timezone);
            const endAt = localDateTime(date, end, preferences.timezone);
            if (task.deadline && endAt.toMillis() > task.deadline.toMillis()) {
              start += 30;
              continue;
            }
            hadCandidateBeforeDeadline = true;
            const conflict = busy.some(item =>
              start < item.end + breakMinutes && end > item.start - breakMinutes
            );
            if (!conflict) {
              proposal = {
                taskId: task.id,
                taskTitle: task.title,
                subject: task.subject,
                priority: task.priority,
                date,
                startTime: minutesToTime(start),
                endTime: minutesToTime(end),
                durationMinutes,
                estimatedHours: task.estimatedHours,
                deadline: task.deadline?.toISO() || null
              };
              busy.push({ start, end });
              busyByDate.set(date, busy);
              break;
            }
            start += 30;
          }
          if (proposal) break;
        }
      }

      if (proposal) {
        plan.push(proposal);
      } else {
        let reason = 'NO_AVAILABLE_SLOT';
        if (task.deadline && task.deadline.toMillis() <= now.toMillis()) {
          reason = 'DEADLINE_PASSED';
        } else if (studyWindows.length === 0) {
          reason = 'NO_ACTIVE_STUDY_WINDOW';
        } else if (!hasWindowForDuration) {
          reason = 'DURATION_EXCEEDS_WINDOW';
        } else if (!hadCandidateBeforeDeadline) {
          reason = task.deadline ? 'DEADLINE_INFEASIBLE' : 'NO_AVAILABLE_SLOT';
        }
        unscheduled.push({
          taskId: task.id,
          reason,
          message: reasonMessage(reason)
        });
      }
    }

    return {
      plan,
      unscheduled,
      breakMinutes,
      timezone: preferences.timezone
    };
  }

  async function apply(userId, plan, breakMinutes, timezone) {
    const connection = await pool.getConnection();
    let result;
    try {
      await connection.beginTransaction();
      await lockUser(connection, userId);
      const preferenceRow = await findStudyPreferencesByUser(connection, userId);
      if (!preferenceRow) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy cấu hình người dùng.');
      const preferences = mapPreferences(preferenceRow);
      if (timezone !== preferences.timezone) {
        throw new AppError(409, 'CONFLICT', 'Múi giờ đã thay đổi; hãy tạo lại đề xuất lịch.');
      }
      const taskIds = [...new Set(plan.map(item => item.taskId))];
      if (taskIds.length !== plan.length) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Mỗi công việc chỉ được xếp một lần trong một phương án.');
      }
      const databaseTaskIds = taskIds.map(taskId => toDatabaseId(taskId, 'task'));
      const taskRows = await findTasksForApplyForUpdate(connection, userId, databaseTaskIds);
      if (taskRows.length !== databaseTaskIds.length) {
        throw new AppError(404, 'NOT_FOUND', 'Một hoặc nhiều công việc không tồn tại.');
      }
      const tasks = new Map(taskRows.map(row => [String(row.id), {
        id: toPublicId('task', row.id),
        title: row.title,
        subject: row.subject,
        status: row.status,
        deadline: row.deadline ? fromDatabaseUtc(row.deadline) : null
      }]));
      if ([...tasks.values()].some(task => task.status === 'done')) {
        throw new AppError(409, 'CONFLICT', 'Không thể áp dụng lịch cho công việc đã hoàn thành.');
      }
      const existingRows = await findScheduledTaskIdsForUpdate(connection, userId, databaseTaskIds);
      if (existingRows.length) {
        throw new AppError(409, 'CONFLICT', 'Một hoặc nhiều công việc đã được xếp lịch.');
      }

      const classRows = await listClassSlotsByUser(connection, userId);
      const workRows = await listWorkScheduleSlotsByUser(connection, userId);
      const classes = classRows.map(mapClass);
      const workSchedules = workRows.map(mapWorkSchedule);
      const utcStarts = plan.map(item => localDateTime(
        item.date,
        timeToMinutes(item.startTime),
        preferences.timezone
      ).toUTC());
      const utcEnds = plan.map(item => localDateTime(
        item.date,
        timeToMinutes(item.endTime),
        preferences.timezone
      ).toUTC());
      const earliestStart = DateTime.min(...utcStarts).minus({ minutes: breakMinutes });
      const latestEnd = DateTime.max(...utcEnds).plus({ minutes: breakMinutes });
      const busyEventRows = await findScheduledEventsInWindowForUpdate(
        connection,
        userId,
        toSqlUtcString(latestEnd),
        toSqlUtcString(earliestStart)
      );
      const existingEvents = busyEventRows.map(row => ({
        start: fromDatabaseUtc(row.start_at),
        end: fromDatabaseUtc(row.end_at)
      }));
      const currentTime = DateTime.now().setZone(preferences.timezone);
      const proposedSlots = new Map();
      const inserted = [];
      for (const item of plan) {
        const databaseTaskId = toDatabaseId(item.taskId, 'task');
        const task = tasks.get(databaseTaskId);
        if (!task) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy công việc.');
        const start = localDateTime(item.date, timeToMinutes(item.startTime), preferences.timezone);
        const end = localDateTime(item.date, timeToMinutes(item.endTime), preferences.timezone);
        if (!start.isValid || !end.isValid || end <= start ||
          end.diff(start, 'minutes').minutes !== item.durationMinutes) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Thời lượng phương án không khớp giờ bắt đầu/kết thúc.');
        }
        if (start.toMillis() <= currentTime.toMillis()) {
          throw new AppError(409, 'CONFLICT', 'Không thể áp dụng một lịch trong quá khứ.');
        }
        if (!studySlotContains(preferences.preferredHours, item.startTime, item.endTime)) {
          throw new AppError(409, 'CONFLICT', 'Phương án nằm ngoài khung giờ học đã cấu hình.');
        }
        if (task.deadline && end.toMillis() > task.deadline.toMillis()) {
          throw new AppError(409, 'CONFLICT', 'Phương án vượt quá deadline của công việc.');
        }
        if (existingEvents.some(event =>
          start.toMillis() < event.end.toMillis() + breakMinutes * 60_000 &&
          end.toMillis() > event.start.toMillis() - breakMinutes * 60_000
        )) {
          throw new AppError(409, 'CONFLICT', 'Phương án bị trùng với công việc đã có trên lịch.');
        }
        const weekday = DateTime.fromISO(item.date, { zone: preferences.timezone }).weekday % 7;
        const classConflict = classes.some(entry =>
          entry.dayOfWeek === weekday &&
          isClassActiveOnDate(entry, item.date) &&
          timeToMinutes(item.startTime) < timeToMinutes(entry.endTime) + breakMinutes &&
          timeToMinutes(item.endTime) > timeToMinutes(entry.startTime) - breakMinutes
        );
        if (classConflict) {
          throw new AppError(409, 'CONFLICT', 'Phương án bị trùng với thời khóa biểu.');
        }
        const workConflict = workSchedules.some(shift =>
          isShiftActiveOnDate(shift, item.date, weekday) &&
          timeToMinutes(item.startTime) < timeToMinutes(shift.endTime) + breakMinutes &&
          timeToMinutes(item.endTime) > timeToMinutes(shift.startTime) - breakMinutes
        );
        if (workConflict) {
          throw new AppError(409, 'CONFLICT', 'Phương án bị trùng với lịch làm việc.');
        }
        const sameDaySlots = proposedSlots.get(item.date) || [];
        if (sameDaySlots.some(slot =>
          timeToMinutes(item.startTime) < slot.end + breakMinutes &&
          timeToMinutes(item.endTime) > slot.start - breakMinutes
        )) {
          throw new AppError(409, 'CONFLICT', 'Các công việc trong phương án bị trùng giờ.');
        }
        proposedSlots.set(item.date, [
          ...sameDaySlots,
          { start: timeToMinutes(item.startTime), end: timeToMinutes(item.endTime) }
        ]);
        const insertId = await insertScheduledEvent(connection, {
          userId,
          taskId: databaseTaskId,
          title: task.title,
          subject: task.subject,
          startAtSql: toSqlUtcString(start),
          endAtSql: toSqlUtcString(end)
        });
        inserted.push({
          id: toPublicId('schedule', insertId),
          taskId: item.taskId,
          title: task.title,
          subject: task.subject,
          start: start.toISO(),
          end: end.toISO(),
          source: 'auto',
          color: '#8b5cf6'
        });
      }

      await insertScheduleNotification(
        connection,
        userId,
        'Đã áp dụng lịch',
        `Đã thêm ${inserted.length} phiên vào lịch của bạn.`
      );
      await connection.commit();
      result = { events: inserted };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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
    return result;
  }

  return { listEvents, generate, apply };
}

function mapPreferences(row) {
  const windows = typeof row.preferred_hours === 'string'
    ? JSON.parse(row.preferred_hours)
    : row.preferred_hours;
  return {
    preferredHours: windows,
    breakMinutes: Number(row.break_minutes),
    timezone: row.timezone
  };
}

function mapTask(row) {
  return {
    id: toPublicId('task', row.id),
    title: row.title,
    subject: row.subject,
    priority: row.priority,
    status: row.status,
    estimatedHours: row.estimated_hours === null ? null : Number(row.estimated_hours),
    deadline: row.deadline ? fromDatabaseUtc(row.deadline) : null
  };
}

function mapClass(row) {
  return {
    title: row.title,
    dayOfWeek: Number(row.day_of_week),
    startTime: normalizeTime(row.start_time),
    endTime: normalizeTime(row.end_time),
    semesterStart: row.semester_start || null,
    semesterEnd: row.semester_end || null
  };
}

function mapWorkSchedule(row) {
  return {
    title: row.title,
    workplace: row.workplace || null,
    dayOfWeek: row.day_of_week === null || row.day_of_week === undefined ? null : Number(row.day_of_week),
    workDate: formatDateOnly(row.work_date),
    startTime: normalizeTime(row.start_time),
    endTime: normalizeTime(row.end_time),
    startDate: formatDateOnly(row.start_date),
    endDate: formatDateOnly(row.end_date),
    color: row.color,
    notes: row.notes
  };
}

function formatDateOnly(val) {
  if (!val) return null;
  if (typeof val === 'string') return val.slice(0, 10);
  if (val instanceof Date) return DateTime.fromJSDate(val).toISODate();
  return String(val).slice(0, 10);
}

function isShiftActiveOnDate(shift, date, weekday) {
  const workDate = formatDateOnly(shift.workDate);
  if (workDate && workDate === date) {
    return true;
  }
  if (shift.dayOfWeek !== null && shift.dayOfWeek !== undefined) {
    if (Number(shift.dayOfWeek) === weekday) {
      const startDate = formatDateOnly(shift.startDate);
      const endDate = formatDateOnly(shift.endDate);
      if ((!startDate || startDate <= date) && (!endDate || endDate >= date)) {
        return true;
      }
    }
  }
  return false;
}

function makeBusyCalendar(today, days, classes, events, workSchedules = [], timezone = 'Asia/Ho_Chi_Minh') {
  if (typeof workSchedules === 'string') {
    timezone = workSchedules;
    workSchedules = [];
  }
  const result = new Map();
  for (let offset = 0; offset < days; offset += 1) {
    const dateTime = today.plus({ days: offset });
    const date = dateTime.toISODate();
    const weekday = dateTime.weekday % 7;
    const classBusy = classes
      .filter(entry => entry.dayOfWeek === weekday && isClassActiveOnDate(entry, date))
      .map(entry => ({
        start: timeToMinutes(entry.startTime),
        end: timeToMinutes(entry.endTime)
      }));
    const workBusy = (workSchedules || [])
      .filter(shift => isShiftActiveOnDate(shift, date, weekday))
      .map(shift => ({
        start: timeToMinutes(shift.startTime),
        end: timeToMinutes(shift.endTime)
      }));
    result.set(date, [...classBusy, ...workBusy]);
  }
  const toDateTime = (val) => {
    if (val?.isLuxonDateTime) return val;
    const parsed = fromDatabaseUtc(val);
    if (parsed && parsed.isValid) return parsed;
    return DateTime.fromISO(String(val));
  };
  for (const event of events) {
    const start = toDateTime(event.start).setZone(timezone);
    const end = toDateTime(event.end).setZone(timezone);
    let day = start.startOf('day');
    while (day < end) {
      const date = day.toISODate();
      const startMinute = day.hasSame(start, 'day') ? start.hour * 60 + start.minute : 0;
      const endMinute = day.hasSame(end, 'day') ? end.hour * 60 + end.minute : 24 * 60;
      const busy = result.get(date) || [];
      busy.push({ start: startMinute, end: endMinute });
      result.set(date, busy);
      day = day.plus({ days: 1 });
    }
  }
  return result;
}

function getStudyWindows(preferredHours) {
  return ['morning', 'afternoon', 'evening']
    .map(key => preferredHours[key])
    .filter(window => window && window.active)
    .map(window => ({
      start: timeToMinutes(window.start),
      end: timeToMinutes(window.end)
    }))
    .sort((a, b) => a.start - b.start);
}

function compareTasks(a, b) {
  const priority = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
  if (priority) return priority;
  if (!a.deadline && b.deadline) return 1;
  if (a.deadline && !b.deadline) return -1;
  if (a.deadline && b.deadline) {
    const deadlineOrder = a.deadline.toMillis() - b.deadline.toMillis();
    if (deadlineOrder) return deadlineOrder;
  }
  return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
}

function localDateTime(date, minutes, timezone) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return DateTime.fromISO(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, {
    zone: timezone
  });
}

function isClassActiveOnDate(entry, date) {
  return (!entry.semesterStart || entry.semesterStart <= date) &&
    (!entry.semesterEnd || entry.semesterEnd >= date);
}

function studySlotContains(preferredHours, startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return Object.values(preferredHours).some(window =>
    window.active && start >= timeToMinutes(window.start) && end <= timeToMinutes(window.end)
  );
}

function timeToMinutes(value) {
  const [hours, minutes] = normalizeTime(value).split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function normalizeTime(value) {
  return String(value).slice(0, 5);
}

async function getScheduledTaskIds(pool, userId, taskIds) {
  const rows = await findScheduledTaskIds(pool, userId, taskIds);
  return new Set(rows.map(row => toPublicId('task', row.task_id)));
}

function reasonMessage(reason) {
  const messages = {
    NO_AVAILABLE_SLOT: 'Không còn khoảng thời gian trống phù hợp.',
    DEADLINE_PASSED: 'Deadline của công việc đã qua.',
    DEADLINE_INFEASIBLE: 'Không còn đủ khung giờ để hoàn thành trước deadline.',
    DURATION_EXCEEDS_WINDOW: 'Thời lượng công việc dài hơn mọi khung giờ học.',
    NO_ACTIVE_STUDY_WINDOW: 'Bạn chưa bật khung giờ học phù hợp.'
  };
  return messages[reason];
}

module.exports = {
  createScheduleService,
  compareTasks,
  makeBusyCalendar,
  timeToMinutes,
  isShiftActiveOnDate,
  mapWorkSchedule
};
