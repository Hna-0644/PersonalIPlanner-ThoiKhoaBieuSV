const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const apiSource = fs.readFileSync(
  path.join(__dirname, '../../frontend/js/api.js'),
  'utf8'
);

function loadApiService({ token, fetch }) {
  let mockScanCalls = 0;
  const authService = { getToken: () => token };
  const uiStates = { showApiError() {} };
  const appStore = {
    simulateAIScanSchedule() {
      mockScanCalls += 1;
      return { classes: [{ title: 'Mock class' }] };
    }
  };
  const window = {
    location: { port: '5500', origin: 'http://127.0.0.1:5500' },
    AuthService: authService,
    UIStates: uiStates,
    AppStore: appStore
  };
  const context = {
    window,
    AuthService: authService,
    UIStates: uiStates,
    AppStore: appStore,
    localStorage: { getItem: () => token },
    fetch,
    JSON,
    String,
    Error,
    Math
  };

  vm.runInNewContext(apiSource, context);
  return {
    api: window.ApiService,
    getMockScanCalls: () => mockScanCalls
  };
}

test('local-account image scan sends the base64 image to the backend without simulating results', async () => {
  const image = 'data:image/jpeg;base64,dGVzdA==';
  let requestUrl;
  let requestOptions;
  const { api, getMockScanCalls } = loadApiService({
    token: 'header.payload.local_sig',
    async fetch(url, options) {
      requestUrl = url;
      requestOptions = options;
      return {
        ok: true,
        status: 200,
        async json() {
          return { data: { classes: [] } };
        }
      };
    }
  });

  await api.scanScheduleFromImage(image);

  assert.equal(requestUrl, 'http://localhost:5000/api/ai/scan-schedule');
  assert.equal(requestOptions.method, 'POST');
  assert.deepEqual(JSON.parse(requestOptions.body), { image });
  assert.equal(getMockScanCalls(), 0);
});

test('network failure rejects image scan instead of returning simulated classes', async () => {
  const { api, getMockScanCalls } = loadApiService({
    token: 'header.payload.local_sig',
    async fetch() {
      throw new TypeError('Failed to fetch');
    }
  });

  await assert.rejects(api.scanScheduleFromImage('data:image/jpeg;base64,dGVzdA=='), /Failed to fetch/);
  assert.equal(getMockScanCalls(), 0);
});

test('a missing API response rejects image scan instead of returning an empty success', async () => {
  const { api, getMockScanCalls } = loadApiService({
    token: 'header.payload.local_sig',
    async fetch() {
      return {
        ok: false,
        status: 401,
        async json() {
          return {};
        }
      };
    }
  });

  await assert.rejects(api.scanScheduleFromImage('data:image/jpeg;base64,dGVzdA=='), /không trả về kết quả/i);
  assert.equal(getMockScanCalls(), 0);
});
