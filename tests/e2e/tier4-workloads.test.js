/**
 * tests/e2e/tier4-workloads.test.js
 * Tier 4: Real-World Student Workload Scenarios (5 Complex Scenarios: T4-01 to T4-05)
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
const MOCK_THURSDAY_0700_MILLIS = new Date('2026-11-19T00:00:00.000Z').getTime();

describe('Tier 4: Real-World Student Workload Scenarios', () => {
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

  // ===========================================================================
  // Scenario T4-01: Engineering Student Midterm Crunch
  // ===========================================================================
  test('[Tier 4] [T4-01] Scenario 1 — Engineering Student Midterm Crunch (7-Day Multi-Commitment Lifecycle)', async () => {
    // 1. Study preferences
    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '11:30' },
      afternoon: { active: true, start: '13:30', end: '17:00' },
      evening: { active: true, start: '19:00', end: '22:00' }
    };
    pool.state.preferences[0].break_minutes = 15;

    // 2. Commit University Classes
    // Monday & Wednesday Database Systems 08:00 - 10:30
    await request(app).post('/api/classes').auth(token).send({
      title: 'Database Systems',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '10:30'
    }).expect(201);

    await request(app).post('/api/classes').auth(token).send({
      title: 'Database Systems',
      dayOfWeek: 3,
      startTime: '08:00',
      endTime: '10:30'
    }).expect(201);

    // Tuesday & Thursday Computer Networks 13:30 - 16:00
    await request(app).post('/api/classes').auth(token).send({
      title: 'Computer Networks',
      dayOfWeek: 2,
      startTime: '13:30',
      endTime: '16:00'
    }).expect(201);

    await request(app).post('/api/classes').auth(token).send({
      title: 'Computer Networks',
      dayOfWeek: 4,
      startTime: '13:30',
      endTime: '16:00'
    }).expect(201);

    // 3. Commit Work Shifts
    // Tuesday Evening 18:00 - 22:00
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Highlands Barista',
      dayOfWeek: 2,
      startTime: '18:00',
      endTime: '22:00',
      color: '#b45309'
    }).expect(201);

    // Thursday Evening 18:00 - 22:00
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Highlands Barista',
      dayOfWeek: 4,
      startTime: '18:00',
      endTime: '22:00',
      color: '#b45309'
    }).expect(201);

    // Saturday Afternoon/Evening 15:00 - 21:00
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Highlands Barista',
      dayOfWeek: 6,
      startTime: '15:00',
      endTime: '21:00',
      color: '#b45309'
    }).expect(201);

    // 4. Create 5 Midterm Academic Tasks
    const t1 = await request(app).post('/api/tasks').auth(token).send({
      title: 'SE Project Sprint Demo',
      priority: 'urgent',
      estimatedHours: 2.0,
      deadline: '2026-11-18T10:00:00.000Z' // Wed 17:00 UTC+7
    }).expect(201);

    const t2 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Networks Lab Report',
      priority: 'high',
      estimatedHours: 1.5,
      deadline: '2026-11-19T16:59:59.000Z' // Thu 23:59 UTC+7
    }).expect(201);

    const t3 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Database SQL Assignment',
      priority: 'high',
      estimatedHours: 2.0,
      deadline: '2026-11-20T16:59:59.000Z' // Fri 23:59 UTC+7
    }).expect(201);

    const t4 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Algorithm Problem Set',
      priority: 'medium',
      estimatedHours: 1.5,
      deadline: '2026-11-21T05:00:00.000Z' // Sat 12:00 UTC+7
    }).expect(201);

    const t5 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Ethics Essay',
      priority: 'low',
      estimatedHours: 1.0,
      deadline: '2026-11-22T16:59:59.000Z' // Sun 23:59 UTC+7
    }).expect(201);

    const taskIds = [
      t1.body.data.id,
      t2.body.data.id,
      t3.body.data.id,
      t4.body.data.id,
      t5.body.data.id
    ];

    // 5. Execute Auto-Scheduling
    const genRes = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds, days: 7, breakMinutes: 15 })
      .expect(200);

    const plan = genRes.body.data.plan;
    assert.equal(plan.length, 5, 'All 5 tasks should be feasible in 7-day horizon');
    assert.equal(genRes.body.data.unscheduled.length, 0);

    // 6. Assert Conflict-Free Properties
    for (const item of plan) {
      // Check no task scheduled on Tuesday evening (18:00 - 22:00) ± 15m
      if (item.date === '2026-11-17') {
        const inShift = item.startTime < '22:15' && item.endTime > '17:45';
        assert.equal(inShift, false, `Task ${item.taskId} conflicts with Tuesday evening shift`);
      }
      // Check no task scheduled on Thursday evening (18:00 - 22:00) ± 15m
      if (item.date === '2026-11-19') {
        const inShift = item.startTime < '22:15' && item.endTime > '17:45';
        assert.equal(inShift, false, `Task ${item.taskId} conflicts with Thursday evening shift`);
      }
      // Check no task scheduled on Saturday afternoon/evening (15:00 - 21:00) ± 15m
      if (item.date === '2026-11-21') {
        const inShift = item.startTime < '21:15' && item.endTime > '14:45';
        assert.equal(inShift, false, `Task ${item.taskId} conflicts with Saturday shift`);
      }
    }

    // 7. Persist Schedule
    const applyRes = await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({ plan, breakMinutes: 15, timezone: 'Asia/Ho_Chi_Minh' })
      .expect(200);

    assert.equal(applyRes.body.data.events.length, 5);

    // 8. Query and Audit Database State
    const eventsRes = await request(app)
      .get('/api/schedule/events')
      .auth(token)
      .expect(200);

    assert.equal(eventsRes.body.data.length, 5);

    const notifRes = await request(app)
      .get('/api/notifications')
      .auth(token)
      .expect(200);

    assert.equal(notifRes.body.data.length >= 1, true);
    assert.equal(notifRes.body.data[0].type, 'success');
  });

  // ===========================================================================
  // Scenario T4-02: Weekend Retail Shift Worker with Night Shifts
  // ===========================================================================
  test('[Tier 4] [T4-02] Scenario 2 — Weekend Retail Shift Worker with Night Shifts (Asymmetric Compression)', async () => {
    // Shifts on weekend:
    // Friday night 17:00 - 22:00
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Friday Night Retail',
      dayOfWeek: 5,
      startTime: '17:00',
      endTime: '22:00'
    }).expect(201);

    // Saturday full day 10:00 - 18:00
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Saturday Retail',
      dayOfWeek: 6,
      startTime: '10:00',
      endTime: '18:00'
    }).expect(201);

    // Sunday full day 10:00 - 18:00
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Sunday Retail',
      dayOfWeek: 0,
      startTime: '10:00',
      endTime: '18:00'
    }).expect(201);

    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '07:30', end: '11:30' },
      afternoon: { active: true, start: '13:30', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    // 4 tasks of 2.0 hours each, due Sunday night
    const taskIds = [];
    for (let i = 1; i <= 4; i++) {
      const t = await request(app).post('/api/tasks').auth(token).send({
        title: `Weekday Compressed Task ${i}`,
        estimatedHours: 2.0,
        deadline: '2026-11-22T16:59:59.000Z'
      }).expect(201);
      taskIds.push(t.body.data.id);
    }

    const genRes = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds, days: 7, breakMinutes: 15 })
      .expect(200);

    const plan = genRes.body.data.plan;
    assert.equal(plan.length, 4);

    // All 4 tasks must be scheduled on weekdays before Saturday (2026-11-21)
    for (const item of plan) {
      assert.equal(item.date < '2026-11-21', true, `Task ${item.taskId} scheduled on weekend date ${item.date}`);
    }

    // Apply
    await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({ plan, breakMinutes: 15, timezone: 'Asia/Ho_Chi_Minh' })
      .expect(200);
  });

  // ===========================================================================
  // Scenario T4-03: Overloaded Infeasible Semester
  // ===========================================================================
  test('[Tier 4] [T4-03] Scenario 3 — Overloaded Infeasible Semester (Graceful Degradation & Rejection)', async () => {
    // Daily morning lectures 08:00 - 12:00
    await request(app).post('/api/classes').auth(token).send({
      title: 'Daily Lecture',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '12:00'
    }).expect(201);

    await request(app).post('/api/classes').auth(token).send({
      title: 'Daily Lecture',
      dayOfWeek: 2,
      startTime: '08:00',
      endTime: '12:00'
    }).expect(201);

    // Daily afternoon shifts 13:00 - 18:00
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Daily Shift',
      dayOfWeek: 1,
      startTime: '13:00',
      endTime: '18:00'
    }).expect(201);

    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Daily Shift',
      dayOfWeek: 2,
      startTime: '13:00',
      endTime: '18:00'
    }).expect(201);

    // Preferences: evening window 19:00 - 21:30 (exactly 150 mins = 2.5 hrs per day)
    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '12:00' },
      afternoon: { active: true, start: '13:00', end: '18:00' },
      evening: { active: true, start: '19:00', end: '21:30' }
    };

    // Task 1: urgent 2.5h, deadline Day 1 evening
    const t1 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Overloaded Task 1',
      priority: 'urgent',
      estimatedHours: 2.5,
      deadline: '2026-11-16T15:00:00.000Z'
    }).expect(201);

    // Task 2: high 2.5h, deadline Day 2 evening
    const t2 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Overloaded Task 2',
      priority: 'high',
      estimatedHours: 2.5,
      deadline: '2026-11-17T15:00:00.000Z'
    }).expect(201);

    // Task 3: high 2.5h, deadline Day 2 evening
    const t3 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Overloaded Task 3',
      priority: 'high',
      estimatedHours: 2.5,
      deadline: '2026-11-17T15:00:00.000Z'
    }).expect(201);

    // Task 4: medium 3.0h (exceeds 2.5h window)
    const t4 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Overloaded Task 4',
      priority: 'medium',
      estimatedHours: 3.0,
      deadline: '2026-11-17T15:00:00.000Z'
    }).expect(201);

    // Task 5: low 2.0h
    const t5 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Overloaded Task 5',
      priority: 'low',
      estimatedHours: 2.0,
      deadline: '2026-11-17T15:00:00.000Z'
    }).expect(201);

    const taskIds = [t1.body.data.id, t2.body.data.id, t3.body.data.id, t4.body.data.id, t5.body.data.id];

    const genRes = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds, days: 2 })
      .expect(200);

    // Exactly 2 tasks fit the 2 evening windows of 2.5 hrs
    assert.equal(genRes.body.data.plan.length, 2);
    assert.equal(genRes.body.data.plan[0].taskId, t1.body.data.id);
    assert.equal(genRes.body.data.plan[1].taskId, t2.body.data.id);

    // 3 tasks unscheduled with deterministic reasons
    assert.equal(genRes.body.data.unscheduled.length, 3);
    const u4 = genRes.body.data.unscheduled.find(u => u.taskId === t4.body.data.id);
    assert.ok(
      u4.reason === 'DURATION_EXCEEDS_WINDOW' || u4.reason === 'NO_AVAILABLE_SLOT',
      `Expected DURATION_EXCEEDS_WINDOW or NO_AVAILABLE_SLOT but got ${u4.reason}`
    );

    // Feasible sub-plan apply succeeds
    const applyRes = await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({ plan: genRes.body.data.plan, breakMinutes: 15, timezone: 'Asia/Ho_Chi_Minh' })
      .expect(200);

    assert.equal(applyRes.body.data.events.length, 2);
  });

  // ===========================================================================
  // Scenario T4-04: Employer Shift Modification & Cascading Re-Plan
  // ===========================================================================
  test('[Tier 4] [T4-04] Scenario 4 — Employer Shift Modification & Cascading Re-Plan (Operational Dynamic)', async () => {
    // 1. Initial State
    // Initial Wednesday shift 18:00 - 22:00
    const shiftRes = await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Cafe Shift',
      dayOfWeek: 3,
      startTime: '18:00',
      endTime: '22:00'
    }).expect(201);
    const shiftId = shiftRes.body.data.id;

    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '11:30' },
      afternoon: { active: true, start: '13:30', end: '17:00' },
      evening: { active: true, start: '19:00', end: '22:00' }
    };

    const taskA = await request(app).post('/api/tasks').auth(token).send({
      title: 'Displaceable Task A',
      estimatedHours: 2.0,
      deadline: '2026-11-20T23:59:59.000Z'
    }).expect(201);

    // Pre-scheduled Task A on Thursday morning (2026-11-19 08:30 - 10:30)
    pool.state.scheduled_events.push({
      id: 210,
      user_id: 1,
      task_id: 300,
      title: 'Displaceable Task A',
      start_at: new Date('2026-11-19T01:30:00.000Z'), // 08:30 UTC+7
      end_at: new Date('2026-11-19T03:30:00.000Z'),   // 10:30 UTC+7
      source: 'auto',
      color: '#8b5cf6'
    });

    // 2. Employer unexpected change: Move shift to Thursday morning 08:00 - 12:00!
    await request(app)
      .patch(`/api/work-schedules/${shiftId}`)
      .auth(token)
      .send({
        dayOfWeek: 4,
        startTime: '08:00',
        endTime: '12:00',
        notes: 'Rescheduled to Thursday morning'
      })
      .expect(200);

    // 3. Delete outdated scheduled event to allow re-scheduling
    pool.state.scheduled_events = pool.state.scheduled_events.filter(e => e.id !== 210);

    // 4. Dynamic Cascading Re-Plan
    Settings.now = () => MOCK_THURSDAY_0700_MILLIS;

    const rePlanRes = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskA.body.data.id], days: 1 })
      .expect(200);

    assert.equal(rePlanRes.body.data.plan.length, 1);
    // Thursday morning is now blocked by the updated shift!
    // Task A cascades to Thursday afternoon 13:30 - 15:30!
    assert.equal(rePlanRes.body.data.plan[0].startTime, '13:30');
    assert.equal(rePlanRes.body.data.plan[0].endTime, '15:30');

    // 5. Apply new schedule
    const applyRes = await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({ plan: rePlanRes.body.data.plan, breakMinutes: 15, timezone: 'Asia/Ho_Chi_Minh' })
      .expect(200);

    assert.equal(applyRes.body.data.events.length, 1);
  });

  // ===========================================================================
  // Scenario T4-05: Cross-Timezone Student Remote Worker
  // ===========================================================================
  test('[Tier 4] [T4-05] Scenario 5 — Cross-Timezone Student Remote Worker (UTC Shift / Asia Local Classes)', async () => {
    // Remote shift: Friday 23:00 UTC to Saturday 03:00 UTC
    // In Asia/Ho_Chi_Minh (+07:00), this translates to Saturday morning 06:00 to 10:00 local!
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Remote DevOps',
      dayOfWeek: 6,
      startTime: '06:00',
      endTime: '10:00',
      notes: '23:00-03:00 UTC shift'
    }).expect(201);

    // Local University Class: Saturday 10:30 - 12:00
    await request(app).post('/api/classes').auth(token).send({
      title: 'Technical English',
      dayOfWeek: 6,
      startTime: '10:30',
      endTime: '12:00'
    }).expect(201);

    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '12:00' },
      afternoon: { active: true, start: '13:30', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    // Task: DevOps Homework 1.0 hour
    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'DevOps Homework',
      estimatedHours: 1.0,
      deadline: '2026-11-21T16:59:59.000Z'
    }).expect(201);

    // Set Saturday clock (2026-11-21 07:00 UTC+7 is 2026-11-21 00:00 UTC)
    Settings.now = () => new Date('2026-11-21T00:00:00.000Z').getTime();

    const genRes = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1, breakMinutes: 15 })
      .expect(200);

    assert.equal(genRes.body.data.plan.length, 1);
    // Gap between shift (ends 10:00) and class (starts 10:30) is 30 mins, but 60m task needs 90m with breaks.
    // Task cannot fit morning; displaced to Saturday afternoon 13:30 - 14:30!
    assert.equal(genRes.body.data.plan[0].startTime, '13:30');
    assert.equal(genRes.body.data.plan[0].endTime, '14:30');

    // Apply plan and verify UTC conversion
    const applyRes = await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({ plan: genRes.body.data.plan, breakMinutes: 15, timezone: 'Asia/Ho_Chi_Minh' })
      .expect(200);

    const event = applyRes.body.data.events[0];
    // Local Saturday 13:30 in UTC+7 is Saturday 06:30:00.000Z in UTC!
    const eventStartIso = new Date(event.start || event.startAt).toISOString();
    assert.equal(eventStartIso, '2026-11-21T06:30:00.000Z');
  });
});
