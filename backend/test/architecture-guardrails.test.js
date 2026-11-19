const test = require('node:test');
const assert = require('node:assert/strict');
const { DateTime } = require('luxon');

// Repositories
const authRepositoryModule = require('../src/repositories/auth-repository');
const timetableRepositoryModule = require('../src/repositories/timetable-repository');
const taskRepositoryModule = require('../src/repositories/task-repository');
const notificationRepositoryModule = require('../src/repositories/notification-repository');

// Services
const { createAuthService } = require('../src/services/auth-service');
const { createProfileService } = require('../src/services/profile-service');
const { createClassService } = require('../src/services/class-service');
const { createWorkScheduleService } = require('../src/services/work-schedule-service');
const { createScheduleService } = require('../src/services/schedule-service');
const { createTaskService } = require('../src/services/task-service');
const { createNotificationService } = require('../src/services/notification-service');

// Controllers
const { createAuthController } = require('../src/controllers/auth-controller');
const {
  createClassController,
  createWorkScheduleController,
  createScheduleController
} = require('../src/controllers/timetable-controller');
const { createTaskController } = require('../src/controllers/task-controller');
const { createNotificationController } = require('../src/controllers/notification-controller');

// Routes
const { createAuthRouter } = require('../src/routes/auth-routes');
const { createProfileRouter } = require('../src/routes/profile-routes');
const { createClassRouter } = require('../src/routes/class-routes');
const { createWorkScheduleRouter } = require('../src/routes/work-schedule-routes');
const { createScheduleRouter } = require('../src/routes/schedule-routes');
const { createTaskRouter } = require('../src/routes/task-routes');
const { createNotificationRouter } = require('../src/routes/notification-routes');

// Utilities
const {
  DEFAULT_TIMEZONE,
  fromDatabaseUtc,
  toDatabaseUtc,
  toSqlUtcString,
  toIsoUtcString,
  toPresentationIso,
  nowUtc
} = require('../src/utils/timezone');
const { createCacheManager } = require('../src/utils/cache-manager');

