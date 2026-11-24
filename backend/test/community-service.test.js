const test = require('node:test');
const assert = require('node:assert/strict');
const { AppError } = require('../src/utils/app-error');

let createCommunityService;
try {
  ({ createCommunityService } = require('../src/services/community-service'));
} catch (error) {
  if (
    error.code !== 'MODULE_NOT_FOUND' ||
    !error.message.includes('../src/services/community-service')
  ) {
    throw error;
  }
}

const reviewRow = {
  id: '18',
  subject_id: '7',
  user_id: '42',
  author_name: 'Nguyen Van A',
  author_university: 'UIT - VNUHCM',
  lecturer_name: 'Dr. Nguyen',
  rating: 5,
  difficulty: 3,
  attendance_required: 1,
  grading_notes: 'Weekly assignments',
  materials_notes: null,
  content: 'Clear lectures and fair grading.',
  created_at: '2026-11-18 10:00:00.000',
  updated_at: '2026-11-18 10:00:00.000'
};

const postRow = {
  id: '51',
  subject_id: '7',
  class_code: '23DTH1A',
  user_id: '42',
  author_name: 'Nguyen Van A',
  author_university: 'UIT - VNUHCM',
  title: 'Find a project group',
  content: 'Looking for two teammates.',
  upvote_count: 3,
  created_at: '2026-11-18 10:00:00.000'
};

const commentRow = {
  id: '61',
  post_id: '51',
  user_id: '42',
  author_name: 'Tran Thi B',
  author_university: 'HCMUT',
  content: 'I can join.',
  upvote_count: 1,
  created_at: '2026-11-18 11:00:00.000'
};

function createService(options) {
  assert.equal(typeof createCommunityService, 'function');
  return createCommunityService(options);
}

function createRepository(overrides = {}) {
  return {
    async findSubject() {
      return { id: '7', course_code: 'CS101', subject_name: 'Programming' };
    },
    async getReviewSummary() {
      return { avg_rating: '5.0000', total_reviews: 1, attendance_rate: '100.00' };
    },
    async listReviews() {
      return { rows: [reviewRow], total: 1 };
    },
    async createReview() {
      return reviewRow;
    },
    async updateMyReview() {
      return reviewRow;
    },
    async deleteMyReview() {
      return true;
    },
    ...overrides
  };
}

test('review GET uses cached summary and still returns paginated review rows', async () => {
  const calls = [];
  const redisClient = {
    isReady: true,
    async get(key) {
      calls.push(['get', key]);
      return JSON.stringify({
        avgRating: 4.5,
        totalReviews: 2,
        attendanceRate: 50
      });
    },
    async setEx() {
      assert.fail('a cache hit must not rewrite the summary');
    }
  };
  const repository = createRepository({
    async getReviewSummary() {
      assert.fail('a cache hit must not query the aggregate');
    },
    async listReviews(subjectId, offset, limit) {
      calls.push(['list', subjectId, offset, limit]);
      return { rows: [reviewRow], total: 21 };
    }
  });

  const result = await createService({ repository, redisClient })
    .getReviews('7', 2, 20);

  assert.deepEqual(calls, [
    ['get', 'review:subject:7:summary'],
    ['list', '7', 20, 20]
  ]);
  assert.deepEqual(result.summary, {
    avgRating: 4.5,
    totalReviews: 2,
    attendanceRate: 50
  });
  assert.equal(result.reviews[0].id, 'rev_18');
  assert.equal(result.reviews[0].userId, 'usr_42');
  assert.equal(result.reviews[0].authorName, 'Nguyen Van A');
  assert.equal(result.reviews[0].authorUniversity, 'UIT - VNUHCM');
  assert.deepEqual(result.pagination, {
    page: 2,
    limit: 20,
    total: 21,
    totalPages: 2
  });
  assert.equal(result.cacheStatus, 'HIT');
});

