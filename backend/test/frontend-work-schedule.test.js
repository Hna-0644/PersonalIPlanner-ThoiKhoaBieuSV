const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const apiSource = fs.readFileSync(
  path.join(__dirname, '../../frontend/js/api.js'),
  'utf8'
);

const storeSource = fs.readFileSync(
  path.join(__dirname, '../../frontend/js/store.js'),
  'utf8'
);

class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

function createMockJwt(userId = 'usr_test_123') {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64');
  return `${header}.${payload}.mock_sig`;
}

function setupFrontendEnvironment({ token = null, fetchHandler = null } = {}) {
  const localStorage = new MockLocalStorage();
  if (token) {
    localStorage.setItem('pp_jwt_token', token);
  }

  const authService = {
    getToken: () => localStorage.getItem('pp_jwt_token') || '',
    isAuthenticated: () => Boolean(localStorage.getItem('pp_jwt_token')),
    redirectToLogin: () => {}
  };

  const uiStates = {
    showApiError() {},
    loading() {},
    empty() {},
    error() {}
  };

  const contextWindow = {
    location: { port: '5500', origin: 'http://127.0.0.1:5500' },
    AuthService: authService,
    UIStates: uiStates,
    document: {
      dispatchEvent: () => {}
    },
    dispatchEvent: () => {},
    CustomEvent: function(type, detail) {
      return { type, detail };
    }
  };

  const fetchFn = fetchHandler || (async () => ({
    ok: true,
    status: 200,
    async json() {
      return { data: [] };
    }
  }));

  const sandbox = {
    window: contextWindow,
    document: contextWindow.document,
    CustomEvent: contextWindow.CustomEvent,
    AuthService: authService,
    UIStates: uiStates,
    localStorage,
    sessionStorage: localStorage,
    fetch: fetchFn,
    atob: (str) => Buffer.from(str, 'base64').toString('utf8'),
    btoa: (str) => Buffer.from(str, 'utf8').toString('base64'),
    console,
    JSON,
    String,
    Number,
    Boolean,
    Date,
    Math,
    Error,
    TypeError,
    parseInt,
    parseFloat,
    isNaN,
    setTimeout,
    clearTimeout,
    Promise,
    Array,
    Map,
    Set
  };

  const context = vm.createContext(sandbox);

  // Load api.js first
  vm.runInContext(apiSource, context);
  contextWindow.ApiService = sandbox.window.ApiService;

  // Load store.js second
  vm.runInContext(storeSource, context);
  contextWindow.AppStore = sandbox.window.AppStore;

  return {
    api: sandbox.window.ApiService,
    store: sandbox.window.AppStore,
    localStorage,
    sandbox
  };
}

// ==========================================
// 1. ApiService Work Schedule Methods Tests
// ==========================================

test('ApiService.getWorkSchedules calls GET /api/work-schedules with Bearer token and unwraps data', async () => {
  let capturedUrl;
  let capturedOptions;
  const mockShifts = [
    { id: 'wrk_1', title: 'Ca tối T2', dayOfWeek: 1, startTime: '18:00', endTime: '22:00' }
  ];

  const fixedToken = createMockJwt('usr_101');
  const { api } = setupFrontendEnvironment({
    token: fixedToken,
    async fetchHandler(url, options) {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        async json() {
          return { data: mockShifts };
        }
      };
    }
  });

  const res = await api.getWorkSchedules();

  assert.equal(capturedUrl, 'http://localhost:5000/api/work-schedules');
  assert.equal(capturedOptions.headers['Authorization'], `Bearer ${fixedToken}`);
  assert.deepEqual(res, mockShifts);
});

test('ApiService.createWorkSchedule calls POST /api/work-schedules with payload and returns created shift', async () => {
  let capturedUrl;
  let capturedOptions;
  const newShiftData = {
    title: 'Phục vụ The Coffee House',
    workplace: 'Q.1',
    dayOfWeek: 2,
    startTime: '18:00',
    endTime: '22:00',
    color: '#b45309'
  };

  const { api } = setupFrontendEnvironment({
    token: createMockJwt('usr_101'),
    async fetchHandler(url, options) {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 201,
        async json() {
          return { data: { id: 'wrk_2', ...newShiftData } };
        }
      };
    }
  });

  const res = await api.createWorkSchedule(newShiftData);

  assert.equal(capturedUrl, 'http://localhost:5000/api/work-schedules');
  assert.equal(capturedOptions.method, 'POST');
  assert.deepEqual(JSON.parse(capturedOptions.body), newShiftData);
  assert.equal(res.id, 'wrk_2');
  assert.equal(res.title, newShiftData.title);
});

