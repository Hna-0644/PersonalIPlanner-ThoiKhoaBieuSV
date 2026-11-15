/**
 * tests/e2e/tier2-boundaries.test.js
 * Tier 2: Boundary & Corner Cases (36 Tests across 6 Categories)
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
const MOCK_FRIDAY_0700_MILLIS = new Date('2026-11-20T00:00:00.000Z').getTime();

describe('Tier 2: Boundary & Corner Cases', () => {
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
  // Category 1: Zero / Negative Duration & Inverted Time Rejections (6 Tests)
  // ===========================================================================

  test('[Tier 2] [T2-C1-01] Work Schedule Zero Duration Rejection (startTime == endTime)', async () => {
    const res = await request(app)
      .post('/api/work-schedules')
      .auth(token)
      .send({
        title: 'Ca 0 phút',
        dayOfWeek: 1,
        startTime: '10:00',
        endTime: '10:00'
      })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.match(JSON.stringify(res.body.error), /sau giờ bắt đầu/i);
  });

  test('[Tier 2] [T2-C1-02] Work Schedule Inverted Time Rejection (startTime > endTime)', async () => {
    const res = await request(app)
      .post('/api/work-schedules')
      .auth(token)
      .send({
        title: 'Ca ngược giờ',
        dayOfWeek: 3,
        startTime: '16:00',
        endTime: '09:00'
      })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('[Tier 2] [T2-C1-03] Task Negative Estimated Hours Rejection', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .auth(token)
      .send({
        title: 'Task âm giờ',
        estimatedHours: -2.5,
        priority: 'medium'
      })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('[Tier 2] [T2-C1-04] Task Zero Estimated Hours Rejection', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .auth(token)
      .send({
        title: 'Task 0 giờ',
        estimatedHours: 0,
        priority: 'low'
      })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('[Tier 2] [T2-C1-05] Schedule Apply Inverted Plan Slot Rejection', async () => {
    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Inverted Plan Task',
      estimatedHours: 1.0
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({
        plan: [{
          taskId: taskRes.body.data.id,
          date: '2026-11-20',
          startTime: '15:00',
          endTime: '13:00',
          durationMinutes: 60
        }],
        breakMinutes: 15,
        timezone: 'Asia/Ho_Chi_Minh'
      })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('[Tier 2] [T2-C1-06] Schedule Apply Duration Minutes Mismatch Rejection', async () => {
    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Mismatch Plan Task',
      estimatedHours: 1.5
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({
        plan: [{
          taskId: taskRes.body.data.id,
          date: '2026-11-20',
          startTime: '08:00',
          endTime: '10:00',
          durationMinutes: 90 // 08:00 to 10:00 is 120 mins, not 90
        }],
        breakMinutes: 15,
        timezone: 'Asia/Ho_Chi_Minh'
      })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  // ===========================================================================
  // Category 2: Shifts Crossing Midnight & Near-Midnight Boundaries (6 Tests)
  // ===========================================================================

  test('[Tier 2] [T2-C2-01] Midnight Crossing Shift (22:00 to 02:00) Schema Rejection', async () => {
    const res = await request(app)
      .post('/api/work-schedules')
      .auth(token)
      .send({
        title: 'Ca đêm qua ngày',
        dayOfWeek: 5,
        startTime: '22:00',
        endTime: '02:00'
      })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('[Tier 2] [T2-C2-02] End-of-Day Shift Up to Exactly 23:59', async () => {
    const res = await request(app)
      .post('/api/work-schedules')
      .auth(token)
      .send({
        title: 'Ca chốt sổ cuối ngày',
        dayOfWeek: 5,
        startTime: '20:00',
        endTime: '23:59'
      })
      .expect(201);

    assert.equal(res.body.data.startTime, '20:00');
    assert.equal(res.body.data.endTime, '23:59');
  });

  test('[Tier 2] [T2-C2-03] Start-of-Day Shift From Exactly 00:00', async () => {
    const res = await request(app)
      .post('/api/work-schedules')
      .auth(token)
      .send({
        title: 'Ca rạng sáng',
        dayOfWeek: 6,
        startTime: '00:00',
        endTime: '04:00'
      })
      .expect(201);

    assert.equal(res.body.data.startTime, '00:00');
    assert.equal(res.body.data.endTime, '04:00');
  });

  test('[Tier 2] [T2-C2-04] Study Window Touching 23:59 Boundary', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: false, start: '08:00', end: '11:30' },
      afternoon: { active: false, start: '13:30', end: '17:00' },
      evening: { active: true, start: '20:00', end: '23:59' }
    };

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Midnight Prep Task',
      estimatedHours: 2.0,
      deadline: '2026-11-20T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].startTime, '20:00');
    assert.equal(res.body.data.plan[0].endTime, '22:00');
    assert.equal(res.body.data.plan[0].endTime <= '23:59', true);
  });

  test('[Tier 2] [T2-C2-05] Multi-Day Busy Span from Event Crossing Midnight in UTC', async () => {
    pool.state.scheduled_events.push({
      id: 205,
      user_id: 1,
      task_id: 88,
      title: 'Late Night Event',
      start_at: new Date('2026-11-16T13:00:00.000Z'), // 20:00 - 23:00 local
      end_at: new Date('2026-11-16T16:00:00.000Z'),
      source: 'manual',
      color: '#8b5cf6'
    });

    pool.state.preferences[0].preferred_hours = {
      morning: { active: false, start: '08:00', end: '11:30' },
      afternoon: { active: false, start: '13:30', end: '17:00' },
      evening: { active: true, start: '19:00', end: '23:00' }
    };

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Early Evening Study',
      estimatedHours: 1.0,
      deadline: '2026-11-16T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1, breakMinutes: 0 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].startTime, '19:00');
    assert.equal(res.body.data.plan[0].endTime, '20:00');
  });

  test('[Tier 2] [T2-C2-06] Task Candidate Spanning Across Midnight Rejection', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: false, start: '08:00', end: '11:30' },
      afternoon: { active: false, start: '13:30', end: '17:00' },
      evening: { active: true, start: '22:00', end: '23:30' } // 90 min window
    };

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Too Long For Midnight',
      estimatedHours: 2.0 // 120m > 90m
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 0);
    assert.equal(res.body.data.unscheduled[0].reason, 'DURATION_EXCEEDS_WINDOW');
  });

  // ===========================================================================
  // Category 3: Back-to-Back Shifts & Zero vs Positive Break Buffers (6 Tests)
  // ===========================================================================

  test('[Tier 2] [T2-C3-01] Back-to-Back Work Shifts (0 Break) Permitted', async () => {
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Shift 1',
      dayOfWeek: 3,
      startTime: '08:00',
      endTime: '12:00'
    }).expect(201);

    const res = await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Shift 2 (Adjacent)',
      dayOfWeek: 3,
      startTime: '12:00',
      endTime: '16:00'
    }).expect(201);

    assert.equal(res.body.data.startTime, '12:00');
    assert.equal(res.body.data.endTime, '16:00');
  });

  test('[Tier 2] [T2-C3-02] Overlapping Work Shifts on Same Day Rejection', async () => {
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Existing Shift',
      dayOfWeek: 3,
      startTime: '08:00',
      endTime: '12:00'
    }).expect(201);

    const res = await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Overlapping Shift',
      dayOfWeek: 3,
      startTime: '11:30',
      endTime: '14:00'
    }).expect(409);

    assert.equal(res.body.error.code, 'CONFLICT');
  });

  test('[Tier 2] [T2-C3-03] Auto-Schedule with breakMinutes = 0 Schedules Immediately Adjacent to Shift', async () => {
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Morning Shift',
      workDate: '2026-11-16',
      startTime: '08:00',
      endTime: '12:00'
    }).expect(201);

    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '12:00' },
      afternoon: { active: true, start: '12:00', end: '16:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Adjacent Study',
      estimatedHours: 1.0,
      deadline: '2026-11-16T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1, breakMinutes: 0 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].startTime, '12:00');
    assert.equal(res.body.data.plan[0].endTime, '13:00');
  });

  test('[Tier 2] [T2-C3-04] Auto-Schedule with breakMinutes = 60 Enforces Full Hour Buffer', async () => {
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Morning Shift',
      workDate: '2026-11-16',
      startTime: '08:00',
      endTime: '12:00'
    }).expect(201);

    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '12:00' },
      afternoon: { active: true, start: '12:00', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Buffered Study',
      estimatedHours: 1.0,
      deadline: '2026-11-16T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1, breakMinutes: 60 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].startTime >= '13:00', true);
  });

  test('[Tier 2] [T2-C3-05] Gap Smaller Than Duration + 2*Break Rejected', async () => {
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Shift 1',
      workDate: '2026-11-16',
      startTime: '08:00',
      endTime: '11:00'
    }).expect(201);

    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Shift 2',
      workDate: '2026-11-16',
      startTime: '13:00',
      endTime: '17:00'
    }).expect(201);

    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '17:00' },
      afternoon: { active: false, start: '13:30', end: '17:00' },
      evening: { active: true, start: '19:00', end: '22:00' }
    };

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Tight Gap Task',
      estimatedHours: 1.5,
      deadline: '2026-11-16T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1, breakMinutes: 20 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].startTime >= '19:00', true);
  });

  test('[Tier 2] [T2-C3-06] Task Exactly Fits in Gap With Matching Break Buffers', async () => {
    // Shift A ends 10:30 + 15m buffer = 10:45.
    // 30m step evaluates 11:00.
    // Task 2.0h (120m) starts 11:00, ends 13:00.
    // Task + 15m buffer = 13:15 <= Shift B starts 13:30!
    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Shift A',
      workDate: '2026-11-16',
      startTime: '08:00',
      endTime: '10:30'
    }).expect(201);

    await request(app).post('/api/work-schedules').auth(token).send({
      title: 'Shift B',
      workDate: '2026-11-16',
      startTime: '13:30',
      endTime: '17:00'
    }).expect(201);

    pool.state.preferences[0].preferred_hours = {
      morning: { active: true, start: '08:00', end: '17:00' },
      afternoon: { active: false, start: '13:30', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Exact Fit Gap Task',
      estimatedHours: 2.0,
      deadline: '2026-11-16T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1, breakMinutes: 15 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].startTime, '11:00');
    assert.equal(res.body.data.plan[0].endTime, '13:00');
  });

  // ===========================================================================
  // Category 4: Edge of Study Window & Deadline Exact Boundaries (6 Tests)
  // ===========================================================================

  test('[Tier 2] [T2-C4-01] Exact Fit of Task in Study Window', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: false, start: '08:00', end: '11:30' },
      afternoon: { active: true, start: '14:00', end: '16:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Exact Fit Window Task',
      estimatedHours: 2.0,
      deadline: '2026-11-16T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].startTime, '14:00');
    assert.equal(res.body.data.plan[0].endTime, '16:00');
  });

  test('[Tier 2] [T2-C4-02] Task Finishing Exactly at Deadline Accepted', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: false, start: '08:00', end: '11:30' },
      afternoon: { active: true, start: '13:30', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Dead-on Deadline Task',
      estimatedHours: 2.0,
      deadline: '2026-11-16T10:00:00.000Z' // 17:00:00 UTC+7
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].endTime <= '17:00', true);
  });

  test('[Tier 2] [T2-C4-03] Task Candidate Finishing 1 Minute Past Deadline Rejected', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: false, start: '08:00', end: '11:30' },
      afternoon: { active: true, start: '15:00', end: '17:30' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Miss Deadline by 1 Min Task',
      estimatedHours: 2.0,
      deadline: '2026-11-16T09:59:00.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 0);
    assert.equal(res.body.data.unscheduled[0].reason, 'DEADLINE_INFEASIBLE');
  });

  test('[Tier 2] [T2-C4-04] Horizon Final Boundary (Day = days - 1)', async () => {
    for (let i = 0; i < 6; i++) {
      const dateStr = `2026-11-${String(16 + i).padStart(2, '0')}`;
      await request(app).post('/api/work-schedules').auth(token).send({
        title: `Block Day ${i}`,
        workDate: dateStr,
        startTime: '08:00',
        endTime: '22:00'
      }).expect(201);
    }

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: '7th Day Task',
      estimatedHours: 1.5,
      deadline: '2026-11-25T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 7 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].date, '2026-11-22');
  });

  test('[Tier 2] [T2-C4-05] Day 0 Real-Time Offset Clamping (now + 15m)', async () => {
    // Clock at 09:10 on Day 0 (Monday 2026-11-16 09:10:00 UTC+7 is 02:10:00 UTC)
    Settings.now = () => new Date('2026-11-16T02:10:00.000Z').getTime();

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Clamped Day 0 Task',
      estimatedHours: 1.0,
      deadline: '2026-11-16T23:59:59.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    // 09:10 + 15m = 09:25 -> slot start is >= 09:25
    assert.equal(res.body.data.plan[0].startTime >= '09:25', true);
  });

  test('[Tier 2] [T2-C4-06] Schedule Apply in the Past Rejection', async () => {
    Settings.now = () => MOCK_FRIDAY_0700_MILLIS;

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Past Apply Task',
      estimatedHours: 1.0
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/apply')
      .auth(token)
      .send({
        plan: [{
          taskId: taskRes.body.data.id,
          date: '2026-11-16',
          startTime: '08:30',
          endTime: '09:30',
          durationMinutes: 60
        }],
        breakMinutes: 15,
        timezone: 'Asia/Ho_Chi_Minh'
      })
      .expect(409);

    assert.equal(res.body.error.code, 'CONFLICT');
    assert.match(res.body.error.message, /quá khứ/i);
  });

  // ===========================================================================
  // Category 5: Infeasible Schedules & Deterministic Unscheduled Reason Codes (6 Tests)
  // ===========================================================================

  test('[Tier 2] [T2-C5-01] DEADLINE_PASSED Unscheduled Classification', async () => {
    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Expired Task',
      estimatedHours: 1.0,
      deadline: '2026-11-01T00:00:00.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 7 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 0);
    assert.equal(res.body.data.unscheduled[0].reason, 'DEADLINE_PASSED');
  });

  test('[Tier 2] [T2-C5-02] NO_ACTIVE_STUDY_WINDOW Unscheduled Classification', async () => {
    pool.state.preferences[0].preferred_hours = {
      morning: { active: false, start: '08:00', end: '11:30' },
      afternoon: { active: false, start: '13:30', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'No Window Task',
      estimatedHours: 1.0
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 7 })
      .expect(200);

    assert.equal(res.body.data.unscheduled[0].reason, 'NO_ACTIVE_STUDY_WINDOW');
  });

  test('[Tier 2] [T2-C5-03] DURATION_EXCEEDS_WINDOW Unscheduled Classification', async () => {
    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Gigantic Task',
      estimatedHours: 4.0
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 7 })
      .expect(200);

    assert.equal(res.body.data.unscheduled[0].reason, 'DURATION_EXCEEDS_WINDOW');
  });

  test('[Tier 2] [T2-C5-04] DEADLINE_INFEASIBLE Unscheduled Classification', async () => {
    // Morning window: 08:00 - 11:30.
    // Task: 60 mins. Deadline is 08:30 (future, but task cannot complete before 08:30 since it needs 60 mins!).
    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'Infeasible Deadline Task',
      estimatedHours: 1.0,
      deadline: '2026-11-16T01:30:00.000Z' // 08:30 UTC+7
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 0);
    assert.equal(res.body.data.unscheduled[0].reason, 'DEADLINE_INFEASIBLE');
  });

  test('[Tier 2] [T2-C5-05] NO_AVAILABLE_SLOT Unscheduled Classification', async () => {
    for (let i = 0; i < 7; i++) {
      const dateStr = `2026-11-${String(16 + i).padStart(2, '0')}`;
      await request(app).post('/api/work-schedules').auth(token).send({
        title: `Full Block ${i}`,
        workDate: dateStr,
        startTime: '08:00',
        endTime: '22:00'
      }).expect(201);
    }

    const taskRes = await request(app).post('/api/tasks').auth(token).send({
      title: 'No Slot Anywhere',
      estimatedHours: 1.0
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [taskRes.body.data.id], days: 7 })
      .expect(200);

    assert.equal(res.body.data.unscheduled[0].reason, 'NO_AVAILABLE_SLOT');
  });

  test('[Tier 2] [T2-C5-06] Mixed Feasibility Batch Output', async () => {
    const t1 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Feasible Task',
      estimatedHours: 1.0
    }).expect(201);

    const t2 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Excessive Duration Task',
      estimatedHours: 5.0
    }).expect(201);

    const t3 = await request(app).post('/api/tasks').auth(token).send({
      title: 'Expired Deadline Task',
      estimatedHours: 1.0,
      deadline: '2026-10-01T00:00:00.000Z'
    }).expect(201);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [t1.body.data.id, t2.body.data.id, t3.body.data.id], days: 1 })
      .expect(200);

    assert.equal(res.body.data.plan.length, 1);
    assert.equal(res.body.data.plan[0].taskId, t1.body.data.id);
    assert.equal(res.body.data.unscheduled.length, 2);

    const r2 = res.body.data.unscheduled.find(u => u.taskId === t2.body.data.id);
    const r3 = res.body.data.unscheduled.find(u => u.taskId === t3.body.data.id);
    assert.equal(r2.reason, 'DURATION_EXCEEDS_WINDOW');
    assert.equal(r3.reason, 'DEADLINE_PASSED');
  });

  // ===========================================================================
  // Category 6: Input Boundaries, Batch Sizes & Malformed Strings (6 Tests)
  // ===========================================================================

  test('[Tier 2] [T2-C6-01] Empty taskIds Array Rejection', async () => {
    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: [], days: 7 })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('[Tier 2] [T2-C6-02] Duplicate taskIds in Request Rejection', async () => {
    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds: ['tsk_1', 'tsk_1'], days: 7 })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.match(JSON.stringify(res.body.error), /trùng lặp/i);
  });

  test('[Tier 2] [T2-C6-03] Maximum Allowed Task Batch (100 taskIds)', async () => {
    const taskIds = Array.from({ length: 100 }, (_, i) => `tsk_${i + 1}`);

    taskIds.forEach((tid, i) => {
      pool.state.tasks.push({
        id: i + 1,
        user_id: 1,
        title: `Batch Task ${i + 1}`,
        estimated_hours: 1,
        priority: 'medium',
        status: 'todo',
        progress: 0
      });
    });

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds, days: 7 })
      .expect(200);

    assert.equal(Array.isArray(res.body.data.plan), true);
  });

  test('[Tier 2] [T2-C6-04] Exceeding Maximum Task Batch (101 taskIds) Rejection', async () => {
    const taskIds = Array.from({ length: 101 }, (_, i) => `tsk_${i + 1}`);

    const res = await request(app)
      .post('/api/schedule/auto-generate')
      .auth(token)
      .send({ taskIds, days: 7 })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('[Tier 2] [T2-C6-05] Malformed Time Strings Rejection in Work Schedule', async () => {
    const vectors = ['24:00', '09:60', '9:00', 'morning'];

    for (const badTime of vectors) {
      const res = await request(app)
        .post('/api/work-schedules')
        .auth(token)
        .send({
          title: 'Bad Time Shift',
          dayOfWeek: 1,
          startTime: badTime,
          endTime: '12:00'
        })
        .expect(400);

      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
  });

  test('[Tier 2] [T2-C6-06] Malformed Horizon Days Parameter Rejection', async () => {
    for (const badDays of [0, 31, -1]) {
      const res = await request(app)
        .post('/api/schedule/auto-generate')
        .auth(token)
        .send({ taskIds: ['tsk_1'], days: badDays })
        .expect(400);

      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
  });
});
