/* PersonalPlanner - Mock scheduling service */
(function () {
  const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
  const reasonMessages = {
    NO_AVAILABLE_SLOT: 'Không còn khoảng trống phù hợp trong thời gian đã chọn.',
    DEADLINE_PASSED: 'Deadline của công việc đã qua.',
    DEADLINE_INFEASIBLE: 'Không đủ thời gian để xếp công việc trước deadline.',
    DURATION_EXCEEDS_WINDOW: 'Thời lượng công việc dài hơn mọi khung giờ học đang bật.',
    NO_ACTIVE_STUDY_WINDOW: 'Bạn chưa bật khung giờ học nào trong hồ sơ.'
  };

  function getTimezone(user) {
    return user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh';
  }

  function localDateParts(date) {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate()
    };
  }

  function formatDate(parts) {
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  }

  function addDays(parts, count) {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + count));
    return localDateParts(date);
  }

  function zonedParts(epoch, timezone) {
    const values = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date(epoch));
    return Object.fromEntries(values
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]));
  }

  function localTimeToEpoch(date, time, timezone) {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const target = Date.UTC(year, month - 1, day, hour, minute);
    let epoch = target;
    for (let attempt = 0; attempt < 4; attempt++) {
      const actual = zonedParts(epoch, timezone);
      const represented = Date.UTC(
        actual.year, actual.month - 1, actual.day,
        actual.hour, actual.minute, actual.second
      );
      epoch += target - represented;
    }
    const result = zonedParts(epoch, timezone);
    if (result.year !== year || result.month !== month || result.day !== day ||
      result.hour !== hour || result.minute !== minute) {
      return NaN;
    }
    return epoch;
  }

  function parseDateTime(value, timezone) {
    if (!value) return null;
    const input = String(value);
    if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(input)) {
      const epoch = Date.parse(input);
      return Number.isFinite(epoch) ? epoch : null;
    }
    const match = input.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    if (!match) return null;
    const epoch = localTimeToEpoch(match[1], match[2], timezone);
    return Number.isFinite(epoch) ? epoch : null;
  }

  function minutes(time) {
    const [hour, minute] = time.split(':').map(Number);
    return hour * 60 + minute;
  }

  function timeFromMinutes(value) {
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  }

  function isClassActive(classEntry, date) {
    return (!classEntry.semesterStart || date >= classEntry.semesterStart) &&
      (!classEntry.semesterEnd || date <= classEntry.semesterEnd);
  }

  function collectBusyEvents(store, dates, timezone) {
    const busy = new Map(dates.map(date => [date, []]));
    store.getClasses().forEach(classEntry => {
      dates.forEach(date => {
        const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
        if (Number(classEntry.dayOfWeek) === weekday && isClassActive(classEntry, date)) {
          busy.get(date).push({
            start: minutes(classEntry.startTime),
            end: minutes(classEntry.endTime)
          });
        }
      });
    });

    store.getScheduledEvents().forEach(event => {
      const start = parseDateTime(event.start, timezone);
      const end = parseDateTime(event.end, timezone);
      if (start === null || end === null || end <= start) return;
      dates.forEach(date => {
        const [year, month, day] = date.split('-').map(Number);
        const nextDate = formatDate(addDays({ year, month, day }, 1));
        const dayStart = localTimeToEpoch(date, '00:00', timezone);
        const dayEnd = localTimeToEpoch(nextDate, '00:00', timezone);
        if (start >= dayEnd || end <= dayStart) return;
        const startParts = zonedParts(Math.max(start, dayStart), timezone);
        const endParts = zonedParts(Math.min(end, dayEnd), timezone);
        const startMinute = startParts.hour * 60 + startParts.minute;
        const endMinute = endParts.hour * 60 + endParts.minute + (endParts.second > 0 ? 1 : 0);
        busy.get(date).push({
          start: startParts.year === Number(date.slice(0, 4)) &&
            startParts.month === Number(date.slice(5, 7)) &&
            startParts.day === Number(date.slice(8, 10)) ? startMinute : 0,
          end: endMinute === 0 && end > dayStart ? 1440 : endMinute
        });
      });
    });
    return busy;
  }

  function generate(options) {
    const store = window.AppStore;
    const user = store.getUser();
    const timezone = getTimezone(user);
    const days = options.days ?? 7;
    const breakMinutes = options.breakMinutes ?? user.breakMinutes ?? 15;
    const taskIds = new Set(options.taskIds || []);
    const existingEvents = store.getScheduledEvents();
    const tasks = store.getTasks().filter(task =>
      taskIds.has(task.id) &&
      task.status !== 'done' &&
      !task.scheduled &&
      !existingEvents.some(event => event.taskId === task.id)
    );
    tasks.sort((a, b) => {
      const priorityDifference = (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1);
      if (priorityDifference) return priorityDifference;
      const aDeadline = parseDateTime(a.deadline, timezone);
      const bDeadline = parseDateTime(b.deadline, timezone);
      return (aDeadline ?? Infinity) - (bDeadline ?? Infinity) ||
        String(a.id).localeCompare(String(b.id));
    });

    const now = Date.now();
    const today = zonedParts(now, timezone);
    const dates = Array.from({ length: days }, (_, index) =>
      formatDate(addDays(today, index))
    );
    const busy = collectBusyEvents(store, dates, timezone);
    const windows = Object.values(user.preferredHours || {})
      .filter(window => window && window.active)
      .map(window => ({ start: minutes(window.start), end: minutes(window.end) }))
      .sort((a, b) => a.start - b.start);
    const plan = [];
    const unscheduled = [];

    tasks.forEach(task => {
      const deadline = parseDateTime(task.deadline, timezone);
      const duration = Math.max(1, Math.round((task.estimatedHours || 1.5) * 60));
      let proposal = null;
      let hasWindowForDuration = false;
      let candidateBeforeDeadline = false;

      for (let day = 0; day < dates.length && !proposal; day++) {
        for (const window of windows) {
          if (duration > window.end - window.start) continue;
          hasWindowForDuration = true;
          let start = window.start;
          if (day === 0) {
            const current = zonedParts(now, timezone);
            start = Math.max(start, current.hour * 60 + current.minute + 15);
          }
          while (start + duration <= window.end) {
            const end = start + duration;
            const startTime = timeFromMinutes(start);
            const endTime = timeFromMinutes(end);
            const startEpoch = localTimeToEpoch(dates[day], startTime, timezone);
            const endEpoch = localTimeToEpoch(dates[day], timeFromMinutes(end), timezone);
            if (!Number.isFinite(startEpoch) || !Number.isFinite(endEpoch) ||
              endEpoch - startEpoch !== duration * 60000) {
              start += 30;
              continue;
            }
            if (deadline !== null && endEpoch > deadline) {
              start += 30;
              continue;
            }
            candidateBeforeDeadline = true;
            if (busy.get(dates[day]).some(slot =>
              start < slot.end + breakMinutes && end > slot.start - breakMinutes
            )) {
              start += 30;
              continue;
            }
            proposal = {
              taskId: task.id,
              taskTitle: task.title,
              subject: task.subject || null,
              priority: task.priority || 'medium',
              date: dates[day],
              startTime,
              endTime,
              durationMinutes: duration,
              estimatedHours: task.estimatedHours || null,
              deadline: task.deadline || null
            };
            busy.get(dates[day]).push({ start, end });
            break;
          }
          if (proposal) break;
        }
      }

      if (proposal) {
        plan.push(proposal);
        return;
      }
      let reason = 'NO_AVAILABLE_SLOT';
      if (deadline !== null && deadline <= now) reason = 'DEADLINE_PASSED';
      else if (!windows.length) reason = 'NO_ACTIVE_STUDY_WINDOW';
      else if (!hasWindowForDuration) reason = 'DURATION_EXCEEDS_WINDOW';
      else if (!candidateBeforeDeadline && deadline !== null) reason = 'DEADLINE_INFEASIBLE';
      unscheduled.push({ taskId: task.id, reason, message: reasonMessages[reason] });
    });

    return { plan, unscheduled, breakMinutes, timezone };
  }

  function apply(proposedPlan, options) {
    const store = window.AppStore;
    const user = store.getUser();
    const timezone = options.timezone || getTimezone(user);
    const breakMinutes = options.breakMinutes ?? user.breakMinutes ?? 15;
    const tasks = store.getTasks();
    const existingEvents = store.getScheduledEvents();
    const ids = proposedPlan.map(item => item.taskId);
    if (new Set(ids).size !== ids.length) {
      throw new Error('Mỗi công việc chỉ được áp dụng một lần trong một phương án.');
    }

    proposedPlan.forEach(item => {
      const task = tasks.find(candidate => candidate.id === item.taskId);
      if (!task || task.status === 'done' || task.scheduled ||
        existingEvents.some(event => event.taskId === item.taskId)) {
        throw new Error('Một hoặc nhiều công việc đã thay đổi hoặc được xếp lịch. Hãy tạo lại đề xuất.');
      }
      const start = localTimeToEpoch(item.date, item.startTime, timezone);
      const end = localTimeToEpoch(item.date, item.endTime, timezone);
      const deadline = parseDateTime(task.deadline, timezone);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start <= Date.now() ||
        end <= start || end - start !== item.durationMinutes * 60000 ||
        (deadline !== null && end > deadline)) {
        throw new Error('Đề xuất đã hết hạn hoặc vượt quá deadline. Hãy tạo lại đề xuất.');
      }
      const startMinute = minutes(item.startTime);
      const endMinute = minutes(item.endTime);
      if (!Object.values(user.preferredHours || {}).some(window =>
        window && window.active &&
        startMinute >= minutes(window.start) && endMinute <= minutes(window.end)
      )) {
        throw new Error('Khung giờ rảnh đã thay đổi. Hãy tạo lại đề xuất.');
      }
      const weekday = new Date(`${item.date}T00:00:00Z`).getUTCDay();
      const classConflict = store.getClasses().some(classEntry =>
        Number(classEntry.dayOfWeek) === weekday &&
        isClassActive(classEntry, item.date) &&
        startMinute < minutes(classEntry.endTime) + breakMinutes &&
        endMinute > minutes(classEntry.startTime) - breakMinutes
      );
      const eventConflict = existingEvents.some(event => {
        const eventStart = parseDateTime(event.start, timezone);
        const eventEnd = parseDateTime(event.end, timezone);
        return eventStart !== null && eventEnd !== null &&
          start < eventEnd + breakMinutes * 60000 &&
          end > eventStart - breakMinutes * 60000;
      });
      const planConflict = proposedPlan.some(other =>
        other !== item && other.date === item.date &&
        startMinute < minutes(other.endTime) + breakMinutes &&
        endMinute > minutes(other.startTime) - breakMinutes
      );
      if (classConflict || eventConflict || planConflict) {
        throw new Error('Đề xuất bị trùng với lịch đã có hoặc một phiên khác. Hãy tạo lại đề xuất.');
      }
    });

    const events = proposedPlan.map(item => ({
      id: `sch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      taskId: item.taskId,
      title: item.taskTitle,
      subject: item.subject,
      start: new Date(localTimeToEpoch(item.date, item.startTime, timezone)).toISOString(),
      end: new Date(localTimeToEpoch(item.date, item.endTime, timezone)).toISOString(),
      color: '#8b5cf6',
      isAutoScheduled: true
    }));
    const eventsByTask = new Map(events.map(event => [event.taskId, event]));
    const updatedTasks = tasks.map(task => {
      const event = eventsByTask.get(task.id);
      return event
        ? { ...task, scheduled: true, scheduledTime: { start: event.start, end: event.end } }
        : task;
    });
    store.saveScheduledEvents([...existingEvents, ...events]);
    localStorage.setItem('pp_tasks_data', JSON.stringify(updatedTasks));
    const notifications = store.getNotifications();
    notifications.unshift({
      id: `notif_${Date.now()}`,
      title: 'Tự động sắp xếp thành công!',
      message: `Đã tự động phân bổ ${events.length} công việc vào thời khóa biểu thông minh.`,
      type: 'success',
      time: 'Vừa xong',
      read: false
    });
    localStorage.setItem('pp_notifications_data', JSON.stringify(notifications));
    return { events };
  }

  window.ScheduleService = { generate, apply };
})();
