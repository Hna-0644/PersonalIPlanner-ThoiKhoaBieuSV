const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createDocumentService } = require('../src/services/document-service');

function createRepository(overrides = {}) {
  const rows = [];
  let nextId = 1;
  return {
    rows,
    async findDocuments(query) {
      return {
        rows: rows.slice(0, query.limit),
        total: rows.length,
        page: query.page,
        limit: query.limit
      };
    },
    async findDocumentFilters() {
      return {
        universities: ['Trường Đại học Nguyễn Tất Thành'],
        subjects: [{ code: 'IT3020', name: 'Lập trình Web' }]
      };
    },
    async create(userId, input, file) {
      const row = {
        id: nextId++,
        user_id: userId,
        subject_code: input.subjectCode,
        subject_name: input.subjectName,
        title: input.title,
        description: input.description,
        category: input.category,
        original_name: file.originalName,
        storage_name: file.storageName,
        mime_type: file.mimeType,
        file_size: file.size,
        created_at: new Date('2026-11-24T05:00:00.000Z'),
        uploader_name: 'Nguyen Van A',
        uploader_university: 'Trường Đại học Nguyễn Tất Thành',
        uploader_student_year: 2
      };
      rows.push(row);
      return row;
    },
    async findById(id) {
      return rows.find(row => String(row.id) === String(id)) || null;
    },
    ...overrides
  };
}

async function createStorageDirectory(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'personalplanner-docs-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test('Document service stores a validated file and returns list/download metadata', async t => {
  const storageDirectory = await createStorageDirectory(t);
  const repository = createRepository();
  const service = createDocumentService({ repository, storageDirectory });
  const fileBuffer = Buffer.from('%PDF-1.7\nsample document');

  const created = await service.createDocument('17', {
    subjectCode: 'IT3020',
    subjectName: 'Lập trình Web',
    title: 'Đề cương ôn tập',
    description: 'Cuối kỳ',
    category: 'summary'
  }, {
    originalname: 'de-cuong.pdf',
    mimetype: 'application/pdf',
    size: fileBuffer.length,
    buffer: fileBuffer
  });

  assert.equal(created.id, 'doc_1');
  assert.equal(created.subjectCode, 'IT3020');
  assert.equal(created.fileName, 'de-cuong.pdf');
  assert.equal(created.uploaderUniversity, 'Trường Đại học Nguyễn Tất Thành');
  assert.equal(created.uploaderStudentYear, 2);
  assert.match(created.downloadUrl, /\/api\/documents\/doc_1\/file$/);

  const file = await service.getDocumentFile(created.id);
  assert.equal(file.fileName, 'de-cuong.pdf');
  assert.deepEqual(await fs.readFile(file.filePath), fileBuffer);

  const list = await service.listDocuments({ page: 1, limit: 12 });
  assert.equal(list.documents.length, 1);
  assert.equal(list.pagination.total, 1);
  assert.deepEqual(await service.getDocumentFilters(), {
    universities: ['Trường Đại học Nguyễn Tất Thành'],
    subjects: [{ code: 'IT3020', name: 'Lập trình Web' }],
    studentYears: [1, 2, 3, 4]
  });
});

test('Document service rejects a file whose content does not match its extension', async t => {
  const storageDirectory = await createStorageDirectory(t);
  const service = createDocumentService({ repository: createRepository(), storageDirectory });

  await assert.rejects(
    () => service.createDocument('17', {
      subjectCode: 'IT3020',
      subjectName: 'Lập trình Web',
      title: 'Tài liệu giả mạo',
      category: 'notes'
    }, {
      originalname: 'malware.pdf',
      mimetype: 'application/pdf',
      size: 8,
      buffer: Buffer.from('not a pdf')
    }),
    error => error.code === 'INVALID_DOCUMENT_FILE' && error.status === 400
  );
  assert.deepEqual(await fs.readdir(storageDirectory), []);
});

test('Document service rejects requests without an uploaded file', async () => {
  const service = createDocumentService({ repository: createRepository() });
  await assert.rejects(
    () => service.createDocument('17', {}, null),
    error => error.code === 'FILE_REQUIRED' && error.status === 400
  );
});

test('Document service removes a stored file if database insertion fails', async t => {
  const storageDirectory = await createStorageDirectory(t);
  const repository = createRepository({
    async create() {
      throw new Error('database unavailable');
    }
  });
  const service = createDocumentService({ repository, storageDirectory });

  await assert.rejects(
    () => service.createDocument('17', {
      subjectCode: 'IT3020',
      subjectName: 'Lập trình Web',
      title: 'Ghi chú tuần 1',
      category: 'notes'
    }, {
      originalname: 'notes.pdf',
      mimetype: 'application/pdf',
      size: 14,
      buffer: Buffer.from('%PDF-1.7 notes')
    }),
    /database unavailable/
  );
  assert.deepEqual(await fs.readdir(storageDirectory), []);
});
