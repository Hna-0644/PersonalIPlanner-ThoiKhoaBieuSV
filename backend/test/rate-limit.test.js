const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('../src/middleware/rate-limit');

test('rate limiter removes expired users during its periodic cleanup', () => {
  const store = new Map();
  let now = 100;
  const limiter = createRateLimiter({
    windowMs: 10,
    maxRequests: 1,
    store,
    now: () => now
  });
  const invoke = userId => {
    let error = null;
    limiter({ user: { id: userId } }, {}, nextError => {
      error = nextError || null;
    });
    return error;
  };

  assert.equal(invoke('17'), null);
  assert.equal(store.has('user:17'), true);

  now = 109;
  assert.equal(invoke('18'), null);
  assert.equal(store.has('user:17'), true);

  now = 110;
  assert.equal(invoke('18').code, 'RATE_LIMIT_EXCEEDED');
  assert.equal(store.has('user:17'), false);
  assert.equal(store.has('user:18'), true);
});
