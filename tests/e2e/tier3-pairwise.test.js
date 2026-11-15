/**
 * tests/e2e/tier3-pairwise.test.js
 * Tier 3: Cross-Feature Pairwise Interaction Tests (12 Tests: T3-01 to T3-12)
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

const MOCK_MONDAY_0700_MILLIS = new Date('2026-11-16T00:00:00.000Z').getTime();
const MOCK_TUESDAY_0700_MILLIS = new Date('2026-11-17T00:00:00.000Z').getTime();
const MOCK_WEDNESDAY_0700_MILLIS = new Date('2026-11-18T00:00:00.000Z').getTime();
const MOCK_THURSDAY_0700_MILLIS = new Date('2026-11-19T00:00:00.000Z').getTime();

describe('Tier 3: Cross-Feature Pairwise Interactions', () => {
  let app, pool, token;

  beforeEach(() => {
    Settings.now = () => MOCK_MONDAY_0700_MILLIS;
    const fixture = createTestApp();
    app = fixture.app;
    pool = fixture.pool;
    token = createAuthToken('1');
  });

  afterEach(() => {
    Settings.now = () => Date.now();
  });

  test('[Tier 3] [T3-01] Abutting Boundary Condition (Class 08:00-10:00, Shift 10:00-14:00)', async () => {
    // Tuesday (dayOfWeek: 2)
    await request(app).post('/api/classes').auth(token).send({
      title: 'Calculus II',
      dayOfWeek: 2,
      startTime: '08:00',
      endTime: '10:00'
    }).expect(201);

    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Campus Bookstore',
      workplace: 'Student Center',
      dayOfWeek: 2,
      startTime: '10:00',
      endTime: '14:00'
    }).expect(201);

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Calculus Homework',
      priority: 'high',
      estimatedHours: 1.5,
      deadline: '2026-11-20T23:59:59.000Z'
    }).expect(201);
    const taskId = taskRes.body.data.id;

    Settings.now = () => MOCK_TUESDAY_0700_MILLIS;

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskId], days: 7, breakMinutes: 15 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].taskId, taskId);
    // Shift ends at 14:00, buffer 15m -> 14:15 -> step 14:30
    assert.equal(res.body.data.plan[0].startTime, '14:30');
    assert.equal(res.body.data.plan[0].endTime, '16:00');

    // Apply the plan
    const applyRes = await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({
        plan: res.body.data.plan,
        breakMinutes: 15,
        timezone: 'Asia/Ho_Chi_Minh'
      })
      .expect(200);

    assert.equal(applyRes.body.data.events.length, 1);
  });

  test('[Tier 3] [T3-02] Overlapping Work Shift and Class Coexistence in Busy Timeline', async () => {
    // Wednesday (dayOfWeek: 3)
    await request(app).post('/api/classes').auth(token).send({
      title: 'Physics Lab',
      dayOfWeek: 3,
      startTime: '13:00',
      endTime: '15:00'
    }).expect(201);

    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Tutor Shift',
      dayOfWeek: 3,
      startTime: '14:00',
      endTime: '17:00'
    }).expect(201);

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Lab Report',
      priority: 'high',
      estimatedHours: 1.5,
      deadline: '2026-11-20T23:59:59.000Z'
    }).expect(201);
    const taskId = taskRes.body.data.id;

    Settings.now = () => MOCK_WEDNESDAY_0700_MILLIS;

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskId], days: 1, breakMinutes: 15 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    // Morning window is free: 08:00 - 09:30
    assert.equal(res.body.data.plan[0].startTime, '08:00');
    assert.equal(res.body.data.plan[0].endTime, '09:30');
  });

  test('[Tier 3] [T3-03] Shift-Aware Auto-Scheduled Task Buffer Exclusion', async () => {
    // Thursday (dayOfWeek: 4)
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Library Desk',
      dayOfWeek: 4,
      startTime: '09:00',
      endTime: '11:00'
    }).expect(201);

    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '12:00' },
      afternoon: { active: true, start: '13:30', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Read Chapter 4',
      priority: 'high',
      estimatedHours: 1.0,
      deadline: '2026-11-20T23:59:59.000Z'
    }).expect(201);
    const taskId = taskRes.body.data.id;

    Settings.now = () => MOCK_THURSDAY_0700_MILLIS;

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskId], days: 1, breakMinutes: 20 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    // Buffer exclusion zone [08:40, 11:20]. Afternoon placement:
    assert.equal(res.body.data.plan[0].startTime, '13:30');
    assert.equal(res.body.data.plan[0].endTime, '14:30');
  });

  test('[Tier 3] [T3-04] Multi-Task Midday Packing Between Morning and Evening Work Shifts', async () => {
    // Morning shift: 08:30 - 11:30. Evening shift: 18:00 - 21:30.
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Morning Barista',
      dayOfWeek: 1,
      startTime: '08:30',
      endTime: '11:30'
    }).expect(201);

    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Evening Cashier',
      dayOfWeek: 1,
      startTime: '18:00',
      endTime: '21:30'
    }).expect(201);

    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '11:00' },
      afternoon: { active: true, start: '12:30', end: '17:30' },
      evening: { active: true, start: '18:30', end: '22:00' }
    };

    const tA = await request(app).post('/api/tasks').auth(token).send({
      title: 'Assignment 1',
      priority: 'high',
      estimatedHours: 1.5,
      deadline: '2026-11-20T23:59:59.000Z'
    }).expect(201);

    const tB = await request(app).post('/api/tasks').auth(token).send({
      title: 'Assignment 2',
      priority: 'high',
      estimatedHours: 2.0,
      deadline: '2026-11-20T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [tA.body.data.id, tB.body.data.id], days: 1, breakMinutes: 15 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 2);
    // Task A: 12:30 - 14:00
    assert.equal(res.body.data.plan[0].startTime, '12:30');
    assert.equal(res.body.data.plan[0].endTime, '14:00');
    // Task B: 14:30 - 16:30
    assert.equal(res.body.data.plan[1].startTime, '14:30');
    assert.equal(res.body.data.plan[1].endTime, '16:30');

    // Apply
    const applyRes = await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({ plan: res.body.data.plan, breakMinutes: 15, timezone: 'Asia/Ho_Chi_Minh' })
      .expect(200);

    assert.equal(applyRes.body.data.events.length, 2);
  });

  test('[Tier 3] [T3-05] Coexistence of Weekly Recurring Shift and Specific-Date Shift', async () => {
    // Tuesday recurring: 08:00 - 11:00
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Lab Duty',
      dayOfWeek: 2,
      startTime: '08:00',
      endTime: '11:00'
    }).expect(201);

    // Tuesday one-off: 13:30 - 17:00
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Inventory Count',
      workDate: '2026-11-17',
      startTime: '13:30',
      endTime: '17:00'
    }).expect(201);

    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '11:30' },
      afternoon: { active: true, start: '13:30', end: '17:00' },
      evening: { active: true, start: '19:00', end: '22:00' }
    };

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Urgent Review',
      priority: 'urgent',
      estimatedHours: 1.5,
      deadline: '2026-11-17T23:59:59.000Z'
    }).expect(201);

    Settings.now = () => MOCK_TUESDAY_0700_MILLIS;

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1, breakMinutes: 15 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    // Morning and afternoon blocked; task placed in evening 19:00 - 20:30
    assert.equal(res.body.data.plan[0].startTime, '19:00');
    assert.equal(res.body.data.plan[0].endTime, '20:30');
  });

  test('[Tier 3] [T3-06] Date Validity Bounds Filtering (Shift Inactive Outside Start/End Dates)', async () => {
    // Recurring on Wednesday (dayOfWeek: 3), but only valid from 2026-11-20 to 2026-12-31
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Semester 2 Cafe Shift',
      dayOfWeek: 3,
      startTime: '08:00',
      endTime: '12:00',
      startDate: '2026-11-20',
      endDate: '2026-12-31'
    }).expect(201);

    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '12:00' },
      afternoon: { active: true, start: '13:30', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    // Date 1: Wednesday 2026-11-18 (before startDate)
    Settings.now = () => MOCK_WEDNESDAY_0700_MILLIS;

    const t1 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Nov 18 Prep',
      priority: 'high',
      estimatedHours: 2.0,
      deadline: '2026-11-18T23:59:59.000Z'
    }).expect(201);

    const res1 = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [t1.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res1.body.data.plan.length, 1);
    // Shift is not yet active, so morning 08:00 - 10:00 is used!
    assert.equal(res1.body.data.plan[0].startTime, '08:00');
    assert.equal(res1.body.data.plan[0].endTime, '10:00');

    // Date 2: Wednesday 2026-11-25 (inside validity)
    Settings.now = () => new Date('2026-11-25T00:00:00.000Z').getTime();

    const t2 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Nov 25 Prep',
      priority: 'high',
      estimatedHours: 2.0,
      deadline: '2026-11-25T23:59:59.000Z'
    }).expect(201);

    const res2 = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [t2.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res2.body.data.plan.length, 1);
    // Shift is active! Morning is blocked, so task placed in afternoon!
    assert.equal(res2.body.data.plan[0].startTime, '13:30');
    assert.equal(res2.body.data.plan[0].endTime, '15:30');
  });

  test('[Tier 3] [T3-07] Time-of-Check to Time-of-Use (TOCTOU) Conflict on Schedule Apply', async () => {
    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'TOCTOU Task',
      estimatedHours: 1.5
    }).expect(201);
    const taskId = taskRes.body.data.id;

    // Generate plan
    const genRes = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskId], days: 7 })
      .expect(200);

    const plan = genRes.body.data.plan;
    assert.equal(plan.length, 1);

    // Interleave action: add work shift covering that slot
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Emergency Coverage',
      workDate: plan[0].date,
      startTime: plan[0].startTime,
      endTime: plan[0].endTime
    }).expect(201);

    // Try applying stale plan
    const applyRes = await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({ plan, breakMinutes: 15, timezone: 'Asia/Ho_Chi_Minh' })
      .expect(409);

    assert.equal(applyRes.body.error.code, 'CONFLICT');
    assert.equal(pool.state.scheduled_events.length, 0);
  });

  test('[Tier 3] [T3-08] Concurrent Schedule Apply Transaction Isolation & Serialization Race', async () => {
    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Race Task',
      estimatedHours: 1.5
    }).expect(201);
    const taskId = taskRes.body.data.id;

    const plan = [{
      taskId,
      date: '2026-11-21',
      startTime: '08:30',
      endTime: '10:00',
      durationMinutes: 90
    }];

    const applyA = request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({ plan, breakMinutes: 15, timezone: 'Asia/Ho_Chi_Minh' });

    const applyB = request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({ plan, breakMinutes: 15, timezone: 'Asia/Ho_Chi_Minh' });

    const [resA, resB] = await Promise.all([applyA, applyB]);

    const statuses = [resA.status, resB.status].sort();
    assert.equal(statuses[0], 200);
    assert.equal(statuses[1], 409);

    const listEvents = await request(app)
      .get('/api/schedule/events')
      .auth(token)
      .expect(200);

    assert.equal(listEvents.body.data.length, 1);
  });

  test('[Tier 3] [T3-09] Triple Adjacency Exact-Buffer Packing (Class -> Task -> Shift)', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '12:00' },
      afternoon: { active: true, start: '13:30', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    // Class: 08:00 - 09:30
    await request(app).post('/api/classes').auth(token).send({
      title: 'Math',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '09:30'
    }).expect(201);

    // Shift: 11:15 - 13:00
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Campus Info Desk',
      dayOfWeek: 1,
      startTime: '11:15',
      endTime: '13:00'
    }).expect(201);

    // Task: 90 mins (1.5h), break: 15m
    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Math Drill',
      priority: 'high',
      estimatedHours: 1.5,
      deadline: '2026-11-20T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1, breakMinutes: 15 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    // Gap 09:30 - 11:15 is 105 mins, but task requires 90m + 2*15m = 120m.
    // Displaced to afternoon window 13:30 - 15:00
    assert.equal(res.body.data.plan[0].startTime, '13:30');
    assert.equal(res.body.data.plan[0].endTime, '15:00');
  });

  test('[Tier 3] [T3-10] Work Shift Deletion Dynamic Re-Planning (Unblocking Infeasible Task)', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: false, start: '08:00', end: '11:30' },
      afternoon: { active: true, start: '13:30', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    // Blocking shift
    const shiftRes = await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Temporary Shift',
      workDate: '2026-11-16',
      startTime: '13:30',
      endTime: '16:30'
    }).expect(201);
    const shiftId = shiftRes.body.data.id;

    // Urgent task due at 18:00 today (needs 2.5 hours)
    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Thesis Milestone',
      priority: 'urgent',
      estimatedHours: 2.5,
      deadline: '2026-11-16T11:00:00.000Z' // 18:00 UTC+7
    }).expect(201);
    const taskId = taskRes.body.data.id;

    // Auto-schedule fails because afternoon is blocked by shift
    const res1 = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskId], days: 1 })
      .expect(200);

    assert.equal(res1.body.data.plan.length, 0);
    assert.equal(res1.body.data.unscheduled.length, 1);
    assert.equal(res1.body.data.unscheduled[0].reason, 'NO_AVAILABLE_SLOT');

    // Delete blocking shift
    await request(app)
      .delete(`/api/work-schedules/${shiftId}`)
      .auth(token);

    // Re-plan: now feasible!
    const res2 = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskId], days: 1 })
      .expect(200);

    assert.equal(res2.body.data.plan.length, 1);
    assert.equal(res2.body.data.plan[0].startTime, '13:30');
    assert.equal(res2.body.data.plan[0].endTime, '16:00');
    assert.equal(res2.body.data.unscheduled.length, 0);
  });

  test('[Tier 3] [T3-11] Priority Preemption Under Competing Shift and Class Pressure', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '10:00' }, // exactly 1 slot of 2 hours
      afternoon: { active: false, start: '13:30', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    const taskLow = await request(app).post('/api/tasks').auth(token).send({
      title: 'Low Priority Review',
      priority: 'low',
      estimatedHours: 2.0,
      deadline: '2026-11-16T15:00:00.000Z'
    }).expect(201);

    const taskHigh = await request(app).post('/api/tasks').auth(token).send({
      title: 'High Priority Exam Prep',
      priority: 'high',
      estimatedHours: 2.0,
      deadline: '2026-11-16T15:00:00.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskLow.body.data.id, taskHigh.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].taskId, taskHigh.body.data.id);
    assert.equal(res.body.data.unscheduled.length, 1);
    assert.equal(res.body.data.unscheduled[0].taskId, taskLow.body.data.id);
  });

  test('[Tier 3] [T3-12] Multi-Day Specific-Date Shifts Boundary Non-Leakage', async () => {
    // Shift defined ONLY on Day 1 (2026-11-16) from 08:00 to 16:00
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'One-day Conference Crew',
      workDate: '2026-11-16',
      startTime: '08:00',
      endTime: '16:00'
    }).expect(201);

    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '12:00' },
      afternoon: { active: true, start: '13:30', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    const t1 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Task 1',
      estimatedHours: 2.0
    }).expect(201);

    const t2 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Task 2',
      estimatedHours: 2.0
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [t1.body.data.id, t2.body.data.id], days: 2 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 2);
    // Day 1 has 0 tasks placed
    assert.equal(res.body.data.plan.filter(p => p.date === '2026-11-16').length, 0);
    // Day 2 has both tasks placed starting in morning 08:00
    assert.equal(res.body.data.plan[0].date, '2026-11-17');
    assert.equal(res.body.data.plan[0].startTime, '08:00');
    assert.equal(res.body.data.plan[0].endTime, '10:00');
  });
});
