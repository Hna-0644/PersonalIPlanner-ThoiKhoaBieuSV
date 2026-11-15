/**
 * tests/e2e/harness.js
 * In-Memory E2E Test Harness for PersonalIPlanner
 * Bypasses TCP network sockets to avoid Windows Sandbox connect EACCES (errno -4092)
 */

const http = require('node:http');
const { Socket } = require('node:net');
const path = require('node:path');
const assert = require('node:assert/strict');

// Ensure modules inside backend/node_modules are resolvable
module.paths.push(path.resolve(__dirname, '../../backend/node_modules'));

const jwt = require('jsonwebtoken');
const { DateTime } = require('luxon');

// Safe polyfill for DateTime.fromJSDate when passed a Luxon DateTime
const originalFromJSDate = DateTime.fromJSDate;
DateTime.fromJSDate = function(date, options) {
  if (date && typeof date.toJSDate === 'function') {
    return originalFromJSDate.call(DateTime, date.toJSDate(), options);
  }
  return originalFromJSDate.call(DateTime, date, options);
};

const DEFAULT_JWT_SECRET = 'test-e2e-jwt-secret-at-least-thirty-two-chars-long';

// -----------------------------------------------------------------------------
// 1. Fluent In-Memory Request Dispatcher
// -----------------------------------------------------------------------------
class TestRequest {
  constructor(app, method, url) {
    this.app = app;
    this.method = method.toUpperCase();
    this.url = url;
    this.headers = { host: 'localhost' };
    this.bodyData = null;
    this._expectedStatus = null;
  }

  set(field, value) {
    if (typeof field === 'object' && field !== null) {
      for (const [k, v] of Object.entries(field)) {
        this.headers[k.toLowerCase()] = v;
      }
    } else {
      this.headers[String(field).toLowerCase()] = value;
    }
    return this;
  }

  auth(token) {
    this.headers['authorization'] = `Bearer ${token}`;
    return this;
  }

  send(data) {
    if (typeof data === 'object' && !Buffer.isBuffer(data) && data !== null) {
      this.bodyData = JSON.stringify(data);
      if (!this.headers['content-type']) {
        this.headers['content-type'] = 'application/json';
      }
    } else if (data !== null && data !== undefined) {
      this.bodyData = String(data);
    }
    return this;
  }

  expect(status) {
    this._expectedStatus = status;
    return this;
  }

  then(resolve, reject) {
    return this.end().then(resolve, reject);
  }

  catch(reject) {
    return this.end().catch(reject);
  }

  end() {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const req = new http.IncomingMessage(socket);
      req.method = this.method;
      req.url = this.url;
      req.headers = this.headers;

      if (this.bodyData !== null) {
        req.headers['content-length'] = String(Buffer.byteLength(this.bodyData));
        req.push(this.bodyData);
      }
      req.push(null);

      const res = new http.ServerResponse(req);
      const chunks = [];

      res.write = (chunk, encoding) => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        return true;
      };

      res.end = (chunk, encoding) => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        const raw = Buffer.concat(chunks).toString('utf8');
        let body = raw;
        const ct = res.getHeader('content-type') || '';
        if (ct.includes('application/json')) {
          try {
            body = JSON.parse(raw);
          } catch (_) {
            body = raw;
          }
        }

        const response = {
          status: res.statusCode,
          statusCode: res.statusCode,
          headers: res.getHeaders(),
          body,
          text: raw,
          ok: res.statusCode >= 200 && res.statusCode < 300
        };

        if (this._expectedStatus !== null && response.status !== this._expectedStatus) {
          const detail = typeof body === 'object' ? JSON.stringify(body) : body;
          return reject(new Error(
            `Expected HTTP ${this._expectedStatus} on ${this.method} ${this.url} but received ${response.status}: ${detail}`
          ));
        }

        resolve(response);
      };

      this.app.handle(req, res, (err) => {
        if (err) reject(err);
      });
    });
  }
}

