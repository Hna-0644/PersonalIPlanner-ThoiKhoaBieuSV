const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createWorkScheduleService,
  shiftsOverlap
} = require('../src/services/work-schedule-service');

test('shiftsOverlap correctly identifies overlapping and non-overlapping shifts', () => {
  // Touching boundaries do not overlap
  assert.equal(shiftsOverlap(
    { dayOfWeek: 1, startTime: '08:00', endTime: '10:00' },
    { dayOfWeek: 1, startTime: '10:00', endTime: '12:00' }
  ), false);

  // Overlapping times on same weekday
  assert.equal(shiftsOverlap(
    { dayOfWeek: 1, startTime: '08:00', endTime: '10:30' },
    { dayOfWeek: 1, startTime: '10:00', endTime: '12:00' }
  ), true);

  // Different weekdays do not overlap
  assert.equal(shiftsOverlap(
    { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' },
    { dayOfWeek: 2, startTime: '08:00', endTime: '12:00' }
  ), false);

  // Same date overlaps
  assert.equal(shiftsOverlap(
    { workDate: '2026-11-20', startTime: '13:00', endTime: '17:00' },
    { workDate: '2026-11-20', startTime: '16:00', endTime: '19:00' }
  ), true);

  // Different dates do not overlap
  assert.equal(shiftsOverlap(
    { workDate: '2026-11-20', startTime: '13:00', endTime: '17:00' },
    { workDate: '2026-11-21', startTime: '13:00', endTime: '17:00' }
  ), false);

  // Recurring shift overlapping with date-specific shift on that weekday
  // 2026-11-20 is a Friday (weekday 5 in UTC: ISO weekday 5 % 7 = 5)
  assert.equal(shiftsOverlap(
    { dayOfWeek: 5, startTime: '14:00', endTime: '18:00', startDate: '2026-09-01', endDate: '2026-12-31' },
    { workDate: '2026-11-20', startTime: '15:00', endTime: '19:00' }
  ), true);

  // Recurring shift outside active date range does not overlap
  assert.equal(shiftsOverlap(
    { dayOfWeek: 5, startTime: '14:00', endTime: '18:00', startDate: '2026-12-01', endDate: '2026-12-31' },
    { workDate: '2026-11-20', startTime: '15:00', endTime: '19:00' }
  ), false);
});

test('workScheduleService.list queries MySQL and maps rows with public IDs', async () => {
  const rows = [
    {
      id: 1,
      user_id: 5,
      title: 'Cafe barista',
      workplace: 'Highlands Coffee',
      day_of_week: 2,
      work_date: null,
      start_time: '18:00:00',
      end_time: '22:00:00',
      start_date: '2026-09-01',
      end_date: '2026-12-31',
      color: '#b45309',
      notes: 'Weekly evening shift',
      created_at: new Date('2026-09-01T00:00:00.000Z'),
      updated_at: new Date('2026-09-01T00:00:00.000Z')
    },
    {
      id: 2,
      user_id: 5,
      title: 'Lab assistant',
      workplace: 'Room A2-101',
      day_of_week: null,
      work_date: '2026-11-20',
      start_time: '08:00:00',
      end_time: '12:00:00',
      start_date: null,
      end_date: null,
      color: '#0d7480',
      notes: null,
      created_at: new Date('2026-11-01T00:00:00.000Z'),
      updated_at: new Date('2026-11-01T00:00:00.000Z')
    }
  ];

  const pool = {
    async execute(sql, params) {
      assert.ok(sql.includes('FROM work_schedules') && sql.includes('WHERE user_id = ?'));
      assert.deepEqual(params, ['5']);
      return [rows, []];
    }
  };

  const service = createWorkScheduleService({ pool });
  const result = await service.list('5');

  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'wrk_1');
  assert.equal(result[0].title, 'Cafe barista');
  assert.equal(result[0].startTime, '18:00');
  assert.equal(result[0].endTime, '22:00');
  assert.equal(result[0].dayOfWeek, 2);
  assert.equal(result[0].workDate, null);

  assert.equal(result[1].id, 'wrk_2');
  assert.equal(result[1].title, 'Lab assistant');
  assert.equal(result[1].startTime, '08:00');
  assert.equal(result[1].endTime, '12:00');
  assert.equal(result[1].workDate, '2026-11-20');
  assert.equal(result[1].dayOfWeek, null);
});

