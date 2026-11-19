const test = require('node:test');
const assert = require('node:assert/strict');
const { toPublicId, toDatabaseId } = require('../src/utils/public-id');

let communitySchemas;
try {
  communitySchemas = require('../src/schemas/community-schemas');
} catch (error) {
  if (
    error.code !== 'MODULE_NOT_FOUND' ||
    !error.message.includes('../src/schemas/community-schemas')
  ) {
    throw error;
  }
  communitySchemas = {};
}

test('Community public IDs round-trip through their typed prefixes', () => {
  for (const [type, prefix] of [
    ['subject', 'sub'],
    ['review', 'rev'],
    ['post', 'pst'],
    ['comment', 'cmt']
  ]) {
    const publicId = toPublicId(type, '42');
    assert.equal(publicId, `${prefix}_42`);
    assert.equal(toDatabaseId(publicId, type), '42');
  }
});

test('review schema accepts valid review fields and rejects ratings outside 1-5', () => {
  assert.equal(typeof communitySchemas.courseReviewCreateSchema?.safeParse, 'function');
  const validReview = {
    lecturerName: 'Dr. Nguyen',
    rating: 5,
    difficulty: 3,
    attendanceRequired: true,
    gradingNotes: 'Weekly assignments',
    materialsNotes: null,
    content: 'Clear lectures and fair grading.'
  };

  assert.equal(communitySchemas.courseReviewCreateSchema.safeParse(validReview).success, true);
  assert.equal(
    communitySchemas.courseReviewCreateSchema.safeParse({ ...validReview, rating: 0 }).success,
    false
  );
  assert.equal(
    communitySchemas.courseReviewCreateSchema.safeParse({ ...validReview, difficulty: 5.5 }).success,
    false
  );
  assert.equal(
    communitySchemas.courseReviewCreateSchema.safeParse({ ...validReview, content: '   ' }).success,
    false
  );
});

test('post and comment schemas trim content and enforce their documented limits', () => {
  assert.equal(typeof communitySchemas.classPostCreateSchema?.safeParse, 'function');
  assert.equal(typeof communitySchemas.postCommentCreateSchema?.safeParse, 'function');
  assert.equal(communitySchemas.classPostCreateSchema.safeParse({
    subjectId: 'sub_4',
    title: 'Find a project group',
    content: 'Looking for two teammates.'
  }).success, true);
  assert.equal(communitySchemas.classPostCreateSchema.safeParse({
    subjectId: 'sub_4',
    title: 'x'.repeat(121),
    content: 'Question'
  }).success, false);
  assert.equal(communitySchemas.postCommentCreateSchema.safeParse({
    content: '   '
  }).success, false);
  assert.equal(communitySchemas.postCommentCreateSchema.safeParse({
    content: 'x'.repeat(2001)
  }).success, false);
});

test('Community pagination defaults to page 1 and limit 20 and rejects limits above 100', () => {
  assert.equal(typeof communitySchemas.communityPaginationSchema?.safeParse, 'function');
  assert.deepEqual(communitySchemas.communityPaginationSchema.parse({}), {
    page: 1,
    limit: 20
  });
  assert.deepEqual(
    communitySchemas.communityPaginationSchema.parse({ page: '2', limit: '50' }),
    { page: 2, limit: 50 }
  );
  assert.equal(
    communitySchemas.communityPaginationSchema.safeParse({ page: '0' }).success,
    false
  );
  assert.equal(
    communitySchemas.communityPaginationSchema.safeParse({ limit: '101' }).success,
    false
  );
});

test('Community path schemas reject malformed public IDs and unsafe class codes', () => {
  assert.equal(typeof communitySchemas.subjectIdSchema?.safeParse, 'function');
  assert.equal(typeof communitySchemas.classCodeSchema?.safeParse, 'function');
  assert.equal(communitySchemas.subjectIdSchema.safeParse('sub_42').success, true);
  assert.equal(communitySchemas.subjectIdSchema.safeParse('42').success, false);
  assert.equal(communitySchemas.classCodeSchema.parse(' 23DTH1A '), '23DTH1A');
  assert.equal(communitySchemas.classCodeSchema.safeParse('23DTH1A/..').success, false);
});
