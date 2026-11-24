const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const express = require('express');
const jwt = require('jsonwebtoken');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { AppError } = require('../src/utils/app-error');
const { createAuthenticate } = require('../src/middleware/authenticate');
const { errorHandler } = require('../src/middleware/error-handler');
const { createDocumentRouter } = require('../src/routes/document-routes');

const JWT_SECRET = 'study-document-route-test-secret';

function createApp(service) {
  const app = express();
  app.use('/api/documents', createDocumentRouter(service, createAuthenticate(JWT_SECRET)));
  app.use(errorHandler);
  return app;
}

function authHeader(userId = 'usr_17') {
  const token = jwt.sign({ sub: userId }, JWT_SECRET, {
    algorithm: 'HS256',
    issuer: 'personalplanner-api',
    audience: 'personalplanner-client',
    expiresIn: '5m'
  });
  return `Bearer ${token}`;
}

function createService(overrides = {}) {
  return {
    async listDocuments(_userId, query) {
      return {
        documents: [],
        pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 1 }
      };
    },
    async setBookmark(_userId, id, isBookmarked) {
      return { id, isBookmarked };
    },
    async getDocumentFilters() {
      return { universities: [], subjects: [], studentYears: [1, 2, 3, 4] };
    },
    async createDocument(_userId, _input, file) {
      if (file === undefined && !_input.sourceUrl) {
        throw new AppError(400, 'FILE_REQUIRED', 'Vui lòng chọn tệp tài liệu hoặc nhập link HTTPS.');
      }
      return { id: 'doc_1', title: 'Test' };
    },
    async getDocumentFile() {
      throw new Error('unexpected download');
    },
    ...overrides
  };
}

test('document listing requires authentication and forwards filters', async () => {
  let received;
  const app = createApp(createService({
    async listDocuments(userId, query) {
      received = { userId, query };
      return { documents: [], pagination: { page: 2, limit: 12, total: 0, totalPages: 1 } };
    }
  }));

  assert.equal((await request(app).get('/api/documents')).status, 401);
  assert.equal((await request(app).get('/api/documents/filters')).status, 401);
  const response = await request(app)
    .get('/api/documents?q=exam&subjectCode=it3020&university=UIT&academicYear=2025-2026&studentYear=2&category=past_exams&savedOnly=true&page=2')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.deepEqual(received, {
    userId: '17',
    query: {
      q: 'exam',
      subjectCode: 'IT3020',
      university: 'UIT',
      academicYear: '2025-2026',
      studentYear: 2,
      category: 'past_exams',
      savedOnly: true,
      page: 2,
      limit: 12
    }
  });

  const allYearsResponse = await request(app)
    .get('/api/documents?studentYear=')
    .set('Authorization', authHeader());
  assert.equal(allYearsResponse.status, 200);
  assert.equal(received.query.studentYear, undefined);
});

test('document bookmarks require authentication and are scoped to the current user', async () => {
  const calls = [];
  const app = createApp(createService({
    async setBookmark(...args) {
      calls.push(args);
      return { id: args[1], isBookmarked: args[2] };
    }
  }));

  assert.equal((await request(app).put('/api/documents/doc_21/bookmark')).status, 401);
  const saved = await request(app)
    .put('/api/documents/doc_21/bookmark')
    .set('Authorization', authHeader('usr_17'));
  const removed = await request(app)
    .delete('/api/documents/doc_21/bookmark')
    .set('Authorization', authHeader('usr_17'));

  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.data, { id: 'doc_21', isBookmarked: true });
  assert.equal(removed.status, 200);
  assert.deepEqual(removed.body.data, { id: 'doc_21', isBookmarked: false });
  assert.deepEqual(calls, [['17', 'doc_21', true], ['17', 'doc_21', false]]);
});

test('document filters require authentication and return available filter values', async () => {
  const app = createApp(createService({
    async getDocumentFilters() {
      return {
        universities: ['Trường Đại học FPT'],
        academicYears: ['2025-2026'],
        subjects: [{ code: 'IT3040', name: 'Cơ sở dữ liệu' }],
        studentYears: [1, 2, 3, 4]
      };
    }
  }));
  const response = await request(app)
    .get('/api/documents/filters')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.universities, ['Trường Đại học FPT']);
  assert.deepEqual(response.body.data.academicYears, ['2025-2026']);
  assert.deepEqual(response.body.data.studentYears, [1, 2, 3, 4]);
});