test('ApiService.updateWorkSchedule calls PATCH /api/work-schedules/:id with partial payload', async () => {
  let capturedUrl;
  let capturedOptions;
  const patchData = { startTime: '19:00', endTime: '23:00' };

  const { api } = setupFrontendEnvironment({
    token: createMockJwt('usr_101'),
    async fetchHandler(url, options) {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        async json() {
          return { data: { id: 'wrk_2', title: 'Phục vụ', ...patchData } };
        }
      };
    }
  });

  const res = await api.updateWorkSchedule('wrk_2', patchData);

  assert.equal(capturedUrl, 'http://localhost:5000/api/work-schedules/wrk_2');
  assert.equal(capturedOptions.method, 'PATCH');
  assert.deepEqual(JSON.parse(capturedOptions.body), patchData);
  assert.equal(res.startTime, '19:00');
});

test('ApiService.deleteWorkSchedule calls DELETE /api/work-schedules/:id', async () => {
  let capturedUrl;
  let capturedOptions;

  const { api } = setupFrontendEnvironment({
    token: createMockJwt('usr_101'),
    async fetchHandler(url, options) {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        async json() {
          return { data: { success: true } };
        }
      };
    }
  });

  const res = await api.deleteWorkSchedule('wrk_2');

  assert.equal(capturedUrl, 'http://localhost:5000/api/work-schedules/wrk_2');
  assert.equal(capturedOptions.method, 'DELETE');
  assert.deepEqual(res, { success: true });
});

// ==========================================
// 2. AppStore Scoped Storage & CRUD Tests
// ==========================================

test('AppStore uses scoped key pp_u_${scope}_work_schedules and performs CRUD in localStorage', () => {
  const userId = 'usr_scope_test_42';
  const { store, localStorage } = setupFrontendEnvironment({
    token: createMockJwt(userId)
  });

  const scopedKey = `pp_u_${userId}_work_schedules`;

  // 1. Initial should be empty
  assert.equal(store.getWorkSchedules().length, 0);

  // 2. Add shift
  const result = store.addWorkSchedule({
    title: 'Trực Lab tin học',
    workplace: 'Phòng A3-201',
    dayOfWeek: 4,
    startTime: '13:00',
    endTime: '17:00',
    color: '#b45309',
    notes: 'Hỗ trợ sinh viên thực hành'
  });

  assert.ok(result.shift);
  assert.ok(result.shift.id.startsWith('wrk_'));
  assert.equal(result.shift.title, 'Trực Lab tin học');
  assert.equal(result.conflict.hasConflict, false);

  // Check scoped storage in localStorage directly
  const rawStorage = localStorage.getItem(scopedKey);
  assert.ok(rawStorage, 'Data should be saved under scoped key');
  const parsed = JSON.parse(rawStorage);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, 'Trực Lab tin học');

  // 3. Get by id
  const fetched = store.getWorkScheduleById(result.shift.id);
  assert.equal(fetched.id, result.shift.id);

  // 4. Update shift
  const updateRes = store.updateWorkSchedule(result.shift.id, {
    startTime: '14:00',
    notes: 'Đổi giờ từ 14:00'
  });
  assert.equal(updateRes.shift.startTime, '14:00');
  assert.equal(updateRes.shift.notes, 'Đổi giờ từ 14:00');

  const afterUpdate = store.getWorkScheduleById(result.shift.id);
  assert.equal(afterUpdate.startTime, '14:00');

  // 5. Delete shift
  const delResult = store.deleteWorkSchedule(result.shift.id);
  assert.equal(delResult, true);
  assert.equal(store.getWorkSchedules().length, 0);
  assert.deepEqual(JSON.parse(localStorage.getItem(scopedKey)), []);
});

// ==========================================
// 3. Work Shift Conflict Detection Tests
// ==========================================