// ============================================================================
// TEST 1: Kiến trúc 4 Module (routes -> controllers -> services -> repositories)
// ============================================================================
test('Guardrail 1 — 4 Modules (auth, timetable, tasks, cache-notification) follow routes -> controllers -> services -> repositories architecture', async () => {
  // 1. Verify Repository layer exports
  assert.equal(typeof authRepositoryModule.createAuthRepository, 'function');
  assert.equal(typeof timetableRepositoryModule.listClassesByUser, 'function');
  assert.equal(typeof timetableRepositoryModule.findClassConflicts, 'function');
  assert.equal(typeof timetableRepositoryModule.listWorkSchedulesByUser, 'function');
  assert.equal(typeof timetableRepositoryModule.listScheduledEventsByUser, 'function');
  assert.equal(typeof taskRepositoryModule.createTaskRepository, 'function');
  assert.equal(typeof taskRepositoryModule.findTasksByUserId, 'function');
  assert.equal(typeof taskRepositoryModule.findUpcomingDeadlineTasks, 'function');
  assert.equal(typeof notificationRepositoryModule.createNotificationRepository, 'function');
  assert.equal(typeof notificationRepositoryModule.createReminderNotificationIfNotExists, 'function');

  // 2. Verify Service layer factories
  const dummyPool = {
    async execute() { return [[], []]; },
    async getConnection() {
      return {
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        release() {},
        async execute() { return [[], []]; }
      };
    }
  };

  const authService = createAuthService({
    pool: dummyPool,
    jwtSecret: 'test_secret_key_for_guardrails_123456',
    jwtExpiresIn: '1h'
  });
  const profileService = createProfileService({ pool: dummyPool });
  const classService = createClassService({ pool: dummyPool });
  const workScheduleService = createWorkScheduleService({ pool: dummyPool });
  const scheduleService = createScheduleService({ pool: dummyPool });
  const taskService = createTaskService({ pool: dummyPool });
  const notificationService = createNotificationService({ pool: dummyPool });

  // 3. Verify Controller layer factories & handlers
  const authController = createAuthController({ authService, profileService });
  assert.equal(typeof authController.register, 'function');
  assert.equal(typeof authController.login, 'function');
  assert.equal(typeof authController.getProfile, 'function');
  assert.equal(typeof authController.updateProfile, 'function');

  const classController = createClassController(classService);
  assert.equal(typeof classController.listClasses, 'function');
  assert.equal(typeof classController.createClass, 'function');
  assert.equal(typeof classController.updateClass, 'function');
  assert.equal(typeof classController.deleteClass, 'function');

  const workScheduleController = createWorkScheduleController(workScheduleService);
  assert.equal(typeof workScheduleController.listWorkSchedules, 'function');
  assert.equal(typeof workScheduleController.createWorkSchedule, 'function');
  assert.equal(typeof workScheduleController.updateWorkSchedule, 'function');
  assert.equal(typeof workScheduleController.deleteWorkSchedule, 'function');

  const scheduleController = createScheduleController(scheduleService);
  assert.equal(typeof scheduleController.listEvents, 'function');
  assert.equal(typeof scheduleController.autoGenerate, 'function');
  assert.equal(typeof scheduleController.applyPlan, 'function');

  const taskController = createTaskController(taskService);
  assert.equal(typeof taskController.listTasks, 'function');
  assert.equal(typeof taskController.createTask, 'function');
  assert.equal(typeof taskController.updateTask, 'function');
  assert.equal(typeof taskController.deleteTask, 'function');

  const notificationController = createNotificationController(notificationService);
  assert.equal(typeof notificationController.listNotifications, 'function');
  assert.equal(typeof notificationController.markRead, 'function');
  assert.equal(typeof notificationController.markAllRead, 'function');
  assert.equal(typeof notificationController.scanReminders, 'function');

  // 4. Verify Router layer factories
  const noopAuth = (req, res, next) => next();
  assert.ok(createAuthRouter(authService, authController));
  assert.ok(createProfileRouter(profileService, noopAuth, authController));
  assert.ok(createClassRouter(classService, noopAuth));
  assert.ok(createWorkScheduleRouter(workScheduleService, noopAuth));
  assert.ok(createScheduleRouter(scheduleService, noopAuth));
  assert.ok(createTaskRouter(taskService, noopAuth, taskController));
  assert.ok(createNotificationRouter(notificationService, noopAuth, notificationController));
});