test('document upload passes authenticated user, metadata, and the uploaded file', async () => {
  let received;
  const app = createApp(createService({
    async createDocument(...args) {
      received = args;
      return { id: 'doc_1', title: args[1].title };
    }
  }));

  const response = await request(app)
    .post('/api/documents')
    .set('Authorization', authHeader('usr_21'))
    .field('subjectCode', 'it3020')
    .field('subjectName', 'Lập trình Web')
    .field('title', 'Tài liệu ôn tập')
    .field('category', 'summaries')
    .field('description', 'Ôn tập cuối kỳ')
    .field('university', 'Trường Đại học FPT')
    .field('academicYear', '2025-2026')
    .attach('file', Buffer.from('%PDF-1.7\nsample'), {
      filename: 'on-tap.pdf',
      contentType: 'application/pdf'
    });

  assert.equal(response.status, 201);
  assert.equal(received[0], '21');
  assert.equal(received[1].subjectCode, 'IT3020');
  assert.equal(received[1].university, 'Trường Đại học FPT');
  assert.equal(received[1].academicYear, '2025-2026');
  assert.equal(received[2].originalname, 'on-tap.pdf');
  assert.equal(received[2].buffer.subarray(0, 5).toString(), '%PDF-');
});

test('document upload rejects missing or unsupported files', async () => {
  const app = createApp(createService());
  const missing = await request(app)
    .post('/api/documents')
    .set('Authorization', authHeader())
    .field('subjectCode', 'IT3020')
    .field('subjectName', 'Lập trình Web')
    .field('title', 'Tài liệu ôn tập')
    .field('category', 'summaries')
    .field('university', 'Trường Đại học FPT')
    .field('academicYear', '2025-2026');
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error.code, 'FILE_REQUIRED');

  const unsupported = await request(app)
    .post('/api/documents')
    .set('Authorization', authHeader())
    .field('subjectCode', 'IT3020')
    .field('subjectName', 'Lập trình Web')
    .field('title', 'Tài liệu ôn tập')
    .field('category', 'summaries')
    .field('university', 'Trường Đại học FPT')
    .field('academicYear', '2025-2026')
    .attach('file', Buffer.from('script'), {
      filename: 'script.exe',
      contentType: 'application/octet-stream'
    });
  assert.equal(unsupported.status, 400);
  assert.equal(unsupported.body.error.code, 'INVALID_DOCUMENT_FILE');
});

test('document upload accepts a PPTX attachment or an HTTPS resource link', async () => {
  const calls = [];
  const app = createApp(createService({
    async createDocument(...args) {
      calls.push(args);
      return { id: 'doc_2', sourceUrl: args[1].sourceUrl || null };
    }
  }));
  const headers = { Authorization: authHeader() };
  const pptx = await request(app)
    .post('/api/documents')
    .set(headers)
    .field('subjectCode', 'IT3020')
    .field('subjectName', 'Lập trình Web')
    .field('title', 'Slide bài giảng')
    .field('category', 'lecture_notes')
    .field('university', 'Trường Đại học FPT')
    .field('academicYear', '2025-2026')
    .attach('file', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]), {
      filename: 'slides.pptx',
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });
  assert.equal(pptx.status, 201);
  assert.equal(calls[0][2].originalname, 'slides.pptx');

  const link = await request(app)
    .post('/api/documents')
    .set(headers)
    .field('subjectCode', 'IT3020')
    .field('subjectName', 'Lập trình Web')
    .field('title', 'Tài liệu Google Drive')
    .field('category', 'lecture_notes')
    .field('university', 'Trường Đại học FPT')
    .field('academicYear', '2025-2026')
    .field('sourceUrl', 'https://drive.google.com/file/d/123');
  assert.equal(link.status, 201);
  assert.equal(calls[1][1].sourceUrl, 'https://drive.google.com/file/d/123');
  assert.equal(calls[1][2], undefined);
});

test('document file route returns an authenticated attachment', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'personalplanner-download-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'document.pdf');
  const bytes = Buffer.from('%PDF-1.7\nfile response');
  await fs.writeFile(filePath, bytes);
  let receivedId;
  const app = createApp(createService({
    async getDocumentFile(id) {
      receivedId = id;
      return { filePath, fileName: 'lecture-notes.pdf', mimeType: 'application/pdf' };
    }
  }));

  const response = await request(app)
    .get('/api/documents/doc_9/file')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.equal(receivedId, '9');
  assert.equal(response.headers['content-disposition'], 'attachment; filename="lecture-notes.pdf"');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.deepEqual(response.body, bytes);

  const rangeResponse = await request(app)
    .get('/api/documents/doc_9/file')
    .set('Authorization', authHeader())
    .set('Range', 'bytes=0-4');
  assert.equal(rangeResponse.status, 206);
  assert.equal(rangeResponse.headers['content-range'], `bytes 0-4/${bytes.length}`);
  assert.deepEqual(rangeResponse.body, bytes.subarray(0, 5));
});
