const test = require('node:test');
const assert = require('node:assert/strict');
const { DateTime } = require('luxon');
const {
  compareTasks,
  createScheduleService,
  makeBusyCalendar
} = require('../src/services/schedule-service');

test('task ordering uses priority first and then earliest deadline', () => {
  const tasks = [
    { priority: 'medium', deadline: null },
    { priority: 'high', deadline: DateTime.fromISO('2026-10-31T12:00:00Z') },
    { priority: 'high', deadline: DateTime.fromISO('2026-10-31T10:00:00Z') }
  ];
  tasks.sort(compareTasks);
  assert.equal(tasks[0].deadline.toUTC().toISO(), '2026-10-31T10:00:00.000Z');
  assert.equal(tasks[2].priority, 'medium');
});

test('busy calendar includes weekly classes and applied events on local dates', () => {
  const today = DateTime.fromISO('2026-10-26', { zone: 'Asia/Ho_Chi_Minh' });
  const calendar = makeBusyCalendar(
    today,
    2,
    [{
      title: 'Class',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '09:30',
      semesterStart: null,
      semesterEnd: null
    }],
    [{
      id: '1',
      taskId: '4',
      title: 'Existing task',
      start: new Date('2026-10-26T04:00:00.000Z'),
      end: new Date('2026-10-26T05:00:00.000Z')
    }],
    'Asia/Ho_Chi_Minh'
  );
  assert.deepEqual(calendar.get('2026-10-26'), [
    { start: 480, end: 570 },
    { start: 660, end: 720 }
  ]);
  assert.deepEqual(calendar.get('2026-10-27'), []);
});

test('schedule event cache hit returns cached events without querying MySQL', async () => {
  const cachedEvents = [{ id: 'sch_82', title: 'Cached event' }];
  const keys = [];
  const service = createScheduleService({
    pool: {
      async execute() {
        throw new Error('MySQL should not be queried on a cache hit');
      }
    },
    redisClient: {
      async get(key) {
        keys.push(key);
        return key === 'schedule:events:version:5'
          ? '0'
          : JSON.stringify(cachedEvents);
      }
    }
  });

  const result = await service.listEvents('5');

  assert.deepEqual(result, cachedEvents);
  assert.deepEqual(keys, ['schedule:events:version:5', 'schedule:events:5:0']);
});

test('schedule event cache miss reads MySQL and caches events for one hour', async () => {
  const calls = [];
  const rows = [{
    id: '82',
    task_id: '18',
    title: 'Database event',
    subject: 'Study',
    start_at: '2026-10-28 01:00:00',
    end_at: '2026-10-28 02:00:00',
    source: 'auto',
    color: '#8b5cf6'
  }];
  const service = createScheduleService({
    pool: {
      async execute(sql, params) {
        calls.push({ kind: 'mysql', sql, params });
        return [rows, []];
      }
    },
    redisClient: {
      async get(key) {
        calls.push({ kind: 'get', key });
        return key === 'schedule:events:version:5' ? null : null;
      },
      async setEx(key, ttl, value) {
        calls.push({ kind: 'setEx', key, ttl, value });
      }
    }
  });

  const result = await service.listEvents('5');

  assert.deepEqual(result, [{
    id: 'sch_82',
    taskId: 'tsk_18',
    title: 'Database event',
    subject: 'Study',
    start: '2026-10-28T01:00:00.000Z',
    end: '2026-10-28T02:00:00.000Z',
    source: 'auto',
    color: '#8b5cf6'
  }]);
  assert.equal(calls.find(call => call.kind === 'setEx').key, 'schedule:events:5:0');
  assert.equal(calls.find(call => call.kind === 'setEx').ttl, 3600);
  assert.deepEqual(JSON.parse(calls.find(call => call.kind === 'setEx').value), result);
  assert.equal(calls.filter(call => call.kind === 'mysql').length, 1);
});

