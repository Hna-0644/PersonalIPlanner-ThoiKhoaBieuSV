const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createAuthService } = require('../src/services/auth-service');

test('registration stores a bcrypt hash and returns a user-bound access token', async () => {
  const statements = [];
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql, params) {
      statements.push({ sql, params });
      if (sql.includes('INSERT INTO users')) return [{ insertId: 23 }, []];
      if (sql.includes('INSERT INTO study_preferences')) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected SQL in test: ${sql}`);
    }
  };
  const service = createAuthService({
    pool: { getConnection: async () => connection },
    jwtSecret: 'test-secret-that-is-at-least-thirty-two-characters',
    jwtExpiresIn: '15m'
  });

  const result = await service.createAccount({
    fullName: 'Student',
    email: 'student@example.com',
    password: 'strongpass123',
    studentId: '000123'
  });

  const storedPassword = statements[0].params[2];
  assert.notEqual(storedPassword, 'strongpass123');
  assert.equal(await bcrypt.compare('strongpass123', storedPassword), true);
  assert.equal(result.user.id, 'usr_23');
  assert.equal(result.user.studentId, '000123');
  assert.equal(result.tokenType, 'Bearer');
  assert.equal(Object.hasOwn(result.user, 'passwordHash'), false);
  assert.equal(jwt.decode(result.accessToken).sub, 'usr_23');
});
