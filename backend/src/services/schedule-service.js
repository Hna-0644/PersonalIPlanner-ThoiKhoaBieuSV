const { DateTime } = require('luxon');
const { AppError } = require('../utils/app-error');
const { toDatabaseId, toPublicId } = require('../utils/public-id');
const { lockUser } = require('./class-service');

const PRIORITY_WEIGHT = { urgent: 4, high: 3, medium: 2, low: 1 };
const DEFAULT_TASK_MINUTES = 90;

function createScheduleService({ pool }) {
  async function listEvents(userId) {
    const [rows] = await pool.execute(
      `SELECT id, task_id, title, subject, start_at, end_at, source, color
       FROM scheduled_events
       WHERE user_id = ? ORDER BY start_at`,
      [userId]
    );
    return rows.map(row => ({
      id: toPublicId('schedule', row.id),
      taskId: toPublicId('task', row.task_id),
      title: row.title,
      subject: row.subject,
      start: fromDatabaseUtc(row.start_at).toISO(),
      end: fromDatabaseUtc(row.end_at).toISO(),
      source: row.source,
      color: row.color
    }));
  }

  async function generate(userId, input) {
    const [userRows] = await pool.execute(
      `SELECT p.preferred_hours, p.break_minutes, p.timezone
       FROM study_preferences p WHERE p.user_id = ? LIMIT 1`,
      [userId]
    );
    if (!userRows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy cấu hình người dùng.');
    const preferences = mapPreferences(userRows[0]);
    const breakMinutes = input.breakMinutes ?? preferences.breakMinutes;
    const databaseTaskIds = input.taskIds.map(taskId => toDatabaseId(taskId, 'task'));
    const [taskRows] = await pool.execute(
      `SELECT id, title, subject, priority, status, estimated_hours, deadline
       FROM tasks WHERE user_id = ? AND id IN (${databaseTaskIds.map(() => '?').join(', ')})`,
      [userId, ...databaseTaskIds]
    );
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
    const [classRows, eventRows] = await Promise.all([
      pool.execute(
        `SELECT id, title, day_of_week, start_time, end_time, semester_start, semester_end
         FROM classes WHERE user_id = ?`,
        [userId]
      ),
      pool.execute(
        `SELECT id, task_id, title, start_at, end_at
         FROM scheduled_events
         WHERE user_id = ? AND start_at < ? AND end_at > ?`,
        [userId, lastDate.toUTC().toFormat('yyyy-LL-dd HH:mm:ss.SSS'),
          today.toUTC().toFormat('yyyy-LL-dd HH:mm:ss.SSS')]
      )
    ]);

    const classes = classRows[0].map(mapClass);
    const events = eventRows[0].map(row => ({
      id: String(row.id),
      taskId: String(row.task_id),
      title: row.title,
      start: fromDatabaseUtc(row.start_at),
      end: fromDatabaseUtc(row.end_at)
    }));
    const busyByDate = makeBusyCalendar(today, input.days, classes, events, preferences.timezone);
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
    try {
      await connection.beginTransaction();
      await lockUser(connection, userId);
      const [preferenceRows] = await connection.execute(
        `SELECT preferred_hours, break_minutes, timezone
         FROM study_preferences WHERE user_id = ? LIMIT 1`,
        [userId]
      );
      if (!preferenceRows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy cấu hình người dùng.');
      const preferences = mapPreferences(preferenceRows[0]);
      if (timezone !== preferences.timezone) {
        throw new AppError(409, 'CONFLICT', 'Múi giờ đã thay đổi; hãy tạo lại đề xuất lịch.');
      }
      const taskIds = [...new Set(plan.map(item => item.taskId))];
      if (taskIds.length !== plan.length) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Mỗi công việc chỉ được xếp một lần trong một phương án.');
      }
      const databaseTaskIds = taskIds.map(taskId => toDatabaseId(taskId, 'task'));
      const [taskRows] = await connection.execute(
        `SELECT id, title, subject, status, deadline
         FROM tasks
         WHERE user_id = ? AND id IN (${databaseTaskIds.map(() => '?').join(', ')})
         FOR UPDATE`,
        [userId, ...databaseTaskIds]
      );
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
      const [existingRows] = await connection.execute(
        `SELECT task_id FROM scheduled_events
         WHERE user_id = ? AND task_id IN (${databaseTaskIds.map(() => '?').join(', ')})
         FOR UPDATE`,
        [userId, ...databaseTaskIds]
      );
      if (existingRows.length) {
        throw new AppError(409, 'CONFLICT', 'Một hoặc nhiều công việc đã được xếp lịch.');
      }

      const [classRows] = await connection.execute(
        `SELECT id, title, day_of_week, start_time, end_time, semester_start, semester_end
         FROM classes WHERE user_id = ?`,
        [userId]
      );
      const classes = classRows.map(mapClass);
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
      const [busyEventRows] = await connection.execute(
        `SELECT id, start_at, end_at FROM scheduled_events
         WHERE user_id = ? AND start_at < ? AND end_at > ?
         FOR UPDATE`,
        [
          userId,
          latestEnd.toFormat('yyyy-LL-dd HH:mm:ss.SSS'),
          earliestStart.toFormat('yyyy-LL-dd HH:mm:ss.SSS')
        ]
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
        const [result] = await connection.execute(
          `INSERT INTO scheduled_events (user_id, task_id, title, subject, start_at, end_at, source, color)
           VALUES (?, ?, ?, ?, ?, ?, 'auto', '#8b5cf6')`,
          [
            userId,
            databaseTaskId,
            task.title,
            task.subject,
            start.toUTC().toFormat('yyyy-LL-dd HH:mm:ss.SSS'),
            end.toUTC().toFormat('yyyy-LL-dd HH:mm:ss.SSS')
          ]
        );
        inserted.push({
          id: toPublicId('schedule', result.insertId),
          taskId: item.taskId,
          title: task.title,
          subject: task.subject,
          start: start.toISO(),
          end: end.toISO(),
          source: 'auto',
          color: '#8b5cf6'
        });
      }

      await connection.execute(
        `INSERT INTO notifications (user_id, type, title, message)
         VALUES (?, 'success', ?, ?)`,
        [userId, 'Đã áp dụng lịch', `Đã thêm ${inserted.length} phiên vào lịch của bạn.`]
      );
      await connection.commit();
      return { events: inserted };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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

function makeBusyCalendar(today, days, classes, events, timezone) {
  const result = new Map();
  for (let offset = 0; offset < days; offset += 1) {
    const dateTime = today.plus({ days: offset });
    const date = dateTime.toISODate();
    const weekday = dateTime.weekday % 7;
    const busy = classes
      .filter(entry => entry.dayOfWeek === weekday && isClassActiveOnDate(entry, date))
      .map(entry => ({
        start: timeToMinutes(entry.startTime),
        end: timeToMinutes(entry.endTime)
      }));
    result.set(date, busy);
  }
  for (const event of events) {
    const start = DateTime.fromJSDate(event.start).setZone(timezone);
    const end = DateTime.fromJSDate(event.end).setZone(timezone);
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
  if (!a.deadline && !b.deadline) return 0;
  if (!a.deadline) return 1;
  if (!b.deadline) return -1;
  const deadlineOrder = a.deadline.toMillis() - b.deadline.toMillis();
  if (deadlineOrder) return deadlineOrder;
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

function fromDatabaseUtc(value) {
  if (value instanceof Date) return DateTime.fromJSDate(value, { zone: 'utc' });
  return DateTime.fromSQL(String(value), { zone: 'utc' });
}

async function getScheduledTaskIds(pool, userId, taskIds) {
  const [rows] = await pool.execute(
    `SELECT DISTINCT task_id FROM scheduled_events
     WHERE user_id = ? AND task_id IN (${taskIds.map(() => '?').join(', ')})`,
    [userId, ...taskIds]
  );
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
  timeToMinutes
};
