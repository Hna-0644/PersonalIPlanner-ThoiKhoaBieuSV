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