test('an empty schedule event cache is a hit', async () => {
  let mysqlCalls = 0;
  const service = createScheduleService({
    pool: {
      async execute() {
        mysqlCalls += 1;
        return [[], []];
      }
    },
    redisClient: {
      async get(key) {
        return key === 'schedule:events:version:5' ? null : '[]';
      }
    }
  });

  assert.deepEqual(await service.listEvents('5'), []);
  assert.equal(mysqlCalls, 0);
});

test('malformed schedule event cache is refreshed from MySQL', async () => {
  const values = [];
  const originalError = console.error;
  console.error = (...args) => values.push(args);
  const service = createScheduleService({
    pool: {
      async execute() {
        return [[], []];
      }
    },
    redisClient: {
      async get(key) {
        return key === 'schedule:events:version:5' ? null : '{';
      },
      async setEx(key, ttl, value) {
        values.push([key, ttl, value]);
      }
    }
  });

  try {
    assert.deepEqual(await service.listEvents('5'), []);
  } finally {
    console.error = originalError;
  }

  assert.ok(values.some(args => args[0] === 'schedule:events:5:0' && args[1] === 3600 && args[2] === '[]'));
  assert.ok(values.some(args => String(args[0]).includes('cache')));
});

test('Redis read errors fall back to MySQL and are logged', async () => {
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args);
  let mysqlCalls = 0;
  const service = createScheduleService({
    pool: {
      async execute() {
        mysqlCalls += 1;
        return [[], []];
      }
    },
    redisClient: {
      async get() { throw new Error('Redis unavailable'); },
      async setEx() {}
    }
  });

  try {
    assert.deepEqual(await service.listEvents('5'), []);
  } finally {
    console.error = originalError;
  }

  assert.equal(mysqlCalls, 1);
  assert.ok(logs.some(args => args[1]?.message === 'Redis unavailable'));
});

test('Redis write errors do not discard schedule events read from MySQL', async () => {
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args);
  const service = createScheduleService({
    pool: { async execute() { return [[], []]; } },
    redisClient: {
      async get(key) {
        return key === 'schedule:events:version:5' ? null : null;
      },
      async setEx() { throw new Error('Redis write unavailable'); }
    }
  });

  try {
    assert.deepEqual(await service.listEvents('5'), []);
  } finally {
    console.error = originalError;
  }

  assert.ok(logs.some(args => args[1]?.message === 'Redis write unavailable'));
});

test('an unready Redis client is bypassed so MySQL remains available', async () => {
  let redisCalls = 0;
  const service = createScheduleService({
    pool: { async execute() { return [[], []]; } },
    redisClient: {
      isReady: false,
      async get() {
        redisCalls += 1;
        throw new Error('Redis is reconnecting');
      },
      async setEx() { redisCalls += 1; }
    }
  });

  assert.deepEqual(await service.listEvents('5'), []);
  assert.equal(redisCalls, 0);
});

test('a late schedule read cannot repopulate cache after invalidation', async () => {
  const versionKey = 'schedule:events:version:5';
  const cache = new Map();
  let version = '0';
  const redisClient = {
    async get(key) {
      return key === versionKey ? version : cache.get(key) ?? null;
    },
    async setEx(key, ttl, value) {
      cache.set(key, value);
    },
    async incr(key) {
      assert.equal(key, versionKey);
      version = String(Number(version) + 1);
      return Number(version);
    },
    async del(key) {
      cache.delete(key);
    }
  };
  let startFirstQuery;
  let finishFirstQuery;
  const firstQueryStarted = new Promise(resolve => {
    startFirstQuery = resolve;
  });
  const firstQueryGate = new Promise(resolve => {
    finishFirstQuery = resolve;
  });
  let queryCount = 0;
  const pool = {
    async execute() {
      queryCount += 1;
      if (queryCount === 1) {
        startFirstQuery();
        await firstQueryGate;
        return [[{
          id: '82',
          task_id: '18',
          title: 'Old event',
          subject: null,
          start_at: '2026-10-28 01:00:00',
          end_at: '2026-10-28 02:00:00',
          source: 'auto',
          color: '#8b5cf6'
        }], []];
      }
      return [[{
        id: '83',
        task_id: '19',
        title: 'New event',
        subject: null,
        start_at: '2026-10-28 03:00:00',
        end_at: '2026-10-28 04:00:00',
        source: 'auto',
        color: '#8b5cf6'
      }], []];
    }
  };
  const service = createScheduleService({ pool, redisClient });

  const pendingRead = service.listEvents('5');
  await firstQueryStarted;
  const nextVersion = await redisClient.incr(versionKey);
  await redisClient.del(`schedule:events:5:${nextVersion - 1}`);
  finishFirstQuery();
  await pendingRead;

  const eventsAfterInvalidation = await service.listEvents('5');

  assert.equal(eventsAfterInvalidation[0].title, 'New event');
  assert.equal(queryCount, 2);
});