test('workScheduleService.create locks user, verifies no overlap, inserts row, and invalidates Redis cache', async () => {
  let userLocked = false;
  let committed = false;
  let cacheInvalidated = false;
  const statements = [];

  const connection = {
    async beginTransaction() {},
    async commit() { committed = true; },
    async rollback() {},
    release() {},
    async execute(sql, params) {
      statements.push({ sql, params });
      if (sql.includes('SELECT id FROM users WHERE id = ? FOR UPDATE')) {
        userLocked = true;
        return [[{ id: '5' }], []];
      }
      if (sql.includes('FROM work_schedules') && sql.includes('FOR UPDATE')) {
        return [[], []]; // No existing shifts
      }
      if (sql.includes('INSERT INTO work_schedules')) {
        return [{ insertId: 42 }, []];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const pool = {
    async getConnection() { return connection; }
  };

  const redisClient = {
    async incr(key) {
      assert.equal(key, 'schedule:events:version:5');
      cacheInvalidated = true;
      return 2;
    },
    async del(key) {
      assert.equal(key, 'schedule:events:5:1');
    }
  };

  const service = createWorkScheduleService({ pool, redisClient });
  const shift = await service.create('5', {
    title: 'New barista shift',
    workplace: 'Highlands Coffee',
    dayOfWeek: 3,
    startTime: '14:00',
    endTime: '18:00',
    color: '#b45309'
  });

  assert.equal(userLocked, true);
  assert.equal(committed, true);
  assert.equal(cacheInvalidated, true);
  assert.equal(shift.id, 'wrk_42');
  assert.equal(shift.title, 'New barista shift');
  assert.equal(shift.startTime, '14:00');
  assert.equal(shift.endTime, '18:00');
  assert.equal(shift.color, '#b45309');
});

test('workScheduleService.create rejects shift overlapping with existing shifts', async () => {
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql) {
      if (sql.includes('SELECT id FROM users')) return [[{ id: '5' }], []];
      if (sql.includes('FROM work_schedules')) {
        return [[{
          id: 1,
          title: 'Existing morning shift',
          day_of_week: 2,
          work_date: null,
          start_time: '08:00:00',
          end_time: '12:00:00',
          start_date: null,
          end_date: null
        }], []];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const service = createWorkScheduleService({
    pool: { getConnection: async () => connection }
  });

  await assert.rejects(
    service.create('5', {
      title: 'Overlapping shift',
      dayOfWeek: 2,
      startTime: '10:00',
      endTime: '14:00'
    }),
    error => error.code === 'CONFLICT' && error.message.includes('trùng giờ')
  );
});

test('workScheduleService.update locks user and shift, merges, validates, updates, and invalidates cache', async () => {
  let committed = false;
  let cacheInvalidated = false;

  const connection = {
    async beginTransaction() {},
    async commit() { committed = true; },
    async rollback() {},
    release() {},
    async execute(sql, params) {
      if (sql.includes('SELECT id FROM users')) return [[{ id: '5' }], []];
      if (sql.includes('FROM work_schedules') && sql.includes('WHERE id = ? AND user_id = ?')) {
        return [[{
          id: 10,
          user_id: 5,
          title: 'Old title',
          workplace: 'Old place',
          day_of_week: 1,
          work_date: null,
          start_time: '08:00:00',
          end_time: '12:00:00',
          start_date: null,
          end_date: null,
          color: '#0d7480',
          notes: null,
          created_at: new Date('2026-10-01T00:00:00.000Z'),
          updated_at: new Date('2026-10-01T00:00:00.000Z')
        }], []];
      }
      if (sql.includes('FROM work_schedules') && sql.includes('WHERE user_id = ?')) {
        return [[{
          id: 10,
          title: 'Old title',
          day_of_week: 1,
          work_date: null,
          start_time: '08:00:00',
          end_time: '12:00:00',
          start_date: null,
          end_date: null
        }], []];
      }
      if (sql.includes('UPDATE work_schedules SET')) {
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const redisClient = {
    async incr() { cacheInvalidated = true; return 3; },
    async del() {}
  };

  const service = createWorkScheduleService({
    pool: { getConnection: async () => connection },
    redisClient
  });

  const updated = await service.update('5', 'wrk_10', {
    title: 'New shift title',
    startTime: '09:00',
    endTime: '13:00'
  });

  assert.equal(committed, true);
  assert.equal(cacheInvalidated, true);
  assert.equal(updated.id, 'wrk_10');
  assert.equal(updated.title, 'New shift title');
  assert.equal(updated.startTime, '09:00');
  assert.equal(updated.endTime, '13:00');
});

test('workScheduleService.update throws 404 when shift does not exist', async () => {
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql) {
      if (sql.includes('SELECT id FROM users')) return [[{ id: '5' }], []];
      if (sql.includes('FROM work_schedules')) return [[], []]; // Not found
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const service = createWorkScheduleService({
    pool: { getConnection: async () => connection }
  });

  await assert.rejects(
    service.update('5', 'wrk_999', { title: 'Nonexistent' }),
    error => error.code === 'NOT_FOUND'
  );
});

test('workScheduleService.remove deletes shift and invalidates Redis cache', async () => {
  let cacheInvalidated = false;
  const pool = {
    async execute(sql, params) {
      assert.ok(sql.includes('DELETE FROM work_schedules WHERE id = ? AND user_id = ?'));
      assert.deepEqual(params, ['10', '5']);
      return [{ affectedRows: 1 }, []];
    }
  };

  const redisClient = {
    async incr() { cacheInvalidated = true; return 4; },
    async del() {}
  };

  const service = createWorkScheduleService({ pool, redisClient });
  const result = await service.remove('5', 'wrk_10');

  assert.equal(result.id, 'wrk_10');
  assert.equal(result.success, true);
  assert.equal(cacheInvalidated, true);
});

test('workScheduleService.remove throws 404 when shift not found', async () => {
  const pool = {
    async execute() {
      return [{ affectedRows: 0 }, []];
    }
  };

  const service = createWorkScheduleService({ pool });
  await assert.rejects(
    service.remove('5', 'wrk_999'),
    error => error.code === 'NOT_FOUND'
  );
});
