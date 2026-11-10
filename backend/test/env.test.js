const test = require('node:test');
const assert = require('node:assert/strict');
const { loadEnv } = require('../src/config/env');

test('database defaults to the Docker Compose database name', () => {
  const config = loadEnv({ JWT_SECRET: 'x'.repeat(32) });

  assert.equal(config.DB_NAME, 'personal_planner');
});