test('schedule generation respects selected tasks and returns a partial-plan shape', async () => {
  const calls = [];
  const pool = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM study_preferences')) {
        return [[{
          preferred_hours: {
            morning: { start: '00:00', end: '23:59', active: true },
            afternoon: { start: '00:00', end: '00:00', active: false },
            evening: { start: '00:00', end: '00:00', active: false }
          },
          break_minutes: 15,
          timezone: 'Asia/Ho_Chi_Minh'
        }], []];
      }
      if (sql.includes('FROM tasks WHERE user_id')) {
        return [[{
          id: '18',
          title: 'Selected task',
          subject: null,
          priority: 'high',
          status: 'todo',
          estimated_hours: 1,
          deadline: null
        }], []];
      }
      if (sql.includes('SELECT DISTINCT task_id')) return [[], []];
      if (sql.includes('FROM classes')) return [[], []];
      if (sql.includes('FROM work_schedules')) return [[], []];
      if (sql.includes('FROM scheduled_events')) return [[], []];
      throw new Error(`Unexpected SQL in test: ${sql}`);
    }
  };
  const service = createScheduleService({ pool });

  const result = await service.generate('5', { taskIds: ['tsk_18'], days: 7 });

  assert.equal(result.plan.length, 1);
  assert.equal(result.plan[0].taskId, 'tsk_18');
  assert.deepEqual(result.unscheduled, []);
  assert.ok(calls.some(call => call.sql.includes('FROM tasks WHERE user_id') && call.params.includes('18')));
});

test('schedule application validates and persists events in one transaction', async () => {
  const statements = [];
  const operations = [];
  let committed = false;
  const connection = {
    async beginTransaction() {},
    async commit() {
      committed = true;
      operations.push('commit');
    },
    async rollback() {},
    release() {},
    async execute(sql, params) {
      statements.push(sql);
      if (sql.includes('SELECT id FROM users')) return [[{ id: '5' }], []];
      if (sql.includes('FROM study_preferences')) {
        return [[{
          preferred_hours: {
            morning: { start: '08:00', end: '12:00', active: true },
            afternoon: { start: '13:00', end: '17:00', active: false },
            evening: { start: '18:00', end: '21:00', active: false }
          },
          break_minutes: 15,
          timezone: 'Asia/Ho_Chi_Minh'
        }], []];
      }
      if (sql.includes('FROM tasks') && sql.includes('FOR UPDATE')) {
        return [[{
          id: '18',
          title: 'Selected task',
          subject: 'Study',
          status: 'todo',
          deadline: null
        }], []];
      }
      if (sql.includes('SELECT task_id FROM scheduled_events')) return [[], []];
      if (sql.includes('FROM classes')) return [[], []];
      if (sql.includes('FROM work_schedules')) return [[], []];
      if (sql.includes('SELECT id, start_at, end_at FROM scheduled_events')) return [[], []];
      if (sql.includes('INSERT INTO scheduled_events')) return [{ insertId: 82 }, []];
      if (sql.includes('INSERT INTO notifications')) return [{ insertId: 1 }, []];
      throw new Error(`Unexpected SQL in test: ${sql}`);
    }
  };
  const service = createScheduleService({
    pool: { getConnection: async () => connection },
    redisClient: {
      async incr(key) {
        assert.equal(committed, true);
        assert.equal(key, 'schedule:events:version:5');
        operations.push('incr');
        return 1;
      },
      async del(key) {
        assert.equal(committed, true);
        operations.push(`del:${key}`);
      }
    }
  });
  const date = DateTime.now().setZone('Asia/Ho_Chi_Minh').plus({ days: 2 }).toISODate();

  const result = await service.apply('5', [{
    taskId: 'tsk_18',
    date,
    startTime: '09:00',
    endTime: '10:00',
    durationMinutes: 60
  }], 10, 'Asia/Ho_Chi_Minh');

  assert.equal(committed, true);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].id, 'sch_82');
  assert.ok(statements.some(sql => sql.includes('INSERT INTO scheduled_events')));
  assert.deepEqual(operations, ['commit', 'incr', 'del:schedule:events:5:0']);
});

