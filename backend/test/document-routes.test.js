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
    async listDocuments(query) {
      return {
        documents: [],
        pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 1 }
      };
    },
    async createDocument(_userId, _input, file) {
      if (file === undefined) {
        throw new AppError(400, 'FILE_REQUIRED', 'Vui lòng chọn một tệp PDF, DOC hoặc DOCX.');
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
    async listDocuments(query) {
      received = query;
      return { documents: [], pagination: { page: 2, limit: 12, total: 0, totalPages: 1 } };
    }
  }));

  assert.equal((await request(app).get('/api/documents')).status, 401);
  const response = await request(app)
    .get('/api/documents?q=exam&subjectCode=it3020&category=exam&page=2')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.deepEqual(received, {
    q: 'exam',
    subjectCode: 'IT3020',
    category: 'exam',
    page: 2,
    limit: 12
  });
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
    .field('category', 'summary')
    .field('description', 'Ôn tập cuối kỳ')
    .attach('file', Buffer.from('%PDF-1.7\nsample'), {
      filename: 'on-tap.pdf',
      contentType: 'application/pdf'
    });

  assert.equal(response.status, 201);
  assert.equal(received[0], '21');
  assert.equal(received[1].subjectCode, 'IT3020');
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
    .field('category', 'summary');
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error.code, 'FILE_REQUIRED');

  const unsupported = await request(app)
    .post('/api/documents')
    .set('Authorization', authHeader())
    .field('subjectCode', 'IT3020')
    .field('subjectName', 'Lập trình Web')
    .field('title', 'Tài liệu ôn tập')
    .field('category', 'summary')
    .attach('file', Buffer.from('script'), {
      filename: 'script.exe',
      contentType: 'application/octet-stream'
    });
  assert.equal(unsupported.status, 400);
  assert.equal(unsupported.body.error.code, 'INVALID_DOCUMENT_FILE');
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
});
