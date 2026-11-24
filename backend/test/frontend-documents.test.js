const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const apiSource = fs.readFileSync(
  path.join(__dirname, '../../frontend/js/api.js'),
  'utf8'
);

function loadApiService(fetch) {
  const token = 'header.payload.local_sig';
  const authService = { getToken: () => token };
  const window = {
    location: { port: '5500', origin: 'http://127.0.0.1:5500' },
    AuthService: authService
  };
  const context = {
    window,
    AuthService: authService,
    localStorage: { getItem: () => token },
    fetch,
    FormData,
    URLSearchParams,
    JSON,
    String,
    Error,
    Math
  };

  vm.runInNewContext(apiSource, context);
  return window.ApiService;
}

test('document API serializes filters and uploads multipart data without setting Content-Type', async () => {
  const calls = [];
  const api = loadApiService(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      async json() {
        return { data: { documents: [], pagination: { page: 1, total: 0 } } };
      }
    };
  });

  await api.getStudyDocuments({
    q: 'database notes',
    subjectCode: 'IT3040',
    category: 'notes',
    page: 2,
    limit: 12
  });
  const formData = new FormData();
  formData.set('title', 'Tài liệu');
  await api.uploadStudyDocument(formData, { silent: true });

  assert.equal(
    calls[0].url,
    'http://localhost:5000/api/documents?q=database+notes&subjectCode=IT3040&category=notes&page=2&limit=12'
  );
  assert.equal(calls[1].url, 'http://localhost:5000/api/documents');
  assert.equal(calls[1].options.body, formData);
  assert.equal(calls[1].options.headers['Content-Type'], undefined);
  assert.equal(calls[1].options.headers.Authorization, `Bearer ${'header.payload.local_sig'}`);
});

test('document API does not treat an offline local-account 401 as success', async () => {
  const api = loadApiService(async () => ({
    ok: false,
    status: 401,
    async json() {
      return {};
    }
  }));
  const formData = new FormData();

  await assert.rejects(
    api.getStudyDocuments(),
    /Đăng nhập bằng tài khoản máy chủ/
  );
  await assert.rejects(
    api.uploadStudyDocument(formData),
    /Đăng nhập bằng tài khoản máy chủ/
  );
});