function request(app) {
  return {
    get: (url) => new TestRequest(app, 'GET', url),
    post: (url) => new TestRequest(app, 'POST', url),
    put: (url) => new TestRequest(app, 'PUT', url),
    patch: (url) => new TestRequest(app, 'PATCH', url),
    delete: (url) => new TestRequest(app, 'DELETE', url)
  };
}

// -----------------------------------------------------------------------------
// 2. JWT Authentication Helpers
// -----------------------------------------------------------------------------
function createAuthToken(userId = '1', options = {}) {
  const secret = options.secret || DEFAULT_JWT_SECRET;
  const payload = { ...options.payload };
  const signOptions = {
    subject: options.subject || `usr_${userId}`,
    expiresIn: options.expiresIn || '1h',
    issuer: Object.hasOwn(options, 'issuer') ? options.issuer : 'personalplanner-api',
    audience: Object.hasOwn(options, 'audience') ? options.audience : 'personalplanner-client',
    algorithm: options.algorithm || 'HS256'
  };
  return jwt.sign(payload, secret, signOptions);
}

function getAuthHeaders(userId = '1', options = {}) {
  return {
    'Authorization': `Bearer ${createAuthToken(userId, options)}`
  };
}

// -----------------------------------------------------------------------------
// 3. Stateful In-Memory Mock Database Pool
// -----------------------------------------------------------------------------
function parseUtcDate(val) {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    if (val.endsWith('Z')) return new Date(val);
    const s = val.trim().replace(' ', 'T');
    return new Date(s.endsWith('Z') ? s : s + 'Z');
  }
  return new Date(val);
}

function cloneState(obj) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj);
    } catch (_) {}
  }
  return JSON.parse(JSON.stringify(obj));
}

