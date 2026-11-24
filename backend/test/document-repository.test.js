const test = require('node:test');
const assert = require('node:assert/strict');
const { createDocumentRepository } = require('../src/repositories/document-repository');

test('document search and filters match metadata, uploader university, and student year', async () => {
  const calls = [];
  const rows = [{
    id: '18',
    uploader_university: 'Cao đẳng Thực hành FPT Polytechnic',
    uploader_student_year: 2
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
    studentYear: 2,
    category: 'notes',
    page: 1,
    limit: 12
  });

  const keyword = '%Oracle%';
  assert.match(calls[0].sql, /JOIN users u ON u\.id = d\.user_id/);
  assert.match(calls[0].sql, /TRIM\(u\.university\) = \?/);
  assert.match(calls[0].sql, /u\.student_year = \?/);
  assert.match(calls[0].sql, /u\.university LIKE \?/);
  assert.deepEqual(calls[0].params, [
    'IT3040',
    'Cao đẳng Thực hành FPT Polytechnic',
    2,
    'notes',
    keyword,
    keyword,
    keyword,
    keyword,
    keyword,
    keyword
  ]);
  assert.match(calls[1].sql, /u\.university AS uploader_university/);
  assert.match(calls[1].sql, /u\.student_year AS uploader_student_year/);
  assert.deepEqual(calls[1].params, [...calls[0].params, '12', '0']);
  assert.deepEqual(result.rows, rows);
  assert.equal(result.total, 1);
});

test('document filters list universities and subjects represented in the library', async () => {
  const calls = [];
  const repository = createDocumentRepository({
    pool: {
      async execute(sql) {
        calls.push(sql);
        return calls.length === 1
          ? [[{ university: 'Trường Đại học FPT' }], []]
          : [[{ code: 'IT3040', name: 'Cơ sở dữ liệu' }], []];
      }
    }
  });

  assert.deepEqual(await repository.findDocumentFilters(), {
    universities: ['Trường Đại học FPT'],
    subjects: [{ code: 'IT3040', name: 'Cơ sở dữ liệu' }]
  });
  assert.match(calls[0], /SELECT DISTINCT TRIM\(u\.university\)/);
  assert.match(calls[1], /GROUP BY subject_code/);
});
