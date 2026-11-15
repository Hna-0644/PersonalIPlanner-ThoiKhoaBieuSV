/**
 * tests/e2e/tier1-features.test.js
 * Tier 1: Feature Coverage (36 Tests across 6 Features)
 */

const path = require('node:path');
module.paths.push(path.resolve(__dirname, '../../backend/node_modules'));

const { Settings } = require('luxon');
const {
  describe,
  test,
  beforeEach,
  afterEach,
  request,
  createTestApp,
  createAuthToken,
  assert
} = require('./harness');

// Monday 2026-11-16 07:00:00 UTC+7 is 2026-11-16T00:00:00.000Z
const MOCK_MONDAY_0700_MILLIS = new Date('2026-11-16T00:00:00.000Z').getTime();
// Tuesday 2026-11-17 07:00:00 UTC+7 is 2026-11-17T00:00:00.000Z
const MOCK_TUESDAY_0700_MILLIS = new Date('2026-11-17T00:00:00.000Z').getTime();
// Wednesday 2026-11-18 07:00:00 UTC+7 is 2026-11-18T00:00:00.000Z
const MOCK_WEDNESDAY_0700_MILLIS = new Date('2026-11-18T00:00:00.000Z').getTime();
// Thursday 2026-11-19 07:00:00 UTC+7 is 2026-11-19T00:00:00.000Z
const MOCK_THURSDAY_0700_MILLIS = new Date('2026-11-19T00:00:00.000Z').getTime();

