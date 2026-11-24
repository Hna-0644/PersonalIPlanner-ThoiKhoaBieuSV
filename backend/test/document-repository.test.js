const test = require('node:test');
const assert = require('node:assert/strict');
const { createDocumentRepository } = require('../src/repositories/document-repository');

test('document search matches the uploader university as well as document metadata', async () => {
  const calls = [];
  const rows = [{ id: '18', uploader_university: 'Cao đẳng Thực hành FPT Polytechnic' }];
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
    page: 1,
    limit: 12
  });

  const keyword = '%Oracle%';
  assert.match(calls[0].sql, /search_user\.university LIKE \?/);
  assert.deepEqual(calls[0].params, [keyword, keyword, keyword, keyword, keyword, keyword]);
  assert.match(calls[1].sql, /u\.university AS uploader_university/);
  assert.deepEqual(calls[1].params, [keyword, keyword, keyword, keyword, keyword, keyword, '12', '0']);
  assert.deepEqual(result.rows, rows);
  assert.equal(result.total, 1);
});
