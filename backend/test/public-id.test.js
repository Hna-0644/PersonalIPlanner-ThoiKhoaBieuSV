const test = require('node:test');
const assert = require('node:assert/strict');
const { toDatabaseId, toPublicId } = require('../src/utils/public-id');

test('public IDs preserve a typed prefix and keep database identifiers internal', () => {
  const publicId = toPublicId('task', '42');
  assert.equal(publicId, 'tsk_42');
  assert.equal(toDatabaseId(publicId, 'task'), '42');
  assert.throws(() => toDatabaseId('cls_42', 'task'), {
    code: 'VALIDATION_ERROR'
  });
});
