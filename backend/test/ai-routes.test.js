const test = require('node:test');
const assert = require('node:assert/strict');
const { createAiRouter } = require('../src/routes/ai-routes');

test('schedule scan uses the authenticated user university profile', async () => {
  let receivedScanInput;
  const aiVisionService = {
    async scanScheduleImage(input) {
      receivedScanInput = input;
      return { classes: [] };
    }
  };
  const profileService = {
    async getProfile(userId) {
      assert.equal(userId, 'usr_23');
      return { university: 'Trường Đại học Nguyễn Tất Thành' };
    }
  };
  const router = createAiRouter(aiVisionService, profileService, (req, res, next) => next());
  const scanRoute = router.stack.find(layer => layer.route?.path === '/scan-schedule').route;
  let responseBody;
  let responseError;

  await scanRoute.stack[0].handle(
    {
      body: {
        image: 'data:image/jpeg;base64,dGVzdA==',
        university: 'A different school'
      },
      user: { id: 'usr_23' }
    },
    {
      json(body) {
        responseBody = body;
        return this;
      }
    },
    error => {
      responseError = error;
    }
  );

  assert.equal(responseError, undefined);
  assert.equal(receivedScanInput.image, 'data:image/jpeg;base64,dGVzdA==');
  assert.equal(receivedScanInput.university, 'Trường Đại học Nguyễn Tất Thành');
  assert.deepEqual(responseBody, { data: { classes: [] } });
});

test('ai router rate limiter blocks requests exceeding maxRequests with 429 RATE_LIMIT_EXCEEDED', () => {
  const aiVisionService = { async scanScheduleImage() { return { classes: [] }; } };
  const profileService = { async getProfile() { return {}; } };
  const router = createAiRouter(
    aiVisionService,
    profileService,
    (req, res, next) => next(),
    { rateLimitMax: 2, rateLimitWindowMs: 60000 }
  );

  // router.stack[0] is authenticate, router.stack[1] is aiScanRateLimiter
  const rateLimiterLayer = router.stack[1];
  const req = { user: { id: 'usr_99' } };
  let capturedError;

  rateLimiterLayer.handle(req, {}, err => { capturedError = err; });
  assert.equal(capturedError, undefined);

  rateLimiterLayer.handle(req, {}, err => { capturedError = err; });
  assert.equal(capturedError, undefined);

  rateLimiterLayer.handle(req, {}, err => { capturedError = err; });
  assert.ok(capturedError);
  assert.equal(capturedError.status, 429);
  assert.equal(capturedError.code, 'RATE_LIMIT_EXCEEDED');
});