test('AppStore.checkWorkShiftConflict detects overlap between recurring work shifts', () => {
  const { store } = setupFrontendEnvironment({
    token: createMockJwt('usr_conflict_test')
  });

  // Add shift: Tuesday 18:00 - 22:00
  store.addWorkSchedule({
    title: 'Phục vụ quán',
    dayOfWeek: 2,
    startTime: '18:00',
    endTime: '22:00'
  });

  // Conflict: Tuesday 19:00 - 21:00 (inside)
  const conflict1 = store.checkWorkShiftConflict({
    dayOfWeek: 2,
    startTime: '19:00',
    endTime: '21:00'
  });
  assert.equal(conflict1.hasConflict, true);
  assert.equal(conflict1.conflictingEvent.title, 'Phục vụ quán');
  assert.equal(conflict1.conflictType, 'shift');

  // Conflict: Tuesday 17:00 - 19:00 (crosses start)
  const conflict2 = store.checkWorkShiftConflict({
    dayOfWeek: 2,
    startTime: '17:00',
    endTime: '19:00'
  });
  assert.equal(conflict2.hasConflict, true);

  // No conflict: Tuesday 14:00 - 18:00 (touching boundary)
  const noConflictTime = store.checkWorkShiftConflict({
    dayOfWeek: 2,
    startTime: '14:00',
    endTime: '18:00'
  });
  assert.equal(noConflictTime.hasConflict, false);

  // No conflict: Wednesday same time
  const noConflictDay = store.checkWorkShiftConflict({
    dayOfWeek: 3,
    startTime: '18:00',
    endTime: '22:00'
  });
  assert.equal(noConflictDay.hasConflict, false);
});

test('AppStore.checkWorkShiftConflict detects overlap between work shift and university class', () => {
  const { store } = setupFrontendEnvironment({
    token: createMockJwt('usr_class_conflict')
  });

  // Add a university class: Thursday (dayOfWeek: 4) 07:30 - 10:00
  store.addClass({
    title: 'Kiến trúc phần mềm',
    code: 'IT3020',
    dayOfWeek: 4,
    startTime: '07:30',
    endTime: '10:00'
  });

  // Work shift on Thursday 08:00 - 12:00 -> should conflict with class
  const conflict = store.checkWorkShiftConflict({
    title: 'Ca sáng trực thư viện',
    dayOfWeek: 4,
    startTime: '08:00',
    endTime: '12:00'
  });

  assert.equal(conflict.hasConflict, true);
  assert.equal(conflict.conflictType, 'class');
  assert.equal(conflict.conflictingEvent.title, 'Kiến trúc phần mềm');

  // Work shift on Thursday 13:00 - 17:00 -> no conflict
  const noConflict = store.checkWorkShiftConflict({
    title: 'Ca chiều trực thư viện',
    dayOfWeek: 4,
    startTime: '13:00',
    endTime: '17:00'
  });
  assert.equal(noConflict.hasConflict, false);
});

test('AppStore.checkWorkShiftConflict detects overlap between specific date shift and recurring class', () => {
  const { store } = setupFrontendEnvironment({
    token: createMockJwt('usr_date_conflict')
  });

  // Class on Friday (dayOfWeek: 5) 13:00 - 16:00
  store.addClass({
    title: 'Lập trình Web',
    dayOfWeek: 5,
    startTime: '13:00',
    endTime: '16:00'
  });

  // 2026-11-20 is a Friday (dayOfWeek = 5)
  const d = new Date('2026-11-20T00:00:00');
  assert.equal(d.getDay(), 5);

  const conflict = store.checkWorkShiftConflict({
    title: 'Sự kiện đột xuất',
    workDate: '2026-11-20',
    startTime: '14:00',
    endTime: '18:00'
  });

  assert.equal(conflict.hasConflict, true);
  assert.equal(conflict.conflictType, 'class');
});

// ==========================================
// 4. Server Sync Integration Tests
// ==========================================

test('AppStore.syncFromServer fetches work schedules from ApiService and persists to scoped storage', async () => {
  const userId = 'usr_sync_test';
  const serverShifts = [
    {
      id: 'wrk_10',
      title: 'Trợ giảng Tin học',
      workplace: 'Phòng máy C',
      dayOfWeek: 3,
      workDate: null,
      startTime: '08:00',
      endTime: '11:30',
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      color: '#b45309',
      notes: 'Hỗ trợ thực hành'
    }
  ];

  const { store, localStorage } = setupFrontendEnvironment({
    token: createMockJwt(userId),
    async fetchHandler(url) {
      if (url.includes('/user/profile')) {
        return { ok: true, status: 200, async json() { return { data: { id: userId, fullName: 'Sinh viên A' } }; } };
      }
      if (url.includes('/work-schedules')) {
        return { ok: true, status: 200, async json() { return { data: serverShifts }; } };
      }
      return { ok: true, status: 200, async json() { return { data: [] }; } };
    }
  });

  const syncResult = await store.syncFromServer();
  assert.equal(syncResult, true);

  const loadedShifts = store.getWorkSchedules();
  assert.equal(loadedShifts.length, 1);
  assert.equal(loadedShifts[0].id, 'wrk_10');
  assert.equal(loadedShifts[0].title, 'Trợ giảng Tin học');
  assert.equal(loadedShifts[0].dayOfWeek, 3);
  assert.equal(loadedShifts[0].startTime, '08:00');
});

