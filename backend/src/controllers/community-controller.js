const { asyncHandler } = require('../utils/async-handler');
const { toDatabaseId } = require('../utils/public-id');

function createCommunityController(communityService) {
  const getReviews = asyncHandler(async (req, res) => {
    const result = await communityService.getReviews(
      toDatabaseId(req.params.subjectId, 'subject'),
      req.query.page,
      req.query.limit,
      req.user.id
    );
    const { cacheStatus, ...data } = result;
    res.set('X-Cache', cacheStatus);
    res.json({ data });
  });

  const createReview = asyncHandler(async (req, res) => {
    const data = await communityService.createReview(
      req.user.id,
      toDatabaseId(req.params.subjectId, 'subject'),
      req.body
    );
    res.status(201).json({ data });
  });

  const updateMyReview = asyncHandler(async (req, res) => {
    const data = await communityService.updateMyReview(
      req.user.id,
      toDatabaseId(req.params.subjectId, 'subject'),
      req.body
    );
    res.json({ data });
  });

  const deleteMyReview = asyncHandler(async (req, res) => {
    const data = await communityService.deleteMyReview(
      req.user.id,
      toDatabaseId(req.params.subjectId, 'subject')
    );
    res.json({ data });
  });

  const getPosts = asyncHandler(async (req, res) => {
    const result = await communityService.getPosts(
      req.params.classCode,
      req.query.page,
      req.query.limit
    );
    const { cacheStatus, ...data } = result;
    res.set('X-Cache', cacheStatus);
    res.json({ data });
  });

  const createPost = asyncHandler(async (req, res) => {
    const data = await communityService.createPost(
      req.user.id,
      req.params.classCode,
      {
        ...req.body,
        subjectId: toDatabaseId(req.body.subjectId, 'subject')
      }
    );
    res.status(201).json({ data });
  });

  const deleteMyPost = asyncHandler(async (req, res) => {
    const data = await communityService.deleteMyPost(
      req.user.id,
      toDatabaseId(req.params.postId, 'post')
    );
    res.json({ data });
  });

  const getComments = asyncHandler(async (req, res) => {
    const data = await communityService.getComments(
      toDatabaseId(req.params.postId, 'post'),
      req.query.page,
      req.query.limit
    );
    res.json({ data });
  });

  const createComment = asyncHandler(async (req, res) => {
    const data = await communityService.createComment(
      req.user.id,
      toDatabaseId(req.params.postId, 'post'),
      req.body
    );
    res.status(201).json({ data });
  });

  const togglePostVote = asyncHandler(async (req, res) => {
    const data = await communityService.togglePostVote(
      req.user.id,
      toDatabaseId(req.params.postId, 'post')
    );
    res.json({ data });
  });

  const toggleCommentVote = asyncHandler(async (req, res) => {
    const data = await communityService.toggleCommentVote(
      req.user.id,
      toDatabaseId(req.params.commentId, 'comment')
    );
    res.json({ data });
  });

  return {
    getReviews,
    createReview,
    updateMyReview,
    deleteMyReview,
    getPosts,
    createPost,
    deleteMyPost,
    getComments,
    createComment,
    togglePostVote,
    toggleCommentVote
  };
}

module.exports = { createCommunityController };
