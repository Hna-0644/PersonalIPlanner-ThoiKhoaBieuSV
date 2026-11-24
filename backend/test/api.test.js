const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { createApp } = require('../src/app');

const jwtSecret = 'test-secret-that-is-at-least-thirty-two-characters';
const app = createApp({
  pool: {},
  config: {
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: '15m',
    CORS_ORIGIN: 'http://localhost:5500'
  }
});

test('health endpoint returns the standard success envelope', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { data: { status: 'ok' } });
});

test('protected resources reject requests without a bearer token', async () => {
  const response = await request(app).get('/api/tasks');
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHENTICATED');
});

test('protected resources reject tokens from an unexpected issuer', async () => {
  const token = jwt.sign({}, jwtSecret, {
    subject: 'usr_5',
    expiresIn: '1h',
    issuer: 'unexpected-issuer',
    audience: 'personalplanner-client'
  });
  const response = await request(app)
    .get('/api/tasks')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 401);
});

test('unknown endpoints use the standard not-found error', async () => {
  const response = await request(app).get('/api/does-not-exist');
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('malformed JSON returns the standard validation error', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .set('content-type', 'application/json')
    .send('{"email":');
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('schedule validation rejects duplicate ids before reaching the database', async () => {
  const token = jwt.sign({}, jwtSecret, {
    subject: 'usr_5',
    expiresIn: '1h',
    issuer: 'personalplanner-api',
    audience: 'personalplanner-client'
  });
  const response = await request(app)
    .post('/api/schedule/auto-generate')
    .set('Authorization', `Bearer ${token}`)
    .send({ taskIds: ['tsk_1', 'tsk_1'] });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('schedule apply requires timezone and break settings to revalidate the preview', async () => {
  const token = jwt.sign({}, jwtSecret, {
    subject: 'usr_5',
    expiresIn: '1h',
    issuer: 'personalplanner-api',
    audience: 'personalplanner-client'
  });
  const response = await request(app)
    .post('/api/schedule/apply')
    .set('Authorization', `Bearer ${token}`)
    .send({ plan: [] });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('/api/auth/login rate limiting returns 429 RATE_LIMIT_EXCEEDED when exceeding the limit', async () => {
  const freshApp = createApp({
    pool: {},
    config: {
      JWT_SECRET: jwtSecret,
      JWT_EXPIRES_IN: '15m',
      CORS_ORIGIN: 'http://localhost:5500'
    }
  });

  // 10 requests within the 1-minute window should reach validation (400 for empty payload)
  for (let i = 0; i < 10; i++) {
    const res = await request(freshApp)
      .post('/api/auth/login')
      .send({});
    assert.equal(res.status, 400);
  }

  // 11th request exceeds maxRequests (10) -> 429 RATE_LIMIT_EXCEEDED
  const blockedRes = await request(freshApp)
    .post('/api/auth/login')
    .send({});
  assert.equal(blockedRes.status, 429);
  assert.equal(blockedRes.body.error.code, 'RATE_LIMIT_EXCEEDED');
});

test('classService create / update / remove invalidates Redis schedule cache', async () => {
  const { createClassService } = require('../src/services/class-service');

  const incrKeys = [];
  const delKeys = [];
  let versionCounter = 0;

  const redisClient = {
    isReady: true,
    async incr(key) {
      incrKeys.push(key);
      versionCounter += 1;
      return versionCounter;
    },
    async del(key) {
      delKeys.push(key);
    }
  };

  const mockConnection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql) {
      if (sql.includes('SELECT id FROM users')) {
        return [[{ id: 7 }]];
      }
      if (sql.includes('SELECT id, title, start_time, end_time')) {
        return [[]];
      }
      if (sql.includes('INSERT INTO classes')) {
        return [{ insertId: 101 }];
      }
      if (sql.includes('FROM classes WHERE id = ? AND user_id = ? FOR UPDATE')) {
        return [[{
          id: 101,
          title: 'Math',
          code: 'M101',
          room: 'A1',
          lecturer: 'Prof X',
          day_of_week: 1,
          start_time: '08:00:00',
          end_time: '10:00:00',
          semester_start: null,
          semester_end: null,
          color: '#3b82f6',
          notes: null
        }]];
      }
      if (sql.includes('UPDATE classes')) {
        return [{ affectedRows: 1 }];
      }
      return [[]];
    }
  };

  const mockPool = {
    async getConnection() {
      return mockConnection;
    },
    async execute(sql) {
      if (sql.includes('DELETE FROM classes')) {
        return [{ affectedRows: 1 }];
      }
      return [[]];
    }
  };

  const classService = createClassService({ pool: mockPool, redisClient });

  await classService.create(7, {
    title: 'Math',
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '10:00'
  });
  assert.equal(incrKeys.length, 1);
  assert.equal(incrKeys[0], 'schedule:events:version:7');
  assert.equal(delKeys[0], 'schedule:events:7:0');

  await classService.update(7, 101, { title: 'Advanced Math' });
  assert.equal(incrKeys.length, 2);
  assert.equal(incrKeys[1], 'schedule:events:version:7');
  assert.equal(delKeys[1], 'schedule:events:7:1');

  await classService.remove(7, 101);
  assert.equal(incrKeys.length, 3);
  assert.equal(incrKeys[2], 'schedule:events:version:7');
  assert.equal(delKeys[2], 'schedule:events:7:2');
});