test('review GET computes and caches a summary on a cache miss', async () => {
  const writes = [];
  const redisClient = {
    isReady: true,
    async get() {
      return null;
    },
    async setEx(key, ttl, payload) {
      writes.push({ key, ttl, payload: JSON.parse(payload) });
    }
  };
  const repository = createRepository({
    async getReviewSummary(subjectId) {
      assert.equal(subjectId, '7');
      return { avg_rating: '4.25', total_reviews: '4', attendance_rate: '75.5' };
    }
  });

  const result = await createService({ repository, redisClient })
    .getReviews('7', 1, 20);

  assert.deepEqual(result.summary, {
    avgRating: 4.25,
    totalReviews: 4,
    attendanceRate: 75.5
  });
  assert.equal(result.cacheStatus, 'MISS');
  assert.deepEqual(writes, [{
    key: 'review:subject:7:summary',
    ttl: 1800,
    payload: result.summary
  }]);
});

test('missing subject returns 404 before using an existing summary cache entry', async () => {
  let summaryReads = 0;
  const redisClient = {
    isReady: true,
    async get() {
      return JSON.stringify({ avgRating: 5, totalReviews: 1, attendanceRate: 100 });
    }
  };
  const repository = createRepository({
    async findSubject() {
      return null;
    },
    async getReviewSummary() {
      summaryReads += 1;
      return null;
    }
  });

  await assert.rejects(
    createService({ repository, redisClient }).getReviews('999', 1, 20),
    error => error instanceof AppError && error.status === 404
  );
  assert.equal(summaryReads, 0);
});

test('Redis read errors fall back to MySQL and report a cache miss', async () => {
  const originalError = console.error;
  const loggedErrors = [];
  console.error = (...args) => loggedErrors.push(args);
  try {
    const repository = createRepository();
    const service = createService({
      repository,
      redisClient: {
        isReady: true,
        async get() {
          throw new Error('Redis unavailable');
        },
        async setEx() {
          throw new Error('Redis unavailable');
        }
      }
    });

    const result = await service.getReviews('7', 1, 20);
    assert.equal(result.summary.avgRating, 5);
    assert.equal(result.cacheStatus, 'MISS');
    assert.equal(loggedErrors.length, 2);
  } finally {
    console.error = originalError;
  }
});

test('duplicate review creation returns a clear conflict and does not invalidate cache', async () => {
  let invalidated = false;
  const repository = createRepository({
    async createReview() {
      const error = new Error('Duplicate entry for uq_course_reviews_user_subject');
      error.code = 'ER_DUP_ENTRY';
      throw error;
    }
  });
  const redisClient = {
    isReady: true,
    async del() {
      invalidated = true;
    }
  };

  await assert.rejects(
    createService({ repository, redisClient }).createReview('42', '7', {
      rating: 5,
      difficulty: 3,
      attendanceRequired: true,
      content: 'Good course'
    }),
    error => error instanceof AppError && error.status === 409
  );
  assert.equal(invalidated, false);
});

test('review updates and deletes are scoped to the caller and invalidate the summary', async () => {
  const mutations = [];
  const invalidations = [];
  const repository = createRepository({
    async updateMyReview(userId, subjectId, input) {
      mutations.push(['update', userId, subjectId, input]);
      return reviewRow;
    },
    async deleteMyReview(userId, subjectId) {
      mutations.push(['delete', userId, subjectId]);
      return true;
    }
  });
  const service = createService({
    repository,
    redisClient: {
      isReady: true,
      async del(key) {
        invalidations.push(key);
      }
    }
  });

  await service.updateMyReview('42', '7', { rating: 4 });
  await service.deleteMyReview('42', '7');

  assert.deepEqual(mutations, [
    ['update', '42', '7', { rating: 4 }],
    ['delete', '42', '7']
  ]);
  assert.deepEqual(invalidations, [
    'review:subject:7:summary',
    'review:subject:7:summary'
  ]);
});