test('failed schedule application does not invalidate the event cache', async () => {
  let deleteCalls = 0;
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql) {
      if (sql.includes('SELECT id FROM users')) return [[{ id: '5' }], []];
      if (sql.includes('FROM study_preferences')) return [[], []];
      throw new Error(`Unexpected SQL in test: ${sql}`);
    }
  };
  const service = createScheduleService({
    pool: { getConnection: async () => connection },
    redisClient: { async del() { deleteCalls += 1; } }
  });

  await assert.rejects(
    service.apply('5', [], 0, 'Asia/Ho_Chi_Minh'),
    error => error.code === 'NOT_FOUND'
  );
  assert.equal(deleteCalls, 0);
});

test('schedule generation distinguishes an infeasible future deadline from an expired one', async () => {
  const pool = {
    async execute(sql) {
      if (sql.includes('FROM study_preferences')) {
        return [[{
          preferred_hours: {
            morning: { start: '00:00', end: '23:59', active: true },
            afternoon: { start: '00:00', end: '00:00', active: false },
            evening: { start: '00:00', end: '00:00', active: false }
          },
          break_minutes: 0,
          timezone: 'Asia/Ho_Chi_Minh'
        }], []];
      }
      if (sql.includes('FROM tasks WHERE user_id')) {
        return [[{
          id: '18',
          title: 'Soon due',
          subject: null,
          priority: 'high',
          status: 'todo',
          estimated_hours: 1,
          deadline: DateTime.now().plus({ minutes: 30 }).toJSDate()
        }], []];
      }
      if (sql.includes('SELECT DISTINCT task_id')) return [[], []];
      if (sql.includes('FROM classes')) return [[], []];
      if (sql.includes('FROM work_schedules')) return [[], []];
      if (sql.includes('FROM scheduled_events')) return [[], []];
      throw new Error(`Unexpected SQL in test: ${sql}`);
    }
  };
  const service = createScheduleService({ pool });

  const result = await service.generate('5', { taskIds: ['tsk_18'], days: 1 });

  assert.equal(result.plan.length, 0);
  assert.equal(result.unscheduled[0].reason, 'DEADLINE_INFEASIBLE');
  assert.equal(result.breakMinutes, 0);
  assert.equal(result.timezone, 'Asia/Ho_Chi_Minh');
});

test('busy calendar includes recurring work shifts and date-specific work shifts', () => {
  const today = DateTime.fromISO('2026-10-26', { zone: 'Asia/Ho_Chi_Minh' }); // Monday (weekday: 1)
  const calendar = makeBusyCalendar(
    today,
    2,
    [],
    [],
    [
      {
        title: 'Barista shift',
        dayOfWeek: 1,
        workDate: null,
        startTime: '18:00',
        endTime: '22:00',
        startDate: null,
        endDate: null
      },
      {
        title: 'Tuesday one-off shift',
        dayOfWeek: null,
        workDate: '2026-10-27',
        startTime: '13:00',
        endTime: '17:00',
        startDate: null,
        endDate: null
      }
    ],
    'Asia/Ho_Chi_Minh'
  );

  assert.deepEqual(calendar.get('2026-10-26'), [
    { start: 1080, end: 1320 } // 18:00 - 22:00
  ]);
  assert.deepEqual(calendar.get('2026-10-27'), [
    { start: 780, end: 1020 } // 13:00 - 17:00
  ]);
});