// ==========================================
// 5. Offline Auto-Scheduler Shift Avoidance Tests
// ==========================================

test('AppStore.generateAutoSchedule treats work shifts as busy intervals and avoids them', () => {
  const { store } = setupFrontendEnvironment({
    token: createMockJwt('usr_auto_sched_test')
  });

  // Configure user study hours: evening 18:00 - 22:00
  store.updateUser({
    preferredHours: {
      morning: { active: false, start: '07:00', end: '11:30' },
      afternoon: { active: false, start: '13:00', end: '17:00' },
      evening: { active: true, start: '18:00', end: '22:00' }
    }
  });

  // Task that needs 2 hours (120 minutes)
  store.addTask({
    id: 'tsk_proj',
    title: 'Làm Đồ Án Chuyên Ngành',
    estimatedHours: 2.0,
    priority: 'high',
    deadline: '2099-12-31T23:59:59'
  });

  // Determine tomorrow's day of week
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDayOfWeek = tomorrow.getDay();
  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  const tomorrowDateStr = `${yyyy}-${mm}-${dd}`;

  // Add a work shift tomorrow evening: 18:00 - 21:00
  store.addWorkSchedule({
    title: 'Ca làm thêm tối',
    workDate: tomorrowDateStr,
    startTime: '18:00',
    endTime: '21:00'
  });

  const result = store.generateAutoSchedule({ days: 7, breakMinutes: 15 });

  // Result can be accessed directly or via result.plan
  const plan = result.plan || result;
  assert.ok(plan.length > 0, 'Should find an available slot on another day or non-shift time');

  // Verify that NO proposed slot on tomorrowDateStr overlaps with 18:00 - 21:00 ± 15m
  const tomorrowProposed = plan.filter(p => p.date === tomorrowDateStr);
  for (const slot of tomorrowProposed) {
    const slotStartMin = parseInt(slot.startTime.split(':')[0]) * 60 + parseInt(slot.startTime.split(':')[1]);
    const slotEndMin = parseInt(slot.endTime.split(':')[0]) * 60 + parseInt(slot.endTime.split(':')[1]);
    const shiftStartMin = 18 * 60; // 1080
    const shiftEndMin = 21 * 60;   // 1260

    // Must not overlap shift with break buffer
    const overlap = slotStartMin < shiftEndMin + 15 && slotEndMin > shiftStartMin - 15;
    assert.equal(overlap, false, `Proposed slot ${slot.startTime}-${slot.endTime} must not overlap shift 18:00-21:00`);
  }
});

test('AppStore.generateAutoSchedule reports unscheduled tasks with reason when infeasible', () => {
  const { store } = setupFrontendEnvironment({
    token: createMockJwt('usr_infeasible_test')
  });

  // Only morning active: 08:00 - 10:00 (duration = 2 hours)
  store.updateUser({
    preferredHours: {
      morning: { active: true, start: '08:00', end: '10:00' },
      afternoon: { active: false, start: '13:00', end: '17:00' },
      evening: { active: false, start: '18:00', end: '22:00' }
    }
  });

  // Task that requires 3 hours (exceeds window of 2 hours)
  const taskRes = store.addTask({
    title: 'Đọc tài liệu nghiên cứu 300 trang',
    estimatedHours: 3.0,
    priority: 'medium',
    deadline: '2099-12-31T23:59:59'
  });
  const addedTaskId = taskRes.task ? taskRes.task.id : taskRes.id;

  const result = store.generateAutoSchedule({ days: 3, breakMinutes: 15 });

  assert.ok(result.unscheduled);
  assert.equal(result.unscheduled.length, 1);
  assert.equal(result.unscheduled[0].taskId, addedTaskId);
  assert.equal(result.unscheduled[0].reason, 'DURATION_EXCEEDS_WINDOW');
});
