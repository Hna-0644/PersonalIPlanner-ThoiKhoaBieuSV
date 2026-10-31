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
  let committed = false;
  const connection = {
    async beginTransaction() {},
    async commit() { committed = true; },
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
      if (sql.includes('SELECT id, start_at, end_at FROM scheduled_events')) return [[], []];
      if (sql.includes('INSERT INTO scheduled_events')) return [{ insertId: 82 }, []];
      if (sql.includes('INSERT INTO notifications')) return [{ insertId: 1 }, []];
      throw new Error(`Unexpected SQL in test: ${sql}`);
    }
  };
  const service = createScheduleService({
    pool: { getConnection: async () => connection }
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