test('schedule generation avoids work shifts and respects break time', async () => {
  const today = DateTime.now().setZone('Asia/Ho_Chi_Minh').startOf('day');
  const tomorrow = today.plus({ days: 1 });
  const todayWeekday = today.weekday % 7;
  const tomorrowWeekday = tomorrow.weekday % 7;

  const pool = {
    async execute(sql, params) {
      if (sql.includes('FROM study_preferences')) {
        return [[{
          preferred_hours: {
            morning: { start: '08:00', end: '12:00', active: true },
            afternoon: { start: '00:00', end: '00:00', active: false },
            evening: { start: '00:00', end: '00:00', active: false }
          },
          break_minutes: 15,
          timezone: 'Asia/Ho_Chi_Minh'
        }], []];
      }
      if (sql.includes('FROM tasks WHERE user_id')) {
        return [[{
          id: '18',
          title: 'Study task',
          subject: null,
          priority: 'high',
          status: 'todo',
          estimated_hours: 1,
          deadline: null
        }], []];
      }
      if (sql.includes('SELECT DISTINCT task_id')) return [[], []];
      if (sql.includes('FROM classes')) return [[], []];
      if (sql.includes('FROM work_schedules')) {
        return [[
          {
            id: 1,
            title: 'Today morning shift',
            workplace: 'Library',
            day_of_week: todayWeekday,
            work_date: null,
            start_time: '08:00',
            end_time: '10:00',
            start_date: null,
            end_date: null,
            color: '#0d7480',
            notes: null
          },
          {
            id: 2,
            title: 'Tomorrow morning shift',
            workplace: 'Library',
            day_of_week: tomorrowWeekday,
            work_date: null,
            start_time: '08:00',
            end_time: '10:00',
            start_date: null,
            end_date: null,
            color: '#0d7480',
            notes: null
          }
        ], []];
      }
      if (sql.includes('FROM scheduled_events')) return [[], []];
      throw new Error(`Unexpected SQL in test: ${sql}`);
    }
  };
  const service = createScheduleService({ pool });

  const result = await service.generate('5', { taskIds: ['tsk_18'], days: 2 });

  assert.equal(result.plan.length, 1);
  const scheduledItem = result.plan[0];
  // Since 08:00 - 10:00 is work shift, with 15m break, the earliest slot starts at 10:15 or later
  assert.equal(scheduledItem.taskId, 'tsk_18');
  assert.ok(scheduledItem.startTime >= '10:15', `Expected startTime >= 10:15, got ${scheduledItem.startTime}`);
});

test('schedule application rejects plan that overlaps with active work shifts', async () => {
  const futureDate = DateTime.now().setZone('Asia/Ho_Chi_Minh').plus({ days: 2 }).toISODate();
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql) {
      if (sql.includes('SELECT id FROM users')) return [[{ id: '5' }], []];
      if (sql.includes('FROM study_preferences')) {
        return [[{
          preferred_hours: {
            morning: { start: '08:00', end: '18:00', active: true },
            afternoon: { start: '00:00', end: '00:00', active: false },
            evening: { start: '00:00', end: '00:00', active: false }
          },
          break_minutes: 15,
          timezone: 'Asia/Ho_Chi_Minh'
        }], []];
      }
      if (sql.includes('FROM tasks') && sql.includes('FOR UPDATE')) {
        return [[{
          id: '18',
          title: 'Study task',
          subject: 'Study',
          status: 'todo',
          deadline: null
        }], []];
      }
      if (sql.includes('SELECT task_id FROM scheduled_events')) return [[], []];
      if (sql.includes('FROM classes')) return [[], []];
      if (sql.includes('FROM work_schedules')) {
        return [[{
          id: 1,
          title: 'Afternoon work shift',
          workplace: 'Cafe',
          day_of_week: null,
          work_date: futureDate,
          start_time: '13:00',
          end_time: '17:00',
          start_date: null,
          end_date: null,
          color: '#0d7480',
          notes: null
        }], []];
      }
      if (sql.includes('SELECT id, start_at, end_at FROM scheduled_events')) return [[], []];
      throw new Error(`Unexpected SQL in test: ${sql}`);
    }
  };

  const service = createScheduleService({
    pool: { getConnection: async () => connection }
  });

  await assert.rejects(
    service.apply('5', [{
      taskId: 'tsk_18',
      date: futureDate,
      startTime: '14:00',
      endTime: '15:00',
      durationMinutes: 60
    }], 15, 'Asia/Ho_Chi_Minh'),
    error => error.code === 'CONFLICT' && error.message.includes('lịch làm việc')
  );
});