function createMockPool(seed = {}) {
  const defaultUser = {
    id: 1,
    full_name: 'Sinh vien K19',
    email: 'student@example.com',
    password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
    student_id: 'SV12345',
    major: 'CNTT',
    university: 'Trường Đại học Công nghệ',
    avatar: null
  };

  const defaultPreferences = {
    user_id: 1,
    preferred_hours: {
      morning: { active: true, start: '08:00', end: '11:30' },
      afternoon: { active: true, start: '13:30', end: '17:00' },
      evening: { active: true, start: '19:00', end: '22:00' }
    },
    break_minutes: 15,
    timezone: 'Asia/Ho_Chi_Minh',
    email_reminder: true,
    browser_reminder: true
  };

  const state = {
    users: seed.users ? JSON.parse(JSON.stringify(seed.users)) : [defaultUser],
    preferences: seed.preferences ? JSON.parse(JSON.stringify(seed.preferences)) : [defaultPreferences],
    classes: seed.classes ? JSON.parse(JSON.stringify(seed.classes)) : [],
    tasks: seed.tasks ? JSON.parse(JSON.stringify(seed.tasks)) : [],
    work_schedules: seed.work_schedules ? JSON.parse(JSON.stringify(seed.work_schedules)) : [],
    scheduled_events: seed.scheduled_events ? JSON.parse(JSON.stringify(seed.scheduled_events)) : [],
    notifications: seed.notifications ? JSON.parse(JSON.stringify(seed.notifications)) : []
  };

  let nextIds = {
    users: 2,
    work_schedules: 100,
    scheduled_events: 200,
    tasks: 300,
    classes: 400,
    notifications: 500
  };

  // Mutex per user for simulating serialized transaction locks (T3-08)
  const userLocks = new Map();

  async function acquireUserLock(userId) {
    while (userLocks.has(userId)) {
      await userLocks.get(userId);
    }
    let resolveLock;
    const lockPromise = new Promise(resolve => { resolveLock = resolve; });
    userLocks.set(userId, lockPromise);
    return () => {
      userLocks.delete(userId);
      resolveLock();
    };
  }

  async function execute(sql, params = [], heldLocks = [], tx = null) {
    const s = sql.toLowerCase().replace(/\s+/g, ' ').trim();

    // 1. Connection check
    if (s.startsWith('select 1')) {
      return [[{ 1: 1 }]];
    }

    // 2. User Row Lock for transactions (lockUser)
    if (s.includes('select id from users') && s.includes('for update')) {
      const userId = Number(params[0]);
      const user = state.users.find(u => u.id === userId);
      if (!user) return [[]];
      if (!heldLocks.some(l => l.userId === userId)) {
        const release = await acquireUserLock(userId);
        heldLocks.push({ userId, release });
      }
      return [[{ id: userId }]];
    }

    // 3. Auth & Profile User Queries
    if (s.startsWith('select') && s.includes('from users u') && s.includes('study_preferences p')) {
      const userId = Number(params[0]);
      const user = state.users.find(u => u.id === userId);
      const pref = state.preferences.find(p => p.user_id === userId) || defaultPreferences;
      if (!user) return [[]];
      return [[{
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        student_id: user.student_id,
        major: user.major,
        university: user.university,
        avatar: user.avatar,
        preferred_hours: pref.preferred_hours,
        break_minutes: pref.break_minutes,
        timezone: pref.timezone,
        email_reminder: pref.email_reminder,
        browser_reminder: pref.browser_reminder
      }]];
    }

    if (s.startsWith('select') && s.includes('from users') && s.includes('where email =')) {
      const email = String(params[0]).toLowerCase();
      const user = state.users.find(u => u.email.toLowerCase() === email);
      return [user ? [user] : []];
    }

    if (s.startsWith('select') && s.includes('from users') && s.includes('where id =')) {
      const userId = Number(params[0]);
      const user = state.users.find(u => u.id === userId);
      return [user ? [user] : []];
    }

    if (s.startsWith('insert into users')) {
      const id = nextIds.users++;
      const [fullName, email, passwordHash, studentId] = params;
      const user = {
        id,
        full_name: fullName,
        email,
        password_hash: passwordHash,
        student_id: studentId || null,
        major: null,
        university: null,
        avatar: null
      };
      state.users.push(user);
      if (tx && tx.active) {
        tx.undoLog.push(() => {
          const idx = state.users.indexOf(user);
          if (idx !== -1) state.users.splice(idx, 1);
        });
      }
      return [{ insertId: id, affectedRows: 1 }];
    }

    if (s.startsWith('update users set')) {
      const userId = Number(params[params.length - 1]);
      const user = state.users.find(u => u.id === userId);
      if (user) {
        if (tx && tx.active) {
          const old = cloneState(user);
          tx.undoLog.push(() => {
            Object.assign(user, old);
          });
        }
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 0 }];
    }

    // 4. Study Preferences
    if (s.startsWith('select') && s.includes('from study_preferences')) {
      const userId = Number(params[0]);
      const pref = state.preferences.find(p => p.user_id === userId) || defaultPreferences;
      return [[{
        preferred_hours: pref.preferred_hours,
        break_minutes: pref.break_minutes,
        timezone: pref.timezone,
        email_reminder: pref.email_reminder,
        browser_reminder: pref.browser_reminder
      }]];
    }

    if (s.startsWith('insert into study_preferences')) {
      const [userId, prefHours] = params;
      const parsedHours = typeof prefHours === 'string' ? JSON.parse(prefHours) : prefHours;
      const record = {
        user_id: Number(userId),
        preferred_hours: parsedHours,
        break_minutes: 15,
        timezone: 'Asia/Ho_Chi_Minh',
        email_reminder: true,
        browser_reminder: true
      };
      state.preferences.push(record);
      if (tx && tx.active) {
        tx.undoLog.push(() => {
          const idx = state.preferences.indexOf(record);
          if (idx !== -1) state.preferences.splice(idx, 1);
        });
      }
      return [{ affectedRows: 1 }];
    }

    if (s.startsWith('update study_preferences set')) {
      const userId = Number(params[params.length - 1]);
      let pref = state.preferences.find(p => p.user_id === userId);
      if (!pref) {
        pref = { user_id: userId, ...JSON.parse(JSON.stringify(defaultPreferences)) };
        state.preferences.push(pref);
        if (tx && tx.active) {
          tx.undoLog.push(() => {
            const idx = state.preferences.indexOf(pref);
            if (idx !== -1) state.preferences.splice(idx, 1);
          });
        }
      }
      if (tx && tx.active) {
        const old = cloneState(pref);
        tx.undoLog.push(() => {
          Object.assign(pref, old);
        });
      }
      if (s.includes('break_minutes')) {
        const idx = params.findIndex(p => typeof p === 'number' && p >= 0 && p <= 180);
        if (idx !== -1) pref.break_minutes = params[idx];
      }
      if (s.includes('timezone')) {
        const tz = params.find(p => typeof p === 'string' && p.includes('/'));
        if (tz) pref.timezone = tz;
      }
      if (s.includes('preferred_hours')) {
        const pHours = params.find(p => typeof p === 'string' && (p.includes('morning') || p.includes('start')));
        if (pHours) pref.preferred_hours = JSON.parse(pHours);
      }
      return [{ affectedRows: 1 }];
    }

    // 5. Classes Query & Mutation
    if (s.startsWith('select') && s.includes('from classes')) {
      if (s.includes('where id = ? and user_id = ?')) {
        const id = Number(params[0]);
        const uid = Number(params[1]);
        const rows = state.classes.filter(c => c.id === id && c.user_id === uid);
        return [rows.map(c => ({
          id: c.id,
          title: c.title,
          code: c.code || null,
          room: c.room || null,
          lecturer: c.lecturer || null,
          day_of_week: c.day_of_week !== null && c.day_of_week !== undefined ? Number(c.day_of_week) : null,
          start_time: c.start_time,
          end_time: c.end_time,
          semester_start: c.semester_start || null,
          semester_end: c.semester_end || null,
          color: c.color || '#0d7480',
          notes: c.notes || null
        }))];
      }

      const userId = Number(params[0]);
      let rows = state.classes.filter(c => c.user_id === userId);

      if (s.includes('day_of_week = ?')) {
        const dayOfWeek = Number(params[1]);
        const endTime = params[2];
        const startTime = params[3];
        const excludeId = params[params.length - 1];

        rows = rows.filter(c => {
          if (c.day_of_week !== dayOfWeek) return false;
          if (excludeId !== null && excludeId !== undefined && c.id === Number(excludeId)) return false;
          // check overlap: c.start_time < endTime && c.end_time > startTime
          if (c.start_time < endTime && c.end_time > startTime) return true;
          return false;
        });
      }

      return [rows.map(c => ({
        id: c.id,
        title: c.title,
        code: c.code || null,
        room: c.room || null,
        lecturer: c.lecturer || null,
        day_of_week: c.day_of_week !== null && c.day_of_week !== undefined ? Number(c.day_of_week) : null,
        start_time: c.start_time,
        end_time: c.end_time,
        semester_start: c.semester_start || null,
        semester_end: c.semester_end || null,
        color: c.color || '#0d7480',
        notes: c.notes || null
      }))];
    }

    if (s.startsWith('insert into classes')) {
      const id = nextIds.classes++;
      const [userId, title, code, room, lecturer, dayOfWeek, startTime, endTime, semStart, semEnd, color, notes] = params;
      const record = {
        id,
        user_id: Number(userId),
        title,
        code: code || null,
        room: room || null,
        lecturer: lecturer || null,
        day_of_week: dayOfWeek !== undefined && dayOfWeek !== null ? Number(dayOfWeek) : null,
        start_time: startTime,
        end_time: endTime,
        semester_start: semStart || null,
        semester_end: semEnd || null,
        color: color || '#0d7480',
        notes: notes || null
      };
      state.classes.push(record);
      if (tx && tx.active) {
        tx.undoLog.push(() => {
          const idx = state.classes.indexOf(record);
          if (idx !== -1) state.classes.splice(idx, 1);
        });
      }
      return [{ insertId: id, affectedRows: 1 }];
    }

    if (s.startsWith('delete from classes')) {
      const id = Number(params[0]);
      const userId = Number(params[1]);
      const idx = state.classes.findIndex(c => c.id === id && c.user_id === userId);
      if (idx !== -1) {
        const deleted = state.classes[idx];
        state.classes.splice(idx, 1);
        if (tx && tx.active) {
          tx.undoLog.push(() => {
            state.classes.splice(idx, 0, deleted);
          });
        }
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 0 }];
    }

    // 6. Tasks Query & Mutation
    if (s.startsWith('select') && s.includes('from tasks')) {
      let rows = state.tasks;

      if (s.includes('where id =') && s.includes('user_id =')) {
        // SELECT ... FROM tasks WHERE id = ? AND user_id = ?
        const id = Number(params[0]);
        const userId = Number(params[1]);
        rows = rows.filter(t => t.id === id && t.user_id === userId);
      } else if (s.includes('id in (')) {
        // SELECT ... FROM tasks WHERE user_id = ? AND id IN (...)
        const userId = Number(params[0]);
        const ids = params.slice(1).map(Number);
        rows = rows.filter(t => t.user_id === userId && ids.includes(t.id));
      } else {
        // SELECT ... FROM tasks WHERE user_id = ?
        const userId = Number(params[0]);
        rows = rows.filter(t => t.user_id === userId);
      }

      return [rows.map(t => ({
        id: String(t.id),
        user_id: t.user_id,
        title: t.title,
        subject: t.subject || null,
        description: t.description || null,
        priority: t.priority || 'medium',
        status: t.status || 'todo',
        progress: t.progress !== undefined ? t.progress : 0,
        estimated_hours: t.estimated_hours || 1,
        deadline: t.deadline || null,
        created_at: t.created_at || new Date(),
        updated_at: t.updated_at || new Date()
      }))];
    }

    if (s.startsWith('insert into tasks')) {
      const id = nextIds.tasks++;
      const colMatch = sql.match(/insert into tasks\s*\(([^)]+)\)/i);
      const cols = colMatch ? colMatch[1].split(',').map(c => c.trim().toLowerCase()) : [];
      
      const record = {
        id,
        user_id: Number(params[0]),
        title: '',
        subject: null,
        description: null,
        priority: 'medium',
        status: 'todo',
        progress: 0,
        estimated_hours: 1,
        deadline: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      cols.forEach((col, idx) => {
        const val = params[idx];
        if (col === 'title') record.title = val;
        else if (col === 'subject') record.subject = val;
        else if (col === 'description') record.description = val;
        else if (col === 'priority') record.priority = val;
        else if (col === 'status') record.status = val;
        else if (col === 'progress') record.progress = val !== null ? Number(val) : 0;
        else if (col === 'estimated_hours') record.estimated_hours = val !== null ? Number(val) : 1;
        else if (col === 'deadline') record.deadline = val ? parseUtcDate(val) : null;
      });

      state.tasks.push(record);
      if (tx && tx.active) {
        tx.undoLog.push(() => {
          const idx = state.tasks.indexOf(record);
          if (idx !== -1) state.tasks.splice(idx, 1);
        });
      }
      return [{ insertId: id, affectedRows: 1 }];
    }

    if (s.startsWith('update tasks set')) {
      const userId = Number(params[params.length - 1]);
      const id = Number(params[params.length - 2]);
      const task = state.tasks.find(t => t.id === id && t.user_id === userId);
      if (task) {
        if (tx && tx.active) {
          const old = cloneState(task);
          tx.undoLog.push(() => {
            Object.assign(task, old);
          });
        }
        task.updated_at = new Date();
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 0 }];
    }

    if (s.startsWith('delete from tasks')) {
      const id = Number(params[0]);
      const userId = Number(params[1]);
      const idx = state.tasks.findIndex(t => t.id === id && t.user_id === userId);
      if (idx !== -1) {
        const deleted = state.tasks[idx];
        state.tasks.splice(idx, 1);
        if (tx && tx.active) {
          tx.undoLog.push(() => {
            state.tasks.splice(idx, 0, deleted);
          });
        }
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 0 }];
    }

    // 7. Work Schedules Query & Mutation
    if (s.startsWith('select') && s.includes('from work_schedules')) {
      let rows = state.work_schedules;

      if (s.includes('where id =') && s.includes('user_id =')) {
        // SELECT ... FROM work_schedules WHERE id = ? AND user_id = ?
        const id = Number(params[0]);
        const userId = Number(params[1]);
        rows = rows.filter(w => w.id === id && w.user_id === userId);
      } else {
        // SELECT ... FROM work_schedules WHERE user_id = ?
        const userId = Number(params[0]);
        rows = rows.filter(w => w.user_id === userId);
      }

      return [rows.map(w => ({
        id: String(w.id),
        user_id: w.user_id,
        title: w.title,
        workplace: w.workplace || null,
        day_of_week: w.day_of_week !== null && w.day_of_week !== undefined ? Number(w.day_of_week) : null,
        work_date: w.work_date || null,
        start_time: w.start_time,
        end_time: w.end_time,
        start_date: w.start_date || null,
        end_date: w.end_date || null,
        color: w.color || '#0d7480',
        notes: w.notes || null,
        created_at: w.created_at || new Date(),
        updated_at: w.updated_at || new Date()
      }))];
    }

    if (s.startsWith('insert into work_schedules')) {
      const id = nextIds.work_schedules++;
      const [userId, title, workplace, dayOfWeek, workDate, startTime, endTime, startDate, endDate, color, notes] = params;
      const record = {
        id,
        user_id: Number(userId),
        title,
        workplace: workplace || null,
        day_of_week: dayOfWeek !== undefined && dayOfWeek !== null ? Number(dayOfWeek) : null,
        work_date: workDate || null,
        start_time: startTime,
        end_time: endTime,
        start_date: startDate || null,
        end_date: endDate || null,
        color: color || '#b45309',
        notes: notes || null,
        created_at: new Date(),
        updated_at: new Date()
      };
      state.work_schedules.push(record);
      if (tx && tx.active) {
        tx.undoLog.push(() => {
          const idx = state.work_schedules.indexOf(record);
          if (idx !== -1) state.work_schedules.splice(idx, 1);
        });
      }
      return [{ insertId: id, affectedRows: 1 }];
    }

    if (s.startsWith('update work_schedules set')) {
      const userId = Number(params[params.length - 1]);
      const id = Number(params[params.length - 2]);
      const record = state.work_schedules.find(w => w.id === id && w.user_id === userId);
      if (record) {
        if (tx && tx.active) {
          const old = cloneState(record);
          tx.undoLog.push(() => {
            Object.assign(record, old);
          });
        }
        if (s.includes('start_time = ?')) {
          const st = params.find(p => typeof p === 'string' && /^\d{2}:\d{2}$/.test(p));
          if (st) record.start_time = st;
        }
        if (s.includes('end_time = ?')) {
          const ets = params.filter(p => typeof p === 'string' && /^\d{2}:\d{2}$/.test(p));
          if (ets.length > 1) record.end_time = ets[1];
          else if (ets.length === 1 && !s.includes('start_time = ?')) record.end_time = ets[0];
        }
        if (s.includes('day_of_week = ?')) {
          const dow = params.find(p => typeof p === 'number' && p >= 0 && p <= 6);
          if (dow !== undefined) record.day_of_week = dow;
        }
        if (s.includes('notes = ?')) {
          const notesVal = params.find(p => typeof p === 'string' && !/^\d{2}:\d{2}$/.test(p) && !p.startsWith('#'));
          if (notesVal) record.notes = notesVal;
        }
        record.updated_at = new Date();
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 0 }];
    }

    if (s.startsWith('delete from work_schedules')) {
      const id = Number(params[0]);
      const userId = Number(params[1]);
      const idx = state.work_schedules.findIndex(w => w.id === id && w.user_id === userId);
      if (idx !== -1) {
        const deleted = state.work_schedules[idx];
        state.work_schedules.splice(idx, 1);
        if (tx && tx.active) {
          tx.undoLog.push(() => {
            state.work_schedules.splice(idx, 0, deleted);
          });
        }
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 0 }];
    }

    // 8. Scheduled Events
    if (s.startsWith('select') && s.includes('from scheduled_events') && s.includes('task_id in (')) {
      const userId = Number(params[0]);
      const taskIds = params.slice(1).map(Number);
      const rows = state.scheduled_events.filter(e => e.user_id === userId && taskIds.includes(Number(e.task_id)));
      return [rows.map(e => ({ task_id: String(e.task_id) }))];
    }

    if (s.startsWith('select') && s.includes('from scheduled_events')) {
      const userId = Number(params[0]);
      let rows = state.scheduled_events.filter(e => e.user_id === userId);
      return [rows.map(e => ({
        id: String(e.id),
        task_id: String(e.task_id),
        title: e.title,
        subject: e.subject || null,
        start_at: parseUtcDate(e.start_at),
        end_at: parseUtcDate(e.end_at),
        source: e.source || 'auto',
        color: e.color || '#8b5cf6'
      }))];
    }

    if (s.startsWith('insert into scheduled_events')) {
      const id = nextIds.scheduled_events++;
      const [userId, taskId, title, subject, startAt, endAt, source, color] = params;
      const record = {
        id,
        user_id: Number(userId),
        task_id: Number(taskId),
        title,
        subject: subject || null,
        start_at: parseUtcDate(startAt),
        end_at: parseUtcDate(endAt),
        source: source || 'auto',
        color: color || '#8b5cf6',
        created_at: new Date()
      };
      state.scheduled_events.push(record);
      if (tx && tx.active) {
        tx.undoLog.push(() => {
          const idx = state.scheduled_events.indexOf(record);
          if (idx !== -1) state.scheduled_events.splice(idx, 1);
        });
      }
      return [{ insertId: id, affectedRows: 1 }];
    }

    if (s.startsWith('delete from scheduled_events')) {
      const id = Number(params[0]);
      const userId = Number(params[1]);
      const idx = state.scheduled_events.findIndex(e => e.id === id && e.user_id === userId);
      if (idx !== -1) {
        const deleted = state.scheduled_events[idx];
        state.scheduled_events.splice(idx, 1);
        if (tx && tx.active) {
          tx.undoLog.push(() => {
            state.scheduled_events.splice(idx, 0, deleted);
          });
        }
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 0 }];
    }

    // 9. Notifications
    if (s.startsWith('select') && s.includes('from notifications')) {
      const userId = Number(params[0]);
      const rows = state.notifications.filter(n => n.user_id === userId);
      return [rows.map(n => ({
        id: String(n.id),
        user_id: n.user_id,
        title: n.title,
        message: n.message,
        type: n.type || 'info',
        is_read: n.is_read || 0,
        created_at: n.created_at || new Date()
      }))];
    }

    if (s.startsWith('insert into notifications')) {
      const id = nextIds.notifications++;
      let type = 'info';
      let title = '';
      let message = '';
      if (s.includes("'success'")) {
        type = 'success';
        title = params[1];
        message = params[2];
      } else {
        title = params[1];
        message = params[2];
        type = params[3] || 'info';
      }
      const record = {
        id,
        user_id: Number(params[0]),
        title,
        message,
        type,
        is_read: 0,
        created_at: new Date()
      };
      state.notifications.push(record);
      if (tx && tx.active) {
        tx.undoLog.push(() => {
          const idx = state.notifications.indexOf(record);
          if (idx !== -1) state.notifications.splice(idx, 1);
        });
      }
      return [{ insertId: id, affectedRows: 1 }];
    }

    if (s.startsWith('update notifications set')) {
      return [{ affectedRows: 1 }];
    }

    return [[]];
  }

  const pool = {
    execute: (sql, params) => execute(sql, params),
    query: (sql, params) => execute(sql, params),
    async getConnection() {
      const heldLocks = [];
      const tx = { active: false, undoLog: [] };
      let stateSnapshot = null;
      return {
        beginTransaction: async () => {
          tx.active = true;
          tx.undoLog = [];
          stateSnapshot = cloneState(state);
        },
        commit: async () => {
          tx.active = false;
          tx.undoLog = [];
          stateSnapshot = null;
          while (heldLocks.length > 0) {
            const l = heldLocks.pop();
            l.release();
          }
        },
        rollback: async () => {
          if (tx.active) {
            while (tx.undoLog.length > 0) {
              const undo = tx.undoLog.pop();
              try { undo(); } catch (_) {}
            }
            tx.active = false;
            stateSnapshot = null;
          }
          while (heldLocks.length > 0) {
            const l = heldLocks.pop();
            l.release();
          }
        },
        release: () => {
          if (tx.active) {
            while (tx.undoLog.length > 0) {
              const undo = tx.undoLog.pop();
              try { undo(); } catch (_) {}
            }
            tx.active = false;
            stateSnapshot = null;
          }
          while (heldLocks.length > 0) {
            const l = heldLocks.pop();
            l.release();
          }
        },
        execute: (sql, params) => execute(sql, params, heldLocks, tx),
        query: (sql, params) => execute(sql, params, heldLocks, tx)
      };
    },
    state,
    reset() {
      state.users = seed.users ? JSON.parse(JSON.stringify(seed.users)) : [defaultUser];
      state.preferences = seed.preferences ? JSON.parse(JSON.stringify(seed.preferences)) : [defaultPreferences];
      state.classes = seed.classes ? JSON.parse(JSON.stringify(seed.classes)) : [];
      state.tasks = seed.tasks ? JSON.parse(JSON.stringify(seed.tasks)) : [];
      state.work_schedules = seed.work_schedules ? JSON.parse(JSON.stringify(seed.work_schedules)) : [];
      state.scheduled_events = seed.scheduled_events ? JSON.parse(JSON.stringify(seed.scheduled_events)) : [];
      state.notifications = [];
      userLocks.clear();
    }
  };

  return pool;
}

