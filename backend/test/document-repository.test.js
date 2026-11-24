const test = require('node:test');
const assert = require('node:assert/strict');
const { createDocumentRepository } = require('../src/repositories/document-repository');

test('document search and filters match school, academic year, subject, and legacy student year', async () => {
  const calls = [];
  const rows = [{
    id: '18',
    uploader_university: 'Cao đẳng Thực hành FPT Polytechnic',
    uploader_student_year: 2,
    is_bookmarked: 1
  }];
  const repository = createDocumentRepository({
    pool: {
      async execute(sql, params) {
        calls.push({ sql, params });
        return calls.length === 1 ? [[{ total: 1 }], []] : [rows, []];
      }
    }
  });

  const result = await repository.findDocuments({
    q: 'Oracle',
    subjectCode: 'IT3040',
    university: 'Cao đẳng Thực hành FPT Polytechnic',
    academicYear: '2025-2026',
    studentYear: 2,
    category: 'notes',
    page: 1,
    limit: 12
  }, '17');

  const keyword = '%Oracle%';
  assert.match(calls[0].sql, /JOIN users u ON u\.id = d\.user_id/);
  assert.match(calls[0].sql, /COALESCE\(NULLIF\(TRIM\(d\.university\), ''\), TRIM\(u\.university\)\) = \?/);
  assert.match(calls[0].sql, /d\.academic_year = \?/);
  assert.match(calls[0].sql, /u\.student_year = \?/);
  assert.match(calls[0].sql, /d\.academic_year LIKE \?/);
  assert.deepEqual(calls[0].params, [
    'IT3040',
    'Cao đẳng Thực hành FPT Polytechnic',
    '2025-2026',
    2,
    'notes',
    keyword,
    keyword,
    keyword,
    keyword,
    keyword,
    keyword,
    keyword,
    keyword
  ]);
  assert.match(calls[1].sql, /u\.university AS uploader_university/);
  assert.match(calls[1].sql, /u\.student_year AS uploader_student_year/);
  assert.match(calls[1].sql, /AS is_bookmarked/);
  assert.deepEqual(calls[1].params, ['17', ...calls[0].params, '12', '0']);
  assert.deepEqual(result.rows, rows);
  assert.equal(result.total, 1);
});

test('saved document listing is scoped to the current user and bookmark writes are idempotent', async () => {
  const calls = [];
  const repository = createDocumentRepository({
    pool: {
      async execute(sql, params) {
        calls.push({ sql, params });
        return [[{ total: 0 }], []];
      }
    }
  });

  await repository.findDocuments({ savedOnly: true, page: 1, limit: 12 }, '21');
  await repository.setBookmark('21', '31', true);
  await repository.setBookmark('21', '31', false);

  assert.match(calls[0].sql, /FROM study_document_bookmarks b/);
  assert.deepEqual(calls[0].params, ['21']);
  assert.match(calls[2].sql, /INSERT INTO study_document_bookmarks/);
  assert.deepEqual(calls[2].params, ['21', '31']);
  assert.match(calls[3].sql, /DELETE FROM study_document_bookmarks/);
  assert.deepEqual(calls[3].params, ['21', '31']);
});

test('document filters list universities and subjects represented in the library', async () => {
  const calls = [];
  const repository = createDocumentRepository({
    pool: {
      async execute(sql) {
        calls.push(sql);
        if (calls.length === 1) return [[{ university: 'Trường Đại học FPT' }], []];
        if (calls.length === 2) return [[{ academic_year: '2025-2026' }], []];
        return [[{ code: 'IT3040', name: 'Cơ sở dữ liệu' }], []];
      }
    }
  });

  assert.deepEqual(await repository.findDocumentFilters(), {
    universities: ['Trường Đại học FPT'],
    academicYears: ['2025-2026'],
    subjects: [{ code: 'IT3040', name: 'Cơ sở dữ liệu' }]
  });
  assert.match(calls[0], /SELECT DISTINCT COALESCE/);
  assert.match(calls[1], /SELECT DISTINCT academic_year/);
  assert.match(calls[2], /GROUP BY subject_code/);
});

test('document creation persists school, academic year, and either file or URL metadata', async () => {
  const calls = [];
  const row = {
    id: 42,
    title: 'Tài liệu',
    university: 'Trường Đại học FPT',
    academic_year: '2025-2026',
    source_url: 'https://example.com/notes'
  };
  const connection = {
    async beginTransaction() {},
    async execute(sql, params) {
      calls.push({ sql, params });
      return sql.startsWith('INSERT')
        ? [{ insertId: 42 }, []]
        : [[row], []];
    },
    async commit() {},
    async rollback() {},
    release() {}
  };
  const repository = createDocumentRepository({
    pool: {
      async getConnection() {
        return connection;
      }
    }
  });

  await repository.create('17', {
    university: 'Trường Đại học FPT',
    academicYear: '2025-2026',
    subjectCode: 'IT3040',
    subjectName: 'Cơ sở dữ liệu',
    title: 'Tài liệu',
    category: 'lecture_notes',
    sourceUrl: row.source_url
  }, {
    originalName: null,
    storageName: null,
    mimeType: null,
    size: null,
    sourceUrl: row.source_url
  });

  assert.match(calls[0].sql, /university, academic_year/);
  assert.deepEqual(calls[0].params.slice(0, 4), [
    '17',
    'Trường Đại học FPT',
    '2025-2026',
    'IT3040'
  ]);
  assert.equal(calls[0].params.at(-1), 'https://example.com/notes');
});
