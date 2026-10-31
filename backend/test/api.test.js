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