// ============================================================================
// TEST 2: Bảo mật chống IDOR (Isolation theo user_id)
// ============================================================================
test('Guardrail 2 — Anti-IDOR Isolation: User B cannot modify or delete classes, tasks, work schedules, or notifications belonging to User A', async () => {
  const USER_A = '10';
  const USER_B = '99';

  // In-memory state owned by USER_A
  const state = {
    classes: new Map([
      ['101', {
        id: 101,
        user_id: USER_A,
        title: 'Giải tích 1',
        code: 'MI1111',
        room: 'D3-201',
        lecturer: 'TS. Nguyễn Văn A',
        day_of_week: 1,
        start_time: '07:00:00',
        end_time: '09:30:00',
        semester_start: '2026-09-01',
        semester_end: '2026-12-31',
        color: '#2563eb',
        notes: 'Lớp của User A'
      }]
    ]),
    tasks: new Map([
      ['201', {
        id: 201,
        user_id: USER_A,
        title: 'Báo cáo Đồ án User A',
        subject: 'IT4000',
        description: 'Tài liệu mật của User A',
        priority: 'high',
        status: 'todo',
        progress: 0,
        estimated_hours: 3,
        deadline: '2026-11-25 10:00:00.000',
        created_at: '2026-11-01 00:00:00.000',
        updated_at: '2026-11-01 00:00:00.000'
      }]
    ]),
    workSchedules: new Map([
      ['301', {
        id: 301,
        user_id: USER_A,
        title: 'Ca trực Lab của User A',
        workplace: 'Lab B1',
        day_of_week: 3,
        work_date: null,
        start_time: '13:00:00',
        end_time: '17:00:00',
        start_date: null,
        end_date: null,
        color: '#0d7480',
        notes: null,
        created_at: '2026-11-01 00:00:00.000',
        updated_at: '2026-11-01 00:00:00.000'
      }]
    ]),
    notifications: new Map([
      ['401', {
        id: 401,
        user_id: USER_A,
        type: 'urgent',
        title: 'Thông báo riêng của User A',
        message: 'Deadline sắp tới',
        read_at: null,
        created_at: '2026-11-10 08:00:00.000'
      }]
    ])
  };

  async function executeSql(sql, params) {
    // User lock check
    if (sql.includes('SELECT id FROM users WHERE id = ? FOR UPDATE')) {
      return [[{ id: params[0] }], []];
    }

    // Classes check (WHERE id = ? AND user_id = ?)
    if (sql.includes('FROM classes WHERE id = ? AND user_id = ? FOR UPDATE')) {
      const [classId, userId] = params.map(String);
      const cls = state.classes.get(classId);
      if (cls && String(cls.user_id) === userId) return [[cls], []];
      return [[], []];
    }
    if (sql.includes('DELETE FROM classes WHERE id = ? AND user_id = ?')) {
      const [classId, userId] = params.map(String);
      const cls = state.classes.get(classId);
      if (cls && String(cls.user_id) === userId) {
        state.classes.delete(classId);
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }

    // Tasks check (WHERE id = ? AND user_id = ?)
    if (sql.includes('FROM tasks WHERE id = ? AND user_id = ?')) {
      const [taskId, userId] = params.map(String);
      const tsk = state.tasks.get(taskId);
      if (tsk && String(tsk.user_id) === userId) return [[tsk], []];
      return [[], []];
    }
    if (sql.includes('DELETE FROM tasks WHERE id = ? AND user_id = ?')) {
      const [taskId, userId] = params.map(String);
      const tsk = state.tasks.get(taskId);
      if (tsk && String(tsk.user_id) === userId) {
        state.tasks.delete(taskId);
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }

    // Work schedules check (WHERE id = ? AND user_id = ?)
    if (sql.includes('FROM work_schedules') && sql.includes('WHERE id = ? AND user_id = ?')) {
      const [workId, userId] = params.map(String);
      const wrk = state.workSchedules.get(workId);
      if (wrk && String(wrk.user_id) === userId) return [[wrk], []];
      return [[], []];
    }
    if (sql.includes('DELETE FROM work_schedules WHERE id = ? AND user_id = ?')) {
      const [workId, userId] = params.map(String);
      const wrk = state.workSchedules.get(workId);
      if (wrk && String(wrk.user_id) === userId) {
        state.workSchedules.delete(workId);
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }

    // Notifications check (WHERE id = ? AND user_id = ?)
    if (sql.includes('UPDATE notifications SET read_at') && sql.includes('WHERE id = ? AND user_id = ?')) {
      const [ntfId, userId] = params.map(String);
      const ntf = state.notifications.get(ntfId);
      if (ntf && String(ntf.user_id) === userId) {
        ntf.read_at = '2026-11-19 05:00:00.000';
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }
    if (sql.includes('SELECT id FROM notifications WHERE id = ? AND user_id = ?')) {
      const [ntfId, userId] = params.map(String);
      const ntf = state.notifications.get(ntfId);
      if (ntf && String(ntf.user_id) === userId) return [[{ id: ntf.id }], []];
      return [[], []];
    }

    throw new Error(`Unexpected SQL in IDOR test: ${sql}`);
  }

  const mockPool = {
    execute: executeSql,
    async getConnection() {
      return {
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        release() {},
        execute: executeSql
      };
    }
  };

  const classService = createClassService({ pool: mockPool });
  const taskService = createTaskService({ pool: mockPool });
  const workScheduleService = createWorkScheduleService({ pool: mockPool });
  const notificationService = createNotificationService({ pool: mockPool });

  // 1. User B attempts to update/delete User A's class (id: 101 / cls_101)
  await assert.rejects(
    classService.update(USER_B, '101', { title: 'Hacked Class' }),
    err => err.status === 404 && err.code === 'NOT_FOUND'
  );
  await assert.rejects(
    classService.remove(USER_B, '101'),
    err => err.status === 404 && err.code === 'NOT_FOUND'
  );
  assert.equal(state.classes.get('101').title, 'Giải tích 1');

  // 2. User B attempts to update/delete User A's task (id: 201 / tsk_201)
  await assert.rejects(
    taskService.update(USER_B, '201', { title: 'Hacked Task' }),
    err => err.status === 404 && err.code === 'NOT_FOUND'
  );
  await assert.rejects(
    taskService.remove(USER_B, '201'),
    err => err.status === 404 && err.code === 'NOT_FOUND'
  );
  assert.equal(state.tasks.get('201').title, 'Báo cáo Đồ án User A');

  // 3. User B attempts to update/delete User A's work schedule (id: wrk_301)
  await assert.rejects(
    workScheduleService.update(USER_B, 'wrk_301', { title: 'Hacked Shift' }),
    err => err.status === 404 && err.code === 'NOT_FOUND'
  );
  await assert.rejects(
    workScheduleService.remove(USER_B, 'wrk_301'),
    err => err.status === 404 && err.code === 'NOT_FOUND'
  );
  assert.equal(state.workSchedules.get('301').title, 'Ca trực Lab của User A');

  // 4. User B attempts to mark User A's notification as read (id: 401 / ntf_401)
  await assert.rejects(
    notificationService.markRead(USER_B, '401'),
    err => err.status === 404 && err.code === 'NOT_FOUND'
  );
  assert.equal(state.notifications.get('401').read_at, null);
});

// ============================================================================
// TEST 3: Chuẩn hóa Múi giờ (Timezone UTC & Asia/Ho_Chi_Minh +07:00)
// ============================================================================
test('Guardrail 3 — Timezone Standardization: +07:00 near-midnight deadline converts to UTC in DB and serializes back without date drift or Invalid Date', async () => {
  // Near-midnight in Vietnam (+07:00): 2026-11-20T23:30:00+07:00
  const inputLocalIso = '2026-11-20T23:30:00+07:00';

  // 1. SQL UTC format for MySQL DATETIME(3) must be 16:30:00.000 UTC on 2026-11-20
  const sqlUtc = toSqlUtcString(inputLocalIso);
  assert.equal(sqlUtc, '2026-11-20 16:30:00.000');

  // 2. JS Date object for DB parameter binding must have exact UTC epoch millis
  const dbDate = toDatabaseUtc(inputLocalIso);
  assert.ok(dbDate instanceof Date);
  assert.equal(dbDate.toISOString(), '2026-11-20T16:30:00.000Z');

  // 3. Reading from DB (whether MySQL returns SQL string or JS Date) -> ISO UTC string
  assert.equal(toIsoUtcString('2026-11-20 16:30:00.000'), '2026-11-20T16:30:00.000Z');
  assert.equal(toIsoUtcString(dbDate), '2026-11-20T16:30:00.000Z');

  // 4. Presentation in Asia/Ho_Chi_Minh (+07:00) preserves 2026-11-20T23:30:00.000+07:00
  const presentation = toPresentationIso('2026-11-20 16:30:00.000', DEFAULT_TIMEZONE);
  assert.equal(presentation, '2026-11-20T23:30:00.000+07:00');

  // 5. Cross-midnight test: 2026-11-21T00:30:00+07:00 -> 2026-11-20 17:30:00.000 UTC
  const postMidnightLocal = '2026-11-21T00:30:00+07:00';
  assert.equal(toSqlUtcString(postMidnightLocal), '2026-11-20 17:30:00.000');
  assert.equal(
    toPresentationIso('2026-11-20 17:30:00.000', 'Asia/Ho_Chi_Minh'),
    '2026-11-21T00:30:00.000+07:00'
  );

  // 6. Verify taskService end-to-end deadline persistence & serialization
  let capturedInsertParams = null;
  const mockPool = {
    async execute(sql, params) {
      if (sql.includes('INSERT INTO tasks')) {
        capturedInsertParams = params;
        return [{ insertId: 77 }, []];
      }
      if (sql.includes('FROM tasks WHERE id = ? AND user_id = ?')) {
        return [[{
          id: 77,
          user_id: 5,
          title: 'Nộp bài tập lớn trước nửa đêm',
          subject: 'CS101',
          description: null,
          priority: 'urgent',
          status: 'todo',
          progress: 0,
          estimated_hours: 2,
          deadline: '2026-11-20 16:30:00.000',
          created_at: '2026-11-19 05:00:00.000',
          updated_at: '2026-11-19 05:00:00.000'
        }], []];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const taskService = createTaskService({ pool: mockPool });
  const createdTask = await taskService.create('5', {
    title: 'Nộp bài tập lớn trước nửa đêm',
    subject: 'CS101',
    priority: 'urgent',
    deadline: inputLocalIso
  });

  const savedDeadlineDate = capturedInsertParams.find(p => p instanceof Date);
  assert.ok(savedDeadlineDate instanceof Date);
  assert.equal(savedDeadlineDate.toISOString(), '2026-11-20T16:30:00.000Z');
  assert.equal(createdTask.deadline, '2026-11-20T16:30:00.000Z');
  assert.equal(toPresentationIso(createdTask.deadline, 'Asia/Ho_Chi_Minh'), '2026-11-20T23:30:00.000+07:00');
});

// ============================================================================
// TEST 4: Phát hiện xung đột lịch & Auto-Schedule Preview -> Apply
// ============================================================================
test('Guardrail 4 — Conflict Detection (Classes & Work Shifts) and Auto-Schedule Preview (no DB writes) -> Apply (atomic transaction)', async () => {
  // Part A: Class conflict detection by dayOfWeek + semester overlap
  const classConnection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql) {
      if (sql.includes('SELECT id FROM users WHERE id = ? FOR UPDATE')) {
        return [[{ id: '5' }], []];
      }
      if (sql.includes('FROM classes') && sql.includes('WHERE user_id = ? AND day_of_week = ?')) {
        // Simulate DB returning conflicting class in overlapping semester
        return [[{
          id: 12,
          title: 'Cấu trúc dữ liệu & Giải thuật',
          start_time: '08:00:00',
          end_time: '10:30:00'
        }], []];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const classService = createClassService({
    pool: { getConnection: async () => classConnection }
  });

  await assert.rejects(
    classService.create('5', {
      title: 'Môn học trùng giờ',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '11:00',
      semesterStart: '2026-09-01',
      semesterEnd: '2026-12-31'
    }),
    err => err.status === 409 && err.code === 'CONFLICT'
  );

  // Part B: Auto-Schedule Preview (generate) MUST NOT write to DB, and avoids classes + work shifts + breakMinutes
  const tomorrow = DateTime.now().setZone('Asia/Ho_Chi_Minh').plus({ days: 1 }).startOf('day');
  const tomorrowDate = tomorrow.toISODate();
  const tomorrowWeekday = tomorrow.weekday % 7;

  let dbWritesDuringGenerate = 0;
  let dbInsertsDuringApply = 0;
  let applyCommitted = false;

  const schedulePool = {
    async execute(sql) {
      if (/^(INSERT|UPDATE|DELETE)/i.test(sql.trim())) {
        dbWritesDuringGenerate += 1;
      }
      if (sql.includes('FROM study_preferences')) {
        return [[{
          preferred_hours: {
            morning: { start: '07:00', end: '12:00', active: true },
            afternoon: { start: '13:00', end: '17:00', active: false },
            evening: { start: '18:00', end: '22:00', active: false }
          },
          break_minutes: 15,
          timezone: 'Asia/Ho_Chi_Minh'
        }], []];
      }
      if (sql.includes('FROM tasks WHERE user_id')) {
        return [[{
          id: '55',
          title: 'Ôn thi Hệ điều hành',
          subject: 'IT3070',
          priority: 'urgent',
          status: 'todo',
          estimated_hours: 1,
          deadline: tomorrow.plus({ days: 2 }).toJSDate()
        }], []];
      }
      if (sql.includes('SELECT DISTINCT task_id FROM scheduled_events')) {
        return [[], []];
      }
      if (sql.includes('FROM classes WHERE user_id')) {
        // Class occupies 07:00 - 08:30 tomorrow
        return [[{
          id: 1,
          title: 'Lớp Hệ điều hành',
          day_of_week: tomorrowWeekday,
          start_time: '07:00:00',
          end_time: '08:30:00',
          semester_start: null,
          semester_end: null
        }], []];
      }
      if (sql.includes('FROM work_schedules WHERE user_id')) {
        // Work shift occupies 08:45 - 10:00 tomorrow
        return [[{
          id: 2,
          title: 'Ca trực phòng máy',
          workplace: 'Phòng Lab',
          day_of_week: null,
          work_date: tomorrowDate,
          start_time: '08:45:00',
          end_time: '10:00:00',
          start_date: null,
          end_date: null,
          color: '#0d7480',
          notes: null
        }], []];
      }
      if (sql.includes('FROM scheduled_events')) {
        return [[], []];
      }
      throw new Error(`Unexpected SQL in generate: ${sql}`);
    },
    async getConnection() {
      return {
        async beginTransaction() {},
        async commit() { applyCommitted = true; },
        async rollback() {},
        release() {},
        async execute(sql) {
          if (sql.includes('SELECT id FROM users')) return [[{ id: '5' }], []];
          if (sql.includes('FROM study_preferences')) {
            return [[{
              preferred_hours: {
                morning: { start: '07:00', end: '12:00', active: true },
                afternoon: { start: '13:00', end: '17:00', active: false },
                evening: { start: '18:00', end: '22:00', active: false }
              },
              break_minutes: 15,
              timezone: 'Asia/Ho_Chi_Minh'
            }], []];
          }
          if (sql.includes('FROM tasks') && sql.includes('FOR UPDATE')) {
            return [[{
              id: '55',
              title: 'Ôn thi Hệ điều hành',
              subject: 'IT3070',
              status: 'todo',
              deadline: tomorrow.plus({ days: 2 }).toJSDate()
            }], []];
          }
          if (sql.includes('SELECT task_id FROM scheduled_events')) return [[], []];
          if (sql.includes('FROM classes')) {
            return [[{
              id: 1,
              title: 'Lớp Hệ điều hành',
              day_of_week: tomorrowWeekday,
              start_time: '07:00:00',
              end_time: '08:30:00',
              semester_start: null,
              semester_end: null
            }], []];
          }
          if (sql.includes('FROM work_schedules')) {
            return [[{
              id: 2,
              title: 'Ca trực phòng máy',
              workplace: 'Phòng Lab',
              day_of_week: null,
              work_date: tomorrowDate,
              start_time: '08:45:00',
              end_time: '10:00:00',
              start_date: null,
              end_date: null,
              color: '#0d7480',
              notes: null
            }], []];
          }
          if (sql.includes('SELECT id, start_at, end_at FROM scheduled_events')) return [[], []];
          if (sql.includes('INSERT INTO scheduled_events')) {
            dbInsertsDuringApply += 1;
            return [{ insertId: 901 }, []];
          }
          if (sql.includes('INSERT INTO notifications')) {
            return [{ insertId: 1 }, []];
          }
          throw new Error(`Unexpected SQL in apply: ${sql}`);
        }
      };
    }
  };

  const scheduleService = createScheduleService({ pool: schedulePool });

  // 1. Preview only
  const preview = await scheduleService.generate('5', {
    taskIds: ['tsk_55'],
    days: 2,
    breakMinutes: 15
  });

  assert.equal(dbWritesDuringGenerate, 0, 'auto-generate preview must never write to database');
  assert.equal(preview.plan.length, 1);

  const tomorrowSlot = preview.plan.find(p => p.date === tomorrowDate);
  if (tomorrowSlot) {
    // Must start at or after 10:15 (after 08:45-10:00 shift + 15m break)
    assert.ok(
      tomorrowSlot.startTime >= '10:15',
      `Slot on tomorrow (${tomorrowSlot.startTime}) must respect class 07:00-08:30, shift 08:45-10:00, and 15m break`
    );
  }

  // 2. Apply persists in atomic transaction
  const applied = await scheduleService.apply(
    '5',
    [{
      taskId: 'tsk_55',
      date: tomorrowDate,
      startTime: '10:30',
      endTime: '11:30',
      durationMinutes: 60
    }],
    15,
    'Asia/Ho_Chi_Minh'
  );

  assert.equal(applyCommitted, true);
  assert.equal(dbInsertsDuringApply, 1);
  assert.equal(applied.events.length, 1);
  assert.equal(applied.events[0].id, 'sch_901');
  assert.equal(applied.events[0].taskId, 'tsk_55');
});

// ============================================================================
// TEST 5: Redis Cache-Aside, Versioned Cache Invalidation & Deadline Reminders
// ============================================================================
test('Guardrail 5 — Redis Cache-Aside hit/miss/versioned invalidation in taskService and non-duplicate deadline reminders in notificationService', async () => {
  // In-memory mock Redis client supporting get, setEx, incr, del
  const redisStore = new Map();
  const mockRedis = {
    isReady: true,
    async get(key) {
      return redisStore.has(key) ? redisStore.get(key) : null;
    },
    async setEx(key, ttl, value) {
      redisStore.set(key, value);
    },
    async incr(key) {
      const current = Number(redisStore.get(key) || '0');
      const next = current + 1;
      redisStore.set(key, String(next));
      return next;
    },
    async del(key) {
      redisStore.delete(key);
    }
  };

  // Part A: Direct CacheManager verification
  const cacheManager = createCacheManager(mockRedis, { prefix: 'guardrail:test', ttlSeconds: 60 });
  assert.equal(await cacheManager.get('42'), null);
  await cacheManager.set('42', [{ hello: 'world' }]);
  assert.deepEqual(await cacheManager.get('42'), [{ hello: 'world' }]);
  await cacheManager.invalidate('42');
  assert.equal(await cacheManager.get('42'), null);
  assert.equal(await mockRedis.get('guardrail:test:version:42'), '1');

  // Part B: taskService Cache-Aside hit, miss, and invalidation on create/update/remove
  let taskDbSelectCount = 0;
  const tasksDb = new Map([
    ['1', {
      id: 1,
      user_id: 5,
      title: 'Task ban đầu',
      subject: 'SE101',
      description: null,
      priority: 'medium',
      status: 'todo',
      progress: 0,
      estimated_hours: 2,
      deadline: '2026-11-20 10:00:00.000',
      created_at: '2026-11-18 08:00:00.000',
      updated_at: '2026-11-18 08:00:00.000'
    }]
  ]);

  const taskPool = {
    async execute(sql, params) {
      if (sql.includes('FROM tasks WHERE user_id = ? ORDER BY')) {
        taskDbSelectCount += 1;
        return [[...tasksDb.values()], []];
      }
      if (sql.includes('INSERT INTO tasks')) {
        const newId = 2;
        tasksDb.set(String(newId), {
          id: newId,
          user_id: 5,
          title: 'Task mới thêm',
          subject: 'SE102',
          description: null,
          priority: 'high',
          status: 'todo',
          progress: 0,
          estimated_hours: 1.5,
          deadline: '2026-11-21 10:00:00.000',
          created_at: '2026-11-19 08:00:00.000',
          updated_at: '2026-11-19 08:00:00.000'
        });
        return [{ insertId: newId }, []];
      }
      if (sql.includes('DELETE FROM tasks WHERE id = ? AND user_id = ?')) {
        const id = String(params[0]);
        const deleted = tasksDb.delete(id);
        return [{ affectedRows: deleted ? 1 : 0 }, []];
      }
      if (sql.includes('FROM tasks WHERE id = ? AND user_id = ?')) {
        const id = String(params[0]);
        return [tasksDb.has(id) ? [tasksDb.get(id)] : [], []];
      }
      if (sql.includes('UPDATE tasks SET')) {
        const id = String(params[params.length - 2]);
        const existing = tasksDb.get(id);
        if (existing) {
          existing.title = 'Task đã cập nhật';
        }
        return [{ affectedRows: existing ? 1 : 0 }, []];
      }
      throw new Error(`Unexpected SQL in task cache test: ${sql}`);
    }
  };

  const taskService = createTaskService({ pool: taskPool, redisClient: mockRedis });

  // 1. First list() -> Cache Miss -> Queries MySQL (taskDbSelectCount = 1)
  const list1 = await taskService.list('5');
  assert.equal(list1.length, 1);
  assert.equal(taskDbSelectCount, 1);

  // 2. Second list() -> Cache Hit -> Does NOT query MySQL (taskDbSelectCount remains 1)
  const list2 = await taskService.list('5');
  assert.equal(list2.length, 1);
  assert.equal(taskDbSelectCount, 1);

  // 3. create() -> Invalidates cache -> Next list() queries MySQL (taskDbSelectCount = 2)
  await taskService.create('5', { title: 'Task mới thêm', priority: 'high' });
  const list3 = await taskService.list('5');
  assert.equal(list3.length, 2);
  assert.equal(taskDbSelectCount, 2);

  // 4. update() -> Invalidates cache -> Next list() queries MySQL (taskDbSelectCount = 3)
  await taskService.update('5', '2', { title: 'Task đã cập nhật' });
  const list4 = await taskService.list('5');
  assert.equal(list4.find(t => t.id === 'tsk_2').title, 'Task đã cập nhật');
  assert.equal(taskDbSelectCount, 3);

  // 5. remove() -> Invalidates cache -> Next list() queries MySQL (taskDbSelectCount = 4)
  await taskService.remove('5', '2');
  const list5 = await taskService.list('5');
  assert.equal(list5.length, 1);
  assert.equal(taskDbSelectCount, 4);

  // Part C: notificationService.generateDeadlineReminders creates reminder and prevents duplicates
  const upcomingDeadlineUtc = toSqlUtcString(nowUtc().plus({ hours: 6 }));
  const notificationsDb = [];
  const notificationPool = {
    async execute(sql, params) {
      if (sql.includes('FROM tasks') && sql.includes("status IN ('todo', 'inprogress')")) {
        return [[{
          id: 88,
          user_id: 5,
          title: 'Nộp tiểu luận Bảo mật Web',
          subject: 'IT4020',
          priority: 'urgent',
          status: 'todo',
          progress: 50,
          estimated_hours: 2,
          deadline: upcomingDeadlineUtc
        }], []];
      }
      if (sql.includes('FROM notifications') && sql.includes('WHERE user_id = ? AND read_at IS NULL AND title = ? AND message = ?')) {
        const [userId, title, message] = params;
        const found = notificationsDb.find(
          n => String(n.user_id) === String(userId) && n.read_at === null && n.title === title && n.message === message
        );
        return [found ? [found] : [], []];
      }
      if (sql.includes('INSERT INTO notifications')) {
        const [userId, type, title, message, scheduledAt, deliveryStatus] = params;
        const newRow = {
          id: notificationsDb.length + 1,
          user_id: userId,
          type,
          title,
          message,
          read_at: null,
          scheduled_at: scheduledAt,
          delivery_status: deliveryStatus,
          created_at: scheduledAt
        };
        notificationsDb.push(newRow);
        return [{ insertId: newRow.id }, []];
      }
      if (sql.includes('FROM notifications') && sql.includes('WHERE id = ? AND user_id = ?')) {
        const [id, userId] = params;
        const found = notificationsDb.find(n => n.id === id && String(n.user_id) === String(userId));
        return [found ? [found] : [], []];
      }
      throw new Error(`Unexpected SQL in notification reminder test: ${sql}`);
    }
  };

  const notificationService = createNotificationService({
    pool: notificationPool,
    redisClient: mockRedis
  });

  // First scan creates 1 reminder notification
  const firstScan = await notificationService.generateDeadlineReminders('5', { withinHours: 24 });
  assert.equal(firstScan.scannedCount, 1);
  assert.equal(firstScan.createdCount, 1);
  assert.equal(firstScan.notifications.length, 1);
  assert.equal(firstScan.notifications[0].id, 'ntf_1');
  assert.ok(firstScan.notifications[0].title.includes('Nộp tiểu luận Bảo mật Web'));

  // Second scan for the same unread task reminder does NOT create duplicate
  const secondScan = await notificationService.generateDeadlineReminders('5', { withinHours: 24 });
  assert.equal(secondScan.scannedCount, 1);
  assert.equal(secondScan.createdCount, 0);
  assert.equal(secondScan.notifications.length, 0);
  assert.equal(notificationsDb.length, 1);
});
