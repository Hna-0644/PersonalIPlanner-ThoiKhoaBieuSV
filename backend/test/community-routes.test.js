const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { AppError } = require('../src/utils/app-error');
const { createAuthenticate } = require('../src/middleware/authenticate');
const { errorHandler } = require('../src/middleware/error-handler');
const { createCommunityRouter } = require('../src/routes/community-routes');

const JWT_SECRET = 'community-route-test-secret';

function createApp(service, options) {
  const app = express();
  app.use(express.json());
  app.use('/api', createCommunityRouter(
    service,
    createAuthenticate(JWT_SECRET),
    options
  ));
  app.use(errorHandler);
  return app;
}

function authHeader(userId = 'usr_7') {
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
    getReviews: async () => ({
      summary: { avgRating: 4.5, totalReviews: 2, attendanceRate: 50 },
      reviews: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      cacheStatus: 'MISS'
    }),
    createReview: async () => ({ id: 'rev_9' }),
    updateMyReview: async () => ({ id: 'rev_9' }),
    deleteMyReview: async () => ({ deleted: true }),
    getPosts: async () => ({
      posts: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      cacheStatus: 'MISS'
    }),
    createPost: async () => ({ id: 'pst_10' }),
    deleteMyPost: async () => ({ id: 'pst_10', deleted: true }),
    getComments: async () => ({
      comments: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 }
    }),
    createComment: async () => ({ id: 'cmt_11' }),
    togglePostVote: async () => ({ upvoted: true, upvoteCount: 1 }),
    toggleCommentVote: async () => ({ upvoted: true, upvoteCount: 1 }),
    ...overrides
  };
}

test('Community routes require a valid authenticated user', async () => {
  const response = await request(createApp(createService()))
    .get('/api/courses/sub_41/reviews');

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHENTICATED');
});

test('review creation rejects invalid input before calling the service', async () => {
  let called = false;
  const app = createApp(createService({
    async createReview() {
      called = true;
    }
  }));

  const response = await request(app)
    .post('/api/courses/sub_41/reviews')
    .set('Authorization', authHeader())
    .send({ rating: 6, difficulty: 3, attendanceRequired: true, content: 'Too high' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  assert.equal(called, false);
});

test('duplicate review errors preserve the service conflict response', async () => {
  const app = createApp(createService({
    async createReview() {
      throw new AppError(409, 'REVIEW_ALREADY_EXISTS', 'Bạn đã đánh giá môn học này.');
    }
  }));

  const response = await request(app)
    .post('/api/courses/sub_41/reviews')
    .set('Authorization', authHeader())
    .send({ rating: 4, difficulty: 3, attendanceRequired: false, content: 'Useful course' });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'REVIEW_ALREADY_EXISTS');
});

test('review listing forwards pagination, converts subject ID, and reports X-Cache', async () => {
  let received;
  const app = createApp(createService({
    async getReviews(...args) {
      received = args;
      return {
        summary: { avgRating: 4.5, totalReviews: 2, attendanceRate: 50 },
        reviews: [],
        pagination: { page: 2, limit: 5, total: 7, totalPages: 2 },
        cacheStatus: 'HIT'
      };
    }
  }));

  const response = await request(app)
    .get('/api/courses/sub_41/reviews?page=2&limit=5')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.equal(response.headers['x-cache'], 'HIT');
  assert.deepEqual(received, ['41', 2, 5]);
  assert.deepEqual(response.body.data.pagination, {
    page: 2, limit: 5, total: 7, totalPages: 2
  });
  assert.equal(Object.hasOwn(response.body.data, 'cacheStatus'), false);
});

test('class post listing reports X-Cache MISS and forwards pagination', async () => {
  let received;
  const app = createApp(createService({
    async getPosts(...args) {
      received = args;
      return {
        posts: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        cacheStatus: 'MISS'
      };
    }
  }));

  const response = await request(app)
    .get('/api/classes/23DTH1A/posts')
    .set('Authorization', authHeader());

  assert.equal(response.status, 200);
  assert.equal(response.headers['x-cache'], 'MISS');
  assert.deepEqual(received, ['23DTH1A', 1, 20]);
});

test('review writes use the authenticated database user and path subject', async () => {
  let received;
  const app = createApp(createService({
    async createReview(...args) {
      received = args;
      return { id: 'rev_9' };
    }
  }));

  const response = await request(app)
    .post('/api/courses/sub_41/reviews')
    .set('Authorization', authHeader('usr_17'))
    .send({ rating: 4, difficulty: 3, attendanceRequired: true, content: 'Helpful' });

  assert.equal(response.status, 201);
  assert.deepEqual(received, [
    '17',
    '41',
    { rating: 4, difficulty: 3, attendanceRequired: true, content: 'Helpful' }
  ]);
});

test('create rate limit is shared across write endpoints but isolated per user', async () => {
  const app = createApp(createService(), {
    rateLimitWindowMs: 60000,
    createRateLimitMax: 1
  });
  const firstUser = authHeader('usr_17');
  const secondUser = authHeader('usr_18');
  const review = () => request(app)
    .post('/api/courses/sub_41/reviews')
    .set('Authorization', firstUser)
    .send({ rating: 4, difficulty: 3, attendanceRequired: true, content: 'Helpful' });
  const comment = token => request(app)
    .post('/api/posts/pst_10/comments')
    .set('Authorization', token)
    .send({ content: 'Thanks' });

  assert.equal((await review()).status, 201);
  const limited = await comment(firstUser);
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error.code, 'RATE_LIMIT_EXCEEDED');
  assert.equal((await comment(secondUser)).status, 201);
});

test('vote rate limit is shared across vote endpoints and isolated per user', async () => {
  const app = createApp(createService(), {
    rateLimitWindowMs: 60000,
    voteRateLimitMax: 1
  });
  const firstUser = authHeader('usr_17');
  const firstVote = await request(app)
    .post('/api/posts/pst_10/upvote')
    .set('Authorization', firstUser);
  const limitedVote = await request(app)
    .post('/api/comments/cmt_11/upvote')
    .set('Authorization', firstUser);
  const otherUserVote = await request(app)
    .post('/api/posts/pst_10/upvote')
    .set('Authorization', authHeader('usr_18'));

  assert.equal(firstVote.status, 200);
  assert.equal(limitedVote.status, 429);
  assert.equal(otherUserVote.status, 200);
});

test('deleting a post uses the documented /me path and authenticated owner', async () => {
  let received;
  const app = createApp(createService({
    async deleteMyPost(...args) {
      received = args;
      return { id: 'pst_10', deleted: true };
    }
  }));

  const response = await request(app)
    .delete('/api/posts/pst_10/me')
    .set('Authorization', authHeader('usr_17'));

  assert.equal(response.status, 200);
  assert.deepEqual(received, ['17', '10']);
});
