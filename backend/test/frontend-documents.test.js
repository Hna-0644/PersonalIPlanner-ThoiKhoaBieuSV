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
    university: 'Trường Đại học FPT',
    academicYear: '2025-2026',
    category: 'lecture_notes',
    savedOnly: true,
    page: 2,
    limit: 12
  });
  assert.equal(
    api.getStudyDocumentFileUrl('doc_17'),
    'http://localhost:5000/api/documents/doc_17/file'
  );
  await api.getStudyDocumentFilters();
  await api.setStudyDocumentBookmark('doc_17', true);
  await api.setStudyDocumentBookmark('doc_17', false);
  const formData = new FormData();
  formData.set('title', 'Tài liệu');
  await api.uploadStudyDocument(formData, { silent: true });

  assert.equal(
    calls[0].url,
    'http://localhost:5000/api/documents?q=database+notes&subjectCode=IT3040&university=Tr%C6%B0%E1%BB%9Dng+%C4%90%E1%BA%A1i+h%E1%BB%8Dc+FPT&academicYear=2025-2026&category=lecture_notes&savedOnly=true&page=2&limit=12'
  );
  assert.equal(calls[1].url, 'http://localhost:5000/api/documents/filters');
  assert.equal(calls[2].url, 'http://localhost:5000/api/documents/doc_17/bookmark');
  assert.equal(calls[2].options.method, 'PUT');
  assert.equal(calls[3].options.method, 'DELETE');
  assert.equal(calls[4].url, 'http://localhost:5000/api/documents');
  assert.equal(calls[4].options.body, formData);
  assert.equal(calls[4].options.headers['Content-Type'], undefined);
  assert.equal(calls[4].options.headers.Authorization, `Bearer ${'header.payload.local_sig'}`);
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
    api.getStudyDocumentFilters(),
    /Đăng nhập bằng tài khoản máy chủ/
  );
  await assert.rejects(
    api.uploadStudyDocument(formData),
    /Đăng nhập bằng tài khoản máy chủ/
  );
});

test('study library page provides the controls required by the shared document module', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../frontend/pages/tradingsource.html'),
    'utf8'
  );
  const source = fs.readFileSync(
    path.join(__dirname, '../../frontend/js/documents.js'),
    'utf8'
  );
  const requiredIds = new Set(
    [...source.matchAll(/getElementById\('([^']+)'\)/g)].map(match => match[1])
  );
  for (const id of requiredIds) {
    assert.match(page, new RegExp(`\\bid="${id}"`), `missing #${id}`);
  }
  assert.match(page, /src="\.\.\/js\/subject-catalog\.js"/);
  assert.match(page, /src="\.\.\/js\/documents\.js"/);
  assert.match(page, /id="marketplaceGridContainer"/);
  assert.match(page, /id="marketForm"/);
});

test('study library category shortcut applies the category and retains search filters', async () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../../frontend/js/documents.js'),
    'utf8'
  );
  const elements = new Map();
  const requests = [];
  let initialize;

  class Element {
    constructor() {
      this.value = '';
      this.options = [];
      this.listeners = {};
      this.classList = { toggle() {}, add() {}, remove() {} };
    }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    replaceChildren(...options) { this.options = options; }
    add(option) { this.options.push(option); }
    scrollIntoView() { this.scrolled = true; }
  }
  function getElement(id) {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  }
  getElement('studyDocumentCategoryFilter').options = [
    { value: '' }, { value: 'past_exams' }
  ];
  const shortcut = new Element();
  shortcut.dataset = { studyCategory: 'past_exams' };
  const document = {
    addEventListener(name, callback) {
      if (name === 'DOMContentLoaded') initialize = callback;
    },
    getElementById: getElement,
    querySelectorAll(selector) {
      return selector === '[data-study-category]' ? [shortcut] : [];
    }
  };
  const window = {
    location: { search: '' },
    StudySubjectCatalog: [{ code: 'IT3040', name: 'Cơ sở dữ liệu' }],
    addEventListener() {},
    setTimeout,
    clearTimeout
  };
  const ApiService = {
    async getStudyDocumentFilters() {
      return { universities: ['UIT'], academicYears: ['2025-2026'], subjects: [] };
    },
    async getStudyDocuments(query) {
      requests.push(query);
      return { documents: [], pagination: { page: 1, total: 0, totalPages: 1 } };
    }
  };
  function Option(label, value) { this.textContent = label; this.value = value; }
  vm.runInNewContext(source, {
    window, document, ApiService, Option, URLSearchParams, setTimeout, clearTimeout
  });
  await initialize();
  getElement('studyDocumentSearch').value = 'Cơ sở dữ liệu';
  getElement('studyDocumentUniversityFilter').value = 'UIT';
  getElement('studyDocumentAcademicYearFilter').value = '2025-2026';
  shortcut.listeners.click();
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(getElement('studyDocumentCategoryFilter').value, 'past_exams');
  assert.equal(getElement('studyDocuments').scrolled, true);
  assert.equal(requests.at(-1).q, 'Cơ sở dữ liệu');
  assert.equal(requests.at(-1).university, 'UIT');
  assert.equal(requests.at(-1).academicYear, '2025-2026');
  assert.equal(requests.at(-1).category, 'past_exams');

  let prevented = false;
  getElement('studyDocumentSearchForm').listeners.submit({
    preventDefault() { prevented = true; }
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(prevented, true);
  assert.equal(requests.at(-1).q, 'Cơ sở dữ liệu');
  assert.equal(requests.at(-1).category, 'past_exams');
});