test('latest class post page uses the class cache and maps public IDs', async () => {
  const cachedPage = {
    posts: [{
      id: 'pst_51',
      subjectId: 'sub_7',
      classCode: '23DTH1A',
      userId: 'usr_42',
      title: 'Find a project group',
      content: 'Looking for two teammates.',
      upvoteCount: 3,
      createdAt: '2026-11-18T10:00:00.000Z'
    }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
  };
  const redisClient = {
    isReady: true,
    async get(key) {
      assert.equal(key, 'qa:class:23DTH1A:latest');
      return JSON.stringify(cachedPage);
    }
  };
  const repository = createRepository({
    async listPosts() {
      assert.fail('a latest-post cache hit must not query MySQL');
    }
  });
  const service = createService({ repository, redisClient });
  assert.equal(typeof service.getPosts, 'function');

  const result = await service.getPosts('23DTH1A', 1, 20);

  assert.deepEqual(result.posts, cachedPage.posts);
  assert.deepEqual(result.pagination, cachedPage.pagination);
  assert.equal(result.cacheStatus, 'HIT');
});

test('latest class post cache miss stores page one for five minutes', async () => {
  const writes = [];
  const repository = createRepository({
    async listPosts(classCode, offset, limit) {
      assert.deepEqual([classCode, offset, limit], ['23DTH1A', 0, 20]);
      return { rows: [postRow], total: 1 };
    }
  });
  const service = createService({
    repository,
    redisClient: {
      isReady: true,
      async get() {
        return null;
      },
      async setEx(key, ttl, payload) {
        writes.push({ key, ttl, payload: JSON.parse(payload) });
      }
    }
  });

  const result = await service.getPosts('23DTH1A', 1, 20);

  assert.equal(result.cacheStatus, 'MISS');
  assert.equal(result.posts[0].id, 'pst_51');
  assert.equal(result.posts[0].authorName, 'Nguyen Van A');
  assert.equal(result.posts[0].authorUniversity, 'UIT - VNUHCM');
  assert.deepEqual(writes, [{
    key: 'qa:class:23DTH1A:latest',
    ttl: 300,
    payload: {
      posts: result.posts,
      pagination: result.pagination
    }
  }]);
});

test('Redis latest-post read and write errors fall back to MySQL', async () => {
  const originalError = console.error;
  const loggedErrors = [];
  console.error = (...args) => loggedErrors.push(args);
  try {
    const repository = createRepository({
      async listPosts() {
        return { rows: [postRow], total: 1 };
      }
    });
    const service = createService({
      repository,
      redisClient: {
        isReady: true,
        async get() {
          throw new Error('Redis unavailable');
        },
        async setEx() {
          throw new Error('Redis unavailable');
        }
      }
    });

    const result = await service.getPosts('23DTH1A', 1, 20);
    assert.equal(result.cacheStatus, 'MISS');
    assert.equal(result.posts[0].id, 'pst_51');
    assert.equal(loggedErrors.length, 2);
  } finally {
    console.error = originalError;
  }
});

test('non-default class post pages bypass the latest-post cache', async () => {
  const calls = [];
  const redisClient = {
    isReady: true,
    async get() {
      assert.fail('non-default pages must bypass the latest-post cache');
    },
    async setEx() {
      assert.fail('non-default pages must not populate the latest-post cache');
    }
  };
  const repository = createRepository({
    async listPosts(classCode, offset, limit) {
      calls.push([classCode, offset, limit]);
      return { rows: [postRow], total: 21 };
    }
  });
  const service = createService({ repository, redisClient });
  assert.equal(typeof service.getPosts, 'function');

  const result = await service.getPosts(' 23dth1a ', 2, 20);

  assert.deepEqual(calls, [['23DTH1A', 20, 20]]);
  assert.equal(result.posts[0].id, 'pst_51');
  assert.equal(result.cacheStatus, 'MISS');
});

test('creating and deleting a class post invalidates its latest cache', async () => {
  const writes = [];
  const invalidations = [];
  const repository = createRepository({
    async createPost(userId, classCode, input) {
      writes.push([userId, classCode, input]);
      return postRow;
    },
    async deleteMyPost(userId, postId) {
      writes.push(['delete', userId, postId]);
      return '23DTH1A';
    }
  });
  const service = createService({
    repository,
    redisClient: {
      isReady: true,
      async del(key) {
        invalidations.push(key);
      }
    }
  });
  assert.equal(typeof service.createPost, 'function');
  assert.equal(typeof service.deleteMyPost, 'function');

  await service.createPost('42', '23DTH1A', {
    subjectId: '7',
    title: 'Find a project group',
    content: 'Looking for two teammates.'
  });
  await service.deleteMyPost('42', '51');

  assert.deepEqual(writes, [
    ['42', '23DTH1A', {
      subjectId: '7',
      title: 'Find a project group',
      content: 'Looking for two teammates.'
    }],
    ['delete', '42', '51']
  ]);
  assert.deepEqual(invalidations, [
    'qa:class:23DTH1A:latest',
    'qa:class:23DTH1A:latest'
  ]);
});

test('a class code mapped to another subject cannot create a post', async () => {
  const repository = createRepository({
    async createPost() {
      throw new AppError(409, 'CLASS_SUBJECT_CONFLICT', 'Class code belongs to another subject.');
    }
  });
  const service = createService({ repository });
  assert.equal(typeof service.createPost, 'function');

  await assert.rejects(
    service.createPost('42', '23DTH1A', {
      subjectId: '7',
      title: 'Question',
      content: 'Question content'
    }),
    error => error instanceof AppError && error.status === 409
  );
});

test('comment creation for an unknown post returns 404 without inserting', async () => {
  let inserted = false;
  const repository = createRepository({
    async findPost() {
      return null;
    },
    async createComment() {
      inserted = true;
      return commentRow;
    }
  });
  const service = createService({ repository });
  assert.equal(typeof service.createComment, 'function');

  await assert.rejects(
    service.createComment('42', '51', { content: 'I can join.' }),
    error => error instanceof AppError && error.status === 404
  );
  assert.equal(inserted, false);
});

test('post vote toggles return the count and invalidate the class cache', async () => {
  const invalidations = [];
  const repository = createRepository({
    async togglePostVote(userId, postId) {
      assert.deepEqual([userId, postId], ['42', '51']);
      return { upvoted: true, upvoteCount: 4, classCode: '23DTH1A' };
    },
    async toggleCommentVote() {
      return { upvoted: true, upvoteCount: 2 };
    }
  });
  const service = createService({
    repository,
    redisClient: {
      isReady: true,
      async del(key) {
        invalidations.push(key);
      }
    }
  });
  assert.equal(typeof service.togglePostVote, 'function');
  assert.equal(typeof service.toggleCommentVote, 'function');

  assert.deepEqual(await service.togglePostVote('42', '51'), {
    upvoted: true,
    upvoteCount: 4
  });
  assert.deepEqual(await service.toggleCommentVote('42', '61'), {
    upvoted: true,
    upvoteCount: 2
  });
  assert.deepEqual(invalidations, ['qa:class:23DTH1A:latest']);
});

test('getComments and createComment map authorName and authorUniversity from joined user rows', async () => {
  const repository = createRepository({
    async findPost() {
      return postRow;
    },
    async listComments() {
      return { rows: [commentRow], total: 1 };
    },
    async createComment() {
      return commentRow;
    }
  });
  const service = createService({ repository });

  const listed = await service.getComments('51', 1, 20);
  assert.equal(listed.comments[0].id, 'cmt_61');
  assert.equal(listed.comments[0].authorName, 'Tran Thi B');
  assert.equal(listed.comments[0].authorUniversity, 'HCMUT');

  const created = await service.createComment('42', '51', { content: 'I can join.' });
  assert.equal(created.id, 'cmt_61');
  assert.equal(created.authorName, 'Tran Thi B');
  assert.equal(created.authorUniversity, 'HCMUT');
});