// -----------------------------------------------------------------------------
// 4. App Factory for Testing
// -----------------------------------------------------------------------------
function createTestApp(options = {}) {
  const { createApp } = require('../../backend/src/app');
  const pool = options.pool || createMockPool(options.seed);
  const config = {
    JWT_SECRET: options.jwtSecret || DEFAULT_JWT_SECRET,
    JWT_EXPIRES_IN: '1h',
    CORS_ORIGIN: 'http://localhost:5500',
    ...options.config
  };

  const redisStore = new Map();
  const redisClient = options.redisClient || {
    isReady: true,
    store: redisStore,
    async get(key) { return redisStore.get(key) || null; },
    async setEx(key, ttl, value) { redisStore.set(key, value); },
    async incr(key) {
      const val = Number(redisStore.get(key) || 0) + 1;
      redisStore.set(key, String(val));
      return val;
    },
    async del(key) { redisStore.delete(key); }
  };

  const app = createApp({ pool, config, redisClient });
  return { app, pool, config, redisClient };
}

// -----------------------------------------------------------------------------
// 5. Test Suite Definition Primitives
// -----------------------------------------------------------------------------
const registeredSuites = [];
let currentSuite = null;

function describe(name, fn) {
  const suite = { name, tests: [], beforeEach: [], afterEach: [] };
  const parentSuite = currentSuite;
  currentSuite = suite;
  registeredSuites.push(suite);
  fn();
  currentSuite = parentSuite;
}

function test(name, fn) {
  if (!currentSuite) {
    describe('Default Suite', () => {
      currentSuite.tests.push({ name, fn });
    });
  } else {
    currentSuite.tests.push({ name, fn });
  }
}

function beforeEach(fn) {
  if (currentSuite) currentSuite.beforeEach.push(fn);
}

function afterEach(fn) {
  if (currentSuite) currentSuite.afterEach.push(fn);
}

module.exports = {
  request,
  createAuthToken,
  getAuthHeaders,
  createMockPool,
  createTestApp,
  describe,
  test,
  it: test,
  beforeEach,
  afterEach,
  assert,
  registeredSuites,
  DEFAULT_JWT_SECRET,
  parseUtcDate
};