describe('Tier 1: Feature Coverage', () => {
  let app, pool, token, redisClient;

  beforeEach(() => {
    Settings.now = () => MOCK_MONDAY_0700_MILLIS;
    const fixture = createTestApp();
    app = fixture.app;
    pool = fixture.pool;
    redisClient = fixture.redisClient;
    token = createAuthToken('1');
  });

  afterEach(() => {
    Settings.now = () => Date.now();
  });

  // ===========================================================================
  // Feature 1: Work Schedule CRUD & Validation (6 Tests)
  // ===========================================================================

  test('[Tier 1] [T1-F1-01] Create Recurring Work Shift (dayOfWeek)', async () => {
    const res = await request(app)
      .post('/api/work-schedules')
      .auth(token)
      .send({
        title: 'Phục vụ quán cà phê',
        workplace: 'The Coffee House, Q.1',
        dayOfWeek: 2,
        startTime: '18:00',
        endTime: '22:00',
        startDate: '2026-09-01',
        endDate: '2026-12-31',
        color: '#b45309',
        notes: 'Ca tối thứ 3 hàng tuần'
      })
      .expect(201);

    assert.match(res.body.data.id, /^wrk_[1-9]\d*$/);
    assert.equal(res.body.data.title, 'Phục vụ quán cà phê');
    assert.equal(res.body.data.workplace, 'The Coffee House, Q.1');
    assert.equal(res.body.data.dayOfWeek, 2);
    assert.equal(res.body.data.workDate, null);
    assert.equal(res.body.data.startTime, '18:00');
    assert.equal(res.body.data.endTime, '22:00');
    assert.equal(res.body.data.startDate, '2026-09-01');
    assert.equal(res.body.data.endDate, '2026-12-31');
    assert.equal(res.body.data.color, '#b45309');
    assert.equal(res.body.data.notes, 'Ca tối thứ 3 hàng tuần');
  });

  test('[Tier 1] [T1-F1-02] Create Specific Date Work Shift (workDate)', async () => {
    const res = await request(app)
      .post('/api/work-schedules')
      .auth(token)
      .send({
        title: 'Trực sự kiện TechFest',
        workplace: 'SECC Q.7',
        workDate: '2026-11-20',
        startTime: '08:00',
        endTime: '17:00',
        color: '#0d7480',
        notes: 'Trực gian hàng công nghệ'
      })
      .expect(201);

    assert.match(res.body.data.id, /^wrk_[1-9]\d*$/);
    assert.equal(res.body.data.title, 'Trực sự kiện TechFest');
    assert.equal(res.body.data.dayOfWeek, null);
    assert.equal(res.body.data.workDate, '2026-11-20');
    assert.equal(res.body.data.startTime, '08:00');
    assert.equal(res.body.data.endTime, '17:00');
    assert.equal(res.body.data.startDate, null);
    assert.equal(res.body.data.endDate, null);
  });

  test('[Tier 1] [T1-F1-03] Retrieve Work Schedule Shift List', async () => {
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Shift 1',
      dayOfWeek: 2,
      startTime: '18:00',
      endTime: '22:00'
    }).expect(201);

    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Shift 2',
      workDate: '2026-11-20',
      startTime: '08:00',
      endTime: '17:00'
    }).expect(201);

    const res = await request(app)
      .get('/api/work-schedules')
      .auth(token)
      .expect(200);

    assert.equal(Array.isArray(res.body.data), true);
    assert.equal(res.body.data.length, 2);
    assert.equal(res.body.data[0].dayOfWeek, 2);
    assert.equal(res.body.data[1].workDate, '2026-11-20');
  });

  test('[Tier 1] [T1-F1-04] Patch Work Schedule Shift Attributes', async () => {
    const created = await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Phục vụ quán cà phê',
      dayOfWeek: 2,
      startTime: '18:00',
      endTime: '22:00'
    }).expect(201);

    const shiftId = created.body.data.id;
    const res = await request(app)
      .patch(`/api/work-schedules/${shiftId}`)
      .auth(token)
      .send({
        startTime: '18:30',
        endTime: '22:30',
        notes: 'Đổi giờ ca tối bắt đầu trễ 30 phút'
      })
      .expect(200);

    assert.equal(res.body.data.id, shiftId);
    assert.equal(res.body.data.startTime, '18:30');
    assert.equal(res.body.data.endTime, '22:30');
    assert.equal(res.body.data.notes, 'Đổi giờ ca tối bắt đầu trễ 30 phút');
    assert.equal(res.body.data.title, 'Phục vụ quán cà phê');
  });

  test('[Tier 1] [T1-F1-05] Delete Work Schedule Shift', async () => {
    const created1 = await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Shift to keep',
      dayOfWeek: 2,
      startTime: '18:00',
      endTime: '22:00'
    }).expect(201);

    const created2 = await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Shift to delete',
      workDate: '2026-11-20',
      startTime: '08:00',
      endTime: '12:00'
    }).expect(201);

    const shiftId = created2.body.data.id;
    const delRes = await request(app)
      .delete(`/api/work-schedules/${shiftId}`)
      .auth(token);

    assert.equal(delRes.status === 200 || delRes.status === 204, true);

    const listRes = await request(app)
      .get('/api/work-schedules')
      .auth(token)
      .expect(200);

    assert.equal(listRes.body.data.length, 1);
    assert.equal(listRes.body.data[0].id, created1.body.data.id);

    // Repeated delete returns 404
    await request(app)
      .delete(`/api/work-schedules/${shiftId}`)
      .auth(token)
      .expect(404);
  });

  test('[Tier 1] [T1-F1-06] Reject Work Schedule Missing Both dayOfWeek and workDate', async () => {
    const res = await request(app)
      .post('/api/work-schedules')
      .auth(token)
      .send({
        title: 'Ca làm việc không hợp lệ',
        startTime: '08:00',
        endTime: '12:00'
      })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.equal(Array.isArray(res.body.error.details), true);
  });

  // ===========================================================================
  // Feature 2: Shift-Aware Auto-Scheduling (6 Tests)
  // ===========================================================================

  test('[Tier 1] [T1-F2-01] Auto-Schedule Evades Single Recurring Shift on Same Day', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '11:30' },
      afternoon: { active: true, start: '14:00', end: '17:30' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    // Work shift on Tuesday 08:00 - 11:30 (dayOfWeek: 2)
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Tuesday Morning Cafe',
      dayOfWeek: 2,
      startTime: '08:00',
      endTime: '11:30'
    }).expect(201);

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Calculus Homework',
      estimatedHours: 1.5,
      deadline: '2026-11-20T23:59:59.000Z',
      priority: 'medium'
    }).expect(201);
    const taskId = taskRes.body.data.id;

    // Advance clock to Tuesday morning for 1-day generation test
    Settings.now = () => MOCK_TUESDAY_0700_MILLIS;

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskId], days: 1, breakMinutes: 15 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].taskId, taskId);
    assert.equal(res.body.data.plan[0].startTime, '14:00');
    assert.equal(res.body.data.plan[0].endTime, '15:30');
    assert.equal(res.body.data.plan[0].durationMinutes, 90);
    assert.equal(res.body.data.unscheduled.length, 0);
  });

  test('[Tier 1] [T1-F2-02] Auto-Schedule Evades Specific Date Work Shift', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '11:30' },
      afternoon: { active: true, start: '14:00', end: '17:30' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Wednesday Afternoon Shift',
      workDate: '2026-11-18',
      startTime: '14:00',
      endTime: '17:30'
    }).expect(201);

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Software Spec',
      estimatedHours: 2.0,
      deadline: '2026-11-18T23:59:59.000Z'
    }).expect(201);
    const taskId = taskRes.body.data.id;

    Settings.now = () => MOCK_WEDNESDAY_0700_MILLIS;

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskId], days: 1, breakMinutes: 0 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].date, '2026-11-18');
    assert.equal(res.body.data.plan[0].startTime, '08:00');
    assert.equal(res.body.data.plan[0].endTime, '10:00');
  });

  test('[Tier 1] [T1-F2-03] Slot Placement in Free Gap Between Morning and Afternoon Shifts', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '12:00' },
      afternoon: { active: true, start: '13:00', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Early Shift',
      workDate: '2026-11-19',
      startTime: '08:00',
      endTime: '10:30'
    }).expect(201);

    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Late Shift',
      workDate: '2026-11-19',
      startTime: '14:30',
      endTime: '17:00'
    }).expect(201);

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Gap Task',
      estimatedHours: 1.0,
      deadline: '2026-11-19T23:59:59.000Z'
    }).expect(201);
    const taskId = taskRes.body.data.id;

    Settings.now = () => MOCK_THURSDAY_0700_MILLIS;

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskId], days: 1, breakMinutes: 15 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    // Morning gap allows starting after 10:30 + 15m = 10:45 -> step 11:00 to 12:00
    assert.equal(res.body.data.plan[0].startTime, '11:00');
    assert.equal(res.body.data.plan[0].endTime, '12:00');
  });

  test('[Tier 1] [T1-F2-04] Multi-Day Horizon Spills Task to Next Day Due to Saturated Work Shifts', async () => {
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Day 1 All Morning',
      workDate: '2026-11-16',
      startTime: '08:00',
      endTime: '11:30'
    }).expect(201);

    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Day 1 All Afternoon',
      workDate: '2026-11-16',
      startTime: '13:30',
      endTime: '17:00'
    }).expect(201);

    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Day 1 All Evening',
      workDate: '2026-11-16',
      startTime: '19:00',
      endTime: '22:00'
    }).expect(201);

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: '2-Hour Project',
      estimatedHours: 2.0,
      deadline: '2026-11-20T23:59:59.000Z'
    }).expect(201);
    const taskId = taskRes.body.data.id;

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskId], days: 3, breakMinutes: 15 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].date, '2026-11-17');
    assert.equal(res.body.data.plan[0].startTime, '08:00');
    assert.equal(res.body.data.plan[0].endTime, '10:00');
  });

  test('[Tier 1] [T1-F2-05] Sequential Placement of Multiple Tasks Around Work Shifts', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '11:30' },
      afternoon: { active: true, start: '14:00', end: '17:30' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Midday Shift',
      workDate: '2026-11-16',
      startTime: '10:00',
      endTime: '14:00'
    }).expect(201);

    const taskA = await request(app).post('/api/tasks').auth(token).send({
      title: 'Task A',
      estimatedHours: 1.0,
      deadline: '2026-11-16T23:59:59.000Z'
    }).expect(201);

    const taskB = await request(app).post('/api/tasks').auth(token).send({
      title: 'Task B',
      estimatedHours: 1.0,
      deadline: '2026-11-16T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskA.body.data.id, taskB.body.data.id], days: 1, breakMinutes: 15 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 2);
    assert.equal(res.body.data.plan[0].startTime, '08:00');
    assert.equal(res.body.data.plan[0].endTime, '09:00');
    assert.equal(res.body.data.plan[1].startTime, '14:30');
    assert.equal(res.body.data.plan[1].endTime, '15:30');
  });

  test('[Tier 1] [T1-F2-06] Full Shift Saturation Over 1-Day Horizon Emits Deterministic Reason', async () => {
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Block Morning',
      workDate: '2026-11-16',
      startTime: '08:00',
      endTime: '11:30'
    }).expect(201);

    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Block Afternoon',
      workDate: '2026-11-16',
      startTime: '13:30',
      endTime: '17:00'
    }).expect(201);

    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Block Evening',
      workDate: '2026-11-16',
      startTime: '19:00',
      endTime: '22:00'
    }).expect(201);

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Urgent Task',
      estimatedHours: 1.5,
      deadline: '2026-11-16T23:59:59.000Z'
    }).expect(201);
    const taskId = taskRes.body.data.id;

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskId], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 0);
    assert.equal(res.body.data.unscheduled.length, 1);
    assert.equal(res.body.data.unscheduled[0].taskId, taskId);
    assert.equal(res.body.data.unscheduled[0].reason, 'NO_AVAILABLE_SLOT');
  });

  // ===========================================================================
  // Feature 3: Conflict Detection & Avoidance (6 Tests)
  // ===========================================================================

  test('[Tier 1] [T1-F3-01] Auto-Scheduler Prevents Overlap with Timetable Classes', async () => {
    await request(app).post('/api/classes').auth(token).send({
      title: 'Calculus Lecture',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '10:00'
    }).expect(201);

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Class Study Task',
      estimatedHours: 1.0,
      deadline: '2026-11-20T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1, breakMinutes: 15 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].startTime >= '10:15', true);
    assert.equal(res.body.data.plan[0].endTime <= '11:30', true);
  });

  test('[Tier 1] [T1-F3-02] Auto-Scheduler Prevents Overlap with Active Work Shifts', async () => {
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Afternoon Shift',
      workDate: '2026-11-16',
      startTime: '13:30',
      endTime: '16:30'
    }).expect(201);

    pool.state.preferences[0].preferred_hours.morning.active = false;

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Evening Study',
      estimatedHours: 1.0,
      deadline: '2026-11-16T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1, breakMinutes: 15 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].startTime, '19:00');
    assert.equal(res.body.data.plan[0].endTime, '20:00');
  });

  test('[Tier 1] [T1-F3-03] Auto-Scheduler Prevents Overlap with Prior Scheduled Events', async () => {
    pool.state.scheduled_events.push({
      id: 201,
      user_id: 1,
      task_id: 99,
      title: 'Prior Event',
      start_at: new Date('2026-11-16T01:30:00.000Z'), // 08:30 UTC+7
      end_at: new Date('2026-11-16T03:00:00.000Z'),   // 10:00 UTC+7
      source: 'manual',
      color: '#8b5cf6'
    });

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Next Event Task',
      estimatedHours: 1.0,
      deadline: '2026-11-20T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1, breakMinutes: 15 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    // Starts after 10:00 + 15m = 10:15 -> step 10:30
    assert.equal(res.body.data.plan[0].startTime, '10:30');
  });

  test('[Tier 1] [T1-F3-04] Rigorous Break Buffer Enforcement (breakMinutes = 30)', async () => {
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Early Afternoon Shift',
      workDate: '2026-11-16',
      startTime: '13:30',
      endTime: '15:00'
    }).expect(201);

    pool.state.preferences[0].preferred_hours.morning.active = false;

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Buffered Task',
      estimatedHours: 1.0,
      deadline: '2026-11-16T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1, breakMinutes: 30 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].startTime >= '15:30', true);
  });

  test('[Tier 1] [T1-F3-05] Tripartite Calendar Conflict Avoidance (Class + Shift + Event)', async () => {
    await request(app).post('/api/classes').auth(token).send({
      title: 'Morning Class',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '10:00'
    }).expect(201);

    pool.state.scheduled_events.push({
      id: 202,
      user_id: 1,
      task_id: 98,
      title: 'Morning Event',
      start_at: new Date('2026-11-16T03:15:00.000Z'), // 10:15 UTC+7
      end_at: new Date('2026-11-16T04:30:00.000Z'),   // 11:30 UTC+7
      source: 'auto',
      color: '#8b5cf6'
    });

    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Afternoon Shift',
      workDate: '2026-11-16',
      startTime: '13:30',
      endTime: '17:00'
    }).expect(201);

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Tripartite Evader',
      estimatedHours: 1.5,
      deadline: '2026-11-16T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].startTime, '19:00');
    assert.equal(res.body.data.plan[0].endTime, '20:30');
  });

  test('[Tier 1] [T1-F3-06] Apply Endpoint Rejects Stale Conflicting Plan (Optimistic Concurrency)', async () => {
    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Task to Conflict',
      estimatedHours: 1.5
    }).expect(201);
    const taskId = taskRes.body.data.id;

    const plan = [{
      taskId,
      date: '2026-11-20',
      startTime: '14:00',
      endTime: '15:30',
      durationMinutes: 90
    }];

    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Conflicting Shift',
      workDate: '2026-11-20',
      startTime: '14:30',
      endTime: '17:00'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({ plan, breakMinutes: 15, timezone: 'Asia/Ho_Chi_Minh' })
      .expect(409);

    assert.equal(res.body.error.code, 'CONFLICT');
    assert.equal(pool.state.scheduled_events.length, 0);
  });

  // ===========================================================================
  // Feature 4: Schedule Application & Persistence (6 Tests)
  // ===========================================================================

  test('[Tier 1] [T1-F4-01] Apply Valid Plan Persists to scheduled_events', async () => {
    const t1 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Task P1',
      estimatedHours: 1.5
    }).expect(201);

    const t2 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Task P2',
      estimatedHours: 1.5
    }).expect(201);

    const plan = [
      {
        taskId: t1.body.data.id,
        date: '2026-11-25',
        startTime: '08:30',
        endTime: '10:00',
        durationMinutes: 90
      },
      {
        taskId: t2.body.data.id,
        date: '2026-11-25',
        startTime: '14:00',
        endTime: '15:30',
        durationMinutes: 90
      }
    ];

    const res = await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({ plan, breakMinutes: 15, timezone: 'Asia/Ho_Chi_Minh' })
      .expect(200);

    assert.equal(res.body.data.events.length, 2);
    assert.match(res.body.data.events[0].id, /^sch_[1-9]\d*$/);

    const listEvents = await request(app)
      .get('/api/schedule/events')
      .auth(token)
      .expect(200);

    assert.equal(listEvents.body.data.length, 2);
  });

  test('[Tier 1] [T1-F4-02] Apply Generates User Notification', async () => {
    const t = await request(app).post('/api/tasks').auth(token).send({
      title: 'Notification Task',
      estimatedHours: 1.0
    }).expect(201);

    await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({
        plan: [{
          taskId: t.body.data.id,
          date: '2026-11-25',
          startTime: '08:30',
          endTime: '09:30',
          durationMinutes: 60
        }],
        breakMinutes: 15,
        timezone: 'Asia/Ho_Chi_Minh'
      })
      .expect(200);

    const nRes = await request(app)
      .get('/api/notifications')
      .auth(token)
      .expect(200);

    assert.equal(nRes.body.data.length >= 1, true);
    assert.equal(nRes.body.data[0].type, 'success');
    assert.equal(nRes.body.data[0].title, 'Đã áp dụng lịch');
  });

  test('[Tier 1] [T1-F4-03] Apply Increments Redis Cache Version & Clears Stale Cache', async () => {
    const t = await request(app).post('/api/tasks').auth(token).send({
      title: 'Redis Task',
      estimatedHours: 1.0
    }).expect(201);

    await redisClient.setEx('schedule:events:version:1', 3600, '3');
    await redisClient.setEx('schedule:events:1:3', 3600, JSON.stringify([{ id: 'old_event' }]));

    await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({
        plan: [{
          taskId: t.body.data.id,
          date: '2026-11-25',
          startTime: '08:30',
          endTime: '09:30',
          durationMinutes: 60
        }],
        breakMinutes: 15,
        timezone: 'Asia/Ho_Chi_Minh'
      })
      .expect(200);

    const ver = await redisClient.get('schedule:events:version:1');
    assert.equal(ver, '4');
    const oldCache = await redisClient.get('schedule:events:1:3');
    assert.equal(oldCache, null);
  });

  test('[Tier 1] [T1-F4-04] Double-Apply Idempotency / Conflict Prevention Rejection', async () => {
    const t = await request(app).post('/api/tasks').auth(token).send({
      title: 'Double Task',
      estimatedHours: 1.0
    }).expect(201);

    const plan = [{
      taskId: t.body.data.id,
      date: '2026-11-25',
      startTime: '08:30',
      endTime: '09:30',
      durationMinutes: 60
    }];

    await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({ plan, breakMinutes: 15, timezone: 'Asia/Ho_Chi_Minh' })
      .expect(200);

    const dupRes = await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({ plan, breakMinutes: 15, timezone: 'Asia/Ho_Chi_Minh' })
      .expect(409);

    assert.equal(dupRes.body.error.code, 'CONFLICT');
  });

  test('[Tier 1] [T1-F4-05] Atomic Transaction Rollback on Mid-Batch Failure', async () => {
    // 1. Connection-level transaction rollback state restoration verification
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    await conn.execute(
      'INSERT INTO work_schedules (user_id, title, start_time, end_time, day_of_week) VALUES (?, ?, ?, ?, ?)',
      [1, 'Rollback Test Shift', '08:00', '10:00', 1]
    );
    assert.equal(pool.state.work_schedules.filter(w => w.title === 'Rollback Test Shift').length, 1);
    await conn.rollback();
    conn.release();
    assert.equal(pool.state.work_schedules.filter(w => w.title === 'Rollback Test Shift').length, 0);

    // 2. Mid-batch transaction rollback via schedule apply
    // Setup a conflicting work shift on 2026-11-25 14:00-16:00
    pool.state.work_schedules.push({
      id: 991,
      user_id: 1,
      title: 'Afternoon Job',
      workplace: 'Office',
      day_of_week: null,
      work_date: '2026-11-25',
      start_time: '14:00',
      end_time: '16:00',
      color: '#b45309',
      notes: null,
      created_at: new Date(),
      updated_at: new Date()
    });

    const t1 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Valid Task 1',
      estimatedHours: 1.0
    }).expect(201);

    const t2 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Conflicting Task 2',
      estimatedHours: 1.0
    }).expect(201);

    const initialEventsCount = pool.state.scheduled_events.length;

    // t1 passes Zod schema and inserts inside transaction; t2 passes schema but conflicts with Afternoon Job, triggering rollback
    const plan = [
      {
        taskId: t1.body.data.id,
        date: '2026-11-25',
        startTime: '08:30',
        endTime: '09:30',
        durationMinutes: 60
      },
      {
        taskId: t2.body.data.id,
        date: '2026-11-25',
        startTime: '14:30',
        endTime: '15:30',
        durationMinutes: 60
      }
    ];

    const errRes = await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({ plan, breakMinutes: 15, timezone: 'Asia/Ho_Chi_Minh' })
      .expect(409);

    assert.equal(errRes.body.error.code, 'CONFLICT');
    assert.equal(pool.state.scheduled_events.length, initialEventsCount);
  });

  test('[Tier 1] [T1-F4-06] Completed Task Rejection at Apply', async () => {
    pool.state.tasks.push({
      id: 399,
      user_id: 1,
      title: 'Done Task',
      status: 'done',
      progress: 100,
      estimated_hours: 1
    });

    const res = await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({
        plan: [{
          taskId: 'tsk_399',
          date: '2026-11-25',
          startTime: '08:30',
          endTime: '09:30',
          durationMinutes: 60
        }],
        breakMinutes: 15,
        timezone: 'Asia/Ho_Chi_Minh'
      })
      .expect(409);

    assert.equal(res.body.error.code, 'CONFLICT');
    assert.match(res.body.error.message, /hoàn thành/i);
  });

  // ===========================================================================
  // Feature 5: Timezone & Working Window Handling (6 Tests)
  // ===========================================================================

  test('[Tier 1] [T1-F5-01] Slots Strictly Inside Preferred Morning Window', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '11:30' },
      afternoon: { active: false, start: '13:30', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    const t = await request(app).post('/api/tasks').auth(token).send({
      title: 'Morning Only',
      estimatedHours: 1.0
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [t.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].startTime >= '08:00', true);
    assert.equal(res.body.data.plan[0].endTime <= '11:30', true);
  });

  test('[Tier 1] [T1-F5-02] Slots Strictly Inside Preferred Afternoon Window', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: false, start: '08:00', end: '11:30' },
      afternoon: { active: true, start: '13:30', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    const t = await request(app).post('/api/tasks').auth(token).send({
      title: 'Afternoon Only',
      estimatedHours: 1.5
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [t.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].startTime >= '13:30', true);
    assert.equal(res.body.data.plan[0].endTime <= '17:00', true);
  });

  test('[Tier 1] [T1-F5-03] Slots Strictly Inside Preferred Evening Window', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: false, start: '08:00', end: '11:30' },
      afternoon: { active: false, start: '13:30', end: '17:00' },
      evening: { active: true, start: '19:00', end: '22:30' }
    };

    const t = await request(app).post('/api/tasks').auth(token).send({
      title: 'Evening Only',
      estimatedHours: 2.0
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [t.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].startTime >= '19:00', true);
    assert.equal(res.body.data.plan[0].endTime <= '22:30', true);
  });

  test('[Tier 1] [T1-F5-04] Inactive Window Strict Exclusion', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '11:30' },
      afternoon: { active: false, start: '13:30', end: '17:00' },
      evening: { active: true, start: '19:00', end: '22:00' }
    };

    const t1 = await request(app).post('/api/tasks').auth(token).send({ title: 'Task 1', estimatedHours: 1.5 }).expect(201);
    const t2 = await request(app).post('/api/tasks').auth(token).send({ title: 'Task 2', estimatedHours: 1.5 }).expect(201);
    const t3 = await request(app).post('/api/tasks').auth(token).send({ title: 'Task 3', estimatedHours: 1.5 }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [t1.body.data.id, t2.body.data.id, t3.body.data.id], days: 2 })
      .expect(200);

    for (const item of res.body.data.plan) {
      const startMin = Number(item.startTime.slice(0, 2)) * 60 + Number(item.startTime.slice(3, 5));
      const endMin = Number(item.endTime.slice(0, 2)) * 60 + Number(item.endTime.slice(3, 5));
      const inAfternoon = startMin < 1020 && endMin > 810;
      assert.equal(inAfternoon, false, `Task ${item.taskId} scheduled inside inactive afternoon window: ${item.startTime}-${item.endTime}`);
    }
  });

  test('[Tier 1] [T1-F5-05] Timezone UTC Conversion in Applied Events', async () => {
    const t = await request(app).post('/api/tasks').auth(token).send({
      title: 'Timezone Task',
      estimatedHours: 2.0
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({
        plan: [{
          taskId: t.body.data.id,
          date: '2026-11-20',
          startTime: '08:00',
          endTime: '10:00',
          durationMinutes: 120
        }],
        breakMinutes: 15,
        timezone: 'Asia/Ho_Chi_Minh'
      })
      .expect(200);

    const event = res.body.data.events[0];
    const eventStartIso = new Date(event.start || event.startAt).toISOString();
    const eventEndIso = new Date(event.end || event.endAt).toISOString();
    assert.equal(eventStartIso, '2026-11-20T01:00:00.000Z');
    assert.equal(eventEndIso, '2026-11-20T03:00:00.000Z');

    // Also verify persisted state via GET /api/schedule/events (Defect 2 fidelity)
    const listRes = await request(app).get('/api/schedule/events').auth(token).expect(200);
    const persisted = listRes.body.data.find(e => e.taskId === t.body.data.id);
    assert.ok(persisted, 'Persisted event must exist in scheduled_events query');
    assert.equal(persisted.start, '2026-11-20T01:00:00.000Z');
    assert.equal(persisted.end, '2026-11-20T03:00:00.000Z');
  });

  test('[Tier 1] [T1-F5-06] Timezone Mismatch Between Plan and Profile Rejection', async () => {
    const t = await request(app).post('/api/tasks').auth(token).send({
      title: 'TZ Mismatch Task',
      estimatedHours: 1.0
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({
        plan: [{
          taskId: t.body.data.id,
          date: '2026-11-20',
          startTime: '08:00',
          endTime: '09:00',
          durationMinutes: 60
        }],
        breakMinutes: 15,
        timezone: 'America/New_York'
      })
      .expect(409);

    assert.equal(res.body.error.code, 'CONFLICT');
    assert.match(res.body.error.message, /múi giờ/i);
  });

  // ===========================================================================
  // Feature 6: Priority & Deadline Weighting (6 Tests)
  // ===========================================================================

  test('[Tier 1] [T1-F6-01] Urgent Priority Scheduled Before High Priority', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '09:30' },
      afternoon: { active: false, start: '13:30', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    const taskH = await request(app).post('/api/tasks').auth(token).send({
      title: 'High Priority Task',
      priority: 'high',
      estimatedHours: 1.5,
      deadline: '2026-11-19T23:59:59.000Z'
    }).expect(201);

    const taskU = await request(app).post('/api/tasks').auth(token).send({
      title: 'Urgent Priority Task',
      priority: 'urgent',
      estimatedHours: 1.5,
      deadline: '2026-11-20T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskH.body.data.id, taskU.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].taskId, taskU.body.data.id);
  });

  test('[Tier 1] [T1-F6-02] High Priority Scheduled Before Medium Priority', async () => {
    const taskMed = await request(app).post('/api/tasks').auth(token).send({
      title: 'Medium Task',
      priority: 'medium',
      estimatedHours: 1.5,
      deadline: '2026-11-20T23:59:59.000Z'
    }).expect(201);

    const taskHigh = await request(app).post('/api/tasks').auth(token).send({
      title: 'High Task',
      priority: 'high',
      estimatedHours: 1.5,
      deadline: '2026-11-20T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskMed.body.data.id, taskHigh.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 2);
    assert.equal(res.body.data.plan[0].taskId, taskHigh.body.data.id);
    assert.equal(res.body.data.plan[1].taskId, taskMed.body.data.id);
  });

  test('[Tier 1] [T1-F6-03] Same Priority Ordered by Earliest Deadline', async () => {
    const taskD2 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Later Deadline Task',
      priority: 'medium',
      estimatedHours: 1.5,
      deadline: '2026-11-22T12:00:00.000Z'
    }).expect(201);

    const taskD1 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Earlier Deadline Task',
      priority: 'medium',
      estimatedHours: 1.5,
      deadline: '2026-11-20T12:00:00.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskD2.body.data.id, taskD1.body.data.id], days: 2 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 2);
    assert.equal(res.body.data.plan[0].taskId, taskD1.body.data.id);
    assert.equal(res.body.data.plan[1].taskId, taskD2.body.data.id);
  });

  test('[Tier 1] [T1-F6-04] Task with Deadline Precedes Task Without Deadline', async () => {
    const taskNoDl = await request(app).post('/api/tasks').auth(token).send({
      title: 'No DL Task',
      priority: 'high',
      estimatedHours: 1.5,
      deadline: null
    }).expect(201);

    const taskWithDl = await request(app).post('/api/tasks').auth(token).send({
      title: 'With DL Task',
      priority: 'high',
      estimatedHours: 1.5,
      deadline: '2026-11-30T00:00:00.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskNoDl.body.data.id, taskWithDl.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 2);
    assert.equal(res.body.data.plan[0].taskId, taskWithDl.body.data.id);
    assert.equal(res.body.data.plan[1].taskId, taskNoDl.body.data.id);
  });

  test('[Tier 1] [T1-F6-05] Unscheduled Reason Code When Urgent Deadline Crowds Out Distant Task', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '09:30' },
      afternoon: { active: false, start: '13:30', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    const t1 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Task 1',
      estimatedHours: 1.5,
      deadline: '2026-11-16T23:59:59.000Z'
    }).expect(201);

    const t2 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Task 2',
      estimatedHours: 1.5,
      deadline: '2026-11-16T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [t1.body.data.id, t2.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.unscheduled.length, 1);
    assert.equal(res.body.data.unscheduled[0].reason, 'NO_AVAILABLE_SLOT');
  });

  test('[Tier 1] [T1-F6-06] Deterministic ID Tie-Breaker for Equal Priority and Null Deadline', async () => {
    pool.state.tasks.push({
      id: 10,
      user_id: 1,
      title: 'Tie Task 10',
      priority: 'medium',
      status: 'todo',
      progress: 0,
      estimated_hours: 1.5,
      deadline: null
    });

    pool.state.tasks.push({
      id: 20,
      user_id: 1,
      title: 'Tie Task 20',
      priority: 'medium',
      status: 'todo',
      progress: 0,
      estimated_hours: 1.5,
      deadline: null
    });

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: ['tsk_20', 'tsk_10'], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 2);
    assert.equal(res.body.data.plan[0].taskId, 'tsk_10');
    assert.equal(res.body.data.plan[1].taskId, 'tsk_20');
  });
});