test('makeBusyCalendar handles Luxon DateTime, JS Date, and ISO string events without dropping any', () => {
  const today = DateTime.fromISO('2026-11-16', { zone: 'Asia/Ho_Chi_Minh' });
  const events = [
    {
      id: 'ev_luxon',
      taskId: 'tsk_1',
      title: 'Luxon DateTime event',
      start: DateTime.fromISO('2026-11-16T01:00:00.000Z', { zone: 'utc' }),
      end: DateTime.fromISO('2026-11-16T02:00:00.000Z', { zone: 'utc' })
    },
    {
      id: 'ev_date',
      taskId: 'tsk_2',
      title: 'JS Date event',
      start: new Date('2026-11-16T03:00:00.000Z'),
      end: new Date('2026-11-16T04:30:00.000Z')
    },
    {
      id: 'ev_iso',
      taskId: 'tsk_3',
      title: 'ISO string event',
      start: '2026-11-16T06:00:00.000Z',
      end: '2026-11-16T07:00:00.000Z'
    }
  ];

  const calendar = makeBusyCalendar(
    today,
    1,
    [],
    events,
    [],
    'Asia/Ho_Chi_Minh'
  );

  const busySlots = calendar.get('2026-11-16');
  assert.ok(busySlots, 'Busy slots must exist for the date');
  assert.equal(busySlots.length, 3, 'All 3 events must be ingested without dropping any');
  assert.deepEqual(busySlots, [
    { start: 480, end: 540 },
    { start: 600, end: 690 },
    { start: 780, end: 840 }
  ]);
});

test('compareTasks deterministically sorts tasks without deadlines by numeric ID', () => {
  const t1 = { id: 'tsk_20', priority: 'medium', deadline: null };
  const t2 = { id: 'tsk_10', priority: 'medium', deadline: null };
  const t3 = { id: 'tsk_2', priority: 'medium', deadline: null };
  const t4 = { id: 'tsk_100', priority: 'medium', deadline: null };

  const sortedAscending = [t1, t2, t3, t4].sort(compareTasks);
  assert.deepEqual(
    sortedAscending.map(t => t.id),
    ['tsk_2', 'tsk_10', 'tsk_20', 'tsk_100'],
    'Equal priority tasks without deadlines must be deterministically sorted by numeric ID'
  );

  const sortedFromInverted = [t4, t3, t2, t1].sort(compareTasks);
  assert.deepEqual(
    sortedFromInverted.map(t => t.id),
    ['tsk_2', 'tsk_10', 'tsk_20', 'tsk_100'],
    'Sorting must be stable and deterministic regardless of input order'
  );

  const deadline = DateTime.fromISO('2026-11-20T10:00:00Z');
  const tWithDeadline1 = { id: 'tsk_30', priority: 'high', deadline };
  const tWithDeadline2 = { id: 'tsk_5', priority: 'high', deadline };
  const sortedDeadline = [tWithDeadline1, tWithDeadline2].sort(compareTasks);
  assert.deepEqual(
    sortedDeadline.map(t => t.id),
    ['tsk_5', 'tsk_30'],
    'Equal priority and equal deadline tasks must be tie-broken by numeric ID'
  );
});
