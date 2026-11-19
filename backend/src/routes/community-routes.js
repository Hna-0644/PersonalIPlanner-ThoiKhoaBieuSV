const express = require('express');
const { validate } = require('../middleware/validate');
const { createRateLimiter } = require('../middleware/rate-limit');
const {
  courseReviewCreateSchema,
  courseReviewUpdateSchema,
  classPostCreateSchema,
  postCommentCreateSchema,
  communityPaginationSchema,
  subjectParamsSchema,
  classPostsParamsSchema,
  postParamsSchema,
  commentParamsSchema
} = require('../schemas/community-schemas');
const { createCommunityController } = require('../controllers/community-controller');

function createCommunityRouter(communityService, authenticate, options = {}) {
  const router = express.Router();
  const controller = createCommunityController(communityService);
  const windowMs = options.rateLimitWindowMs || 60 * 1000;
  const createRateLimit = createRateLimiter({
    windowMs,
    maxRequests: options.createRateLimitMax || 5
  });
  const voteRateLimit = createRateLimiter({
    windowMs,
    maxRequests: options.voteRateLimitMax || 30
  });

  router.get(
    '/courses/:subjectId/reviews',
    authenticate,
    validate(subjectParamsSchema, 'params'),
    validate(communityPaginationSchema, 'query'),
    controller.getReviews
  );
  router.post(
    '/courses/:subjectId/reviews',
    authenticate,
    createRateLimit,
    validate(subjectParamsSchema, 'params'),
    validate(courseReviewCreateSchema),
    controller.createReview
  );
  router.put(
    '/courses/:subjectId/reviews/me',
    authenticate,
    validate(subjectParamsSchema, 'params'),
    validate(courseReviewUpdateSchema),
    controller.updateMyReview
  );
  router.delete(
    '/courses/:subjectId/reviews/me',
    authenticate,
    validate(subjectParamsSchema, 'params'),
    controller.deleteMyReview
  );

  router.get(
    '/classes/:classCode/posts',
    authenticate,
    validate(classPostsParamsSchema, 'params'),
    validate(communityPaginationSchema, 'query'),
    controller.getPosts
  );
  router.post(
    '/classes/:classCode/posts',
    authenticate,
    createRateLimit,
    validate(classPostsParamsSchema, 'params'),
    validate(classPostCreateSchema),
    controller.createPost
  );
  router.delete(
    '/posts/:postId/me',
    authenticate,
    validate(postParamsSchema, 'params'),
    controller.deleteMyPost
  );
  router.get(
    '/posts/:postId/comments',
    authenticate,
    validate(postParamsSchema, 'params'),
    validate(communityPaginationSchema, 'query'),
    controller.getComments
  );
  router.post(
    '/posts/:postId/comments',
    authenticate,
    createRateLimit,
    validate(postParamsSchema, 'params'),
    validate(postCommentCreateSchema),
    controller.createComment
  );
  router.post(
    '/posts/:postId/upvote',
    authenticate,
    voteRateLimit,
    validate(postParamsSchema, 'params'),
    controller.togglePostVote
  );
  router.post(
    '/comments/:commentId/upvote',
    authenticate,
    voteRateLimit,
    validate(commentParamsSchema, 'params'),
    controller.toggleCommentVote
  );

  return router;
}

module.exports = { createCommunityRouter };
