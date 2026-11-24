const { AppError } = require('../utils/app-error');
const { toPublicId } = require('../utils/public-id');
const { toIsoUtcString } = require('../utils/timezone');
const { createCommunityRepository } = require('../repositories/community-repository');

const REVIEW_SUMMARY_TTL_SECONDS = 1800;
const CLASS_LATEST_POSTS_TTL_SECONDS = 300;

function createCommunityService({ pool, redisClient, repository } = {}) {
  const repo = repository || createCommunityRepository({ pool });

  async function requireUserUniversity(userId) {
    if (!userId) return null;
    if (typeof repo.findUserUniversity !== 'function') return null;
    const uni = await repo.findUserUniversity(userId);
    if (!uni || !String(uni).trim()) {
      throw new AppError(
        422,
        'UNIVERSITY_REQUIRED',
        'Vui lòng cập nhật thông tin Trường Cao đẳng / Đại học trong hồ sơ trước khi xem hoặc đánh giá môn học.'
      );
    }
    return String(uni).trim();
  }

  async function getReviews(subjectId, page = 1, limit = 20, userId = null) {
    await requireSubject(subjectId);
    const university = userId ? await requireUserUniversity(userId) : null;
    const cacheKey = getReviewSummaryCacheKey(subjectId, university);
    const cachedSummary = await readReviewSummary(cacheKey);
    const offset = (page - 1) * limit;
    const { rows, total } = university
      ? await repo.listReviews(subjectId, offset, limit, university)
      : await repo.listReviews(subjectId, offset, limit);
    let summary;
    let cacheStatus;

    if (cachedSummary.hit) {
      summary = cachedSummary.value;
      cacheStatus = 'HIT';
    } else {
      const rawSummary = university
        ? await repo.getReviewSummary(subjectId, university)
        : await repo.getReviewSummary(subjectId);
      summary = normalizeReviewSummary(rawSummary);
      cacheStatus = 'MISS';
      await writeReviewSummary(cacheKey, summary);
    }

    const response = {
      summary,
      reviews: rows.map(mapReview),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      },
      cacheStatus
    };
    if (university) {
      return { university, ...response };
    }
    return response;
  }

  async function createReview(userId, subjectId, input) {
    await requireSubject(subjectId);
    const university = typeof repo.findUserUniversity === 'function'
      ? await requireUserUniversity(userId)
      : null;
    let row;
    try {
      row = await repo.createReview(userId, subjectId, input);
    } catch (error) {
      if (isDuplicateReviewError(error)) {
        throw new AppError(409, 'REVIEW_ALREADY_EXISTS', 'Bạn đã đánh giá môn học này.');
      }
      throw error;
    }

    await invalidateReviewSummary(subjectId);
    if (university) {
      await invalidateReviewSummary(subjectId, university);
    }
    return mapReview(row);
  }

  async function updateMyReview(userId, subjectId, input) {
    await requireSubject(subjectId);
    const university = typeof repo.findUserUniversity === 'function'
      ? await requireUserUniversity(userId)
      : null;
    const row = await repo.updateMyReview(userId, subjectId, input);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đánh giá của bạn cho môn học này.');
    }

    await invalidateReviewSummary(subjectId);
    if (university) {
      await invalidateReviewSummary(subjectId, university);
    }
    return mapReview(row);
  }

  async function deleteMyReview(userId, subjectId) {
    await requireSubject(subjectId);
    const university = typeof repo.findUserUniversity === 'function'
      ? await requireUserUniversity(userId)
      : null;
    const deleted = await repo.deleteMyReview(userId, subjectId);
    if (!deleted) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đánh giá của bạn cho môn học này.');
    }

    await invalidateReviewSummary(subjectId);
    if (university) {
      await invalidateReviewSummary(subjectId, university);
    }
    return {
      subjectId: toPublicId('subject', subjectId),
      deleted: true
    };
  }

  async function getPosts(classCode, page = 1, limit = 20) {
    const normalizedCode = normalizeClassCode(classCode);
    const cacheKey = getLatestPostsCacheKey(normalizedCode);
    const cacheable = page === 1 && limit === 20;
    if (cacheable) {
      const cachedPage = await readLatestPosts(cacheKey);
      if (cachedPage) {
        return { ...cachedPage, cacheStatus: 'HIT' };
      }
    }

    const offset = (page - 1) * limit;
    const { rows, total } = await repo.listPosts(normalizedCode, offset, limit);
    const result = {
      posts: rows.map(mapPost),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
    if (cacheable) {
      await writeLatestPosts(cacheKey, result);
    }
    return { ...result, cacheStatus: 'MISS' };
  }

  async function createPost(userId, classCode, input) {
    await requireSubject(input.subjectId);
    const normalizedCode = normalizeClassCode(classCode);
    const row = await repo.createPost(userId, normalizedCode, input);
    await invalidateLatestPosts(normalizedCode);
    return mapPost(row);
  }

  async function deleteMyPost(userId, postId) {
    const classCode = await repo.deleteMyPost(userId, postId);
    if (!classCode) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy bài viết của bạn.');
    }
    await invalidateLatestPosts(normalizeClassCode(classCode));
    return { id: toPublicId('post', postId), deleted: true };
  }

  async function getComments(postId, page = 1, limit = 20) {
    await requirePost(postId);
    const offset = (page - 1) * limit;
    const { rows, total } = await repo.listComments(postId, offset, limit);
    return {
      comments: rows.map(mapComment),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  async function createComment(userId, postId, input) {
    await requirePost(postId);
    const row = await repo.createComment(userId, postId, input);
    return mapComment(row);
  }

  async function togglePostVote(userId, postId) {
    const result = await repo.togglePostVote(userId, postId);
    await invalidateLatestPosts(normalizeClassCode(result.classCode));
    return {
      upvoted: result.upvoted,
      upvoteCount: Number(result.upvoteCount)
    };
  }

  async function toggleCommentVote(userId, commentId) {
    const result = await repo.toggleCommentVote(userId, commentId);
    return {
      upvoted: result.upvoted,
      upvoteCount: Number(result.upvoteCount)
    };
  }

  async function requireSubject(subjectId) {
    const subject = await repo.findSubject(subjectId);
    if (!subject) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy môn học.');
    }
    return subject;
  }

  async function requirePost(postId) {
    const post = await repo.findPost(postId);
    if (!post) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy bài viết.');
    }
    return post;
  }

  async function readReviewSummary(cacheKey) {
    if (!redisClient || redisClient.isReady === false) {
      return { hit: false, value: null };
    }

    try {
      const raw = await redisClient.get(cacheKey);
      if (raw === null || raw === undefined) {
        return { hit: false, value: null };
      }
      const parsed = JSON.parse(raw);
      if (!isReviewSummary(parsed)) {
        console.error(`Invalid Redis review summary at ${cacheKey}; reading MySQL.`);
        return { hit: false, value: null };
      }
      return { hit: true, value: parsed };
    } catch (error) {
      console.error(`Redis review summary read fallback to MySQL for ${cacheKey}:`, error);
      return { hit: false, value: null };
    }
  }

  async function writeReviewSummary(cacheKey, summary) {
    if (!redisClient || redisClient.isReady === false) return;
    try {
      const payload = JSON.stringify(summary);
      if (typeof redisClient.setEx === 'function') {
        await redisClient.setEx(cacheKey, REVIEW_SUMMARY_TTL_SECONDS, payload);
      } else if (typeof redisClient.set === 'function') {
        await redisClient.set(cacheKey, payload, { EX: REVIEW_SUMMARY_TTL_SECONDS });
      } else {
        console.error(`Redis review summary write skipped for ${cacheKey}: no set operation.`);
      }
    } catch (error) {
      console.error(`Redis review summary write failed for ${cacheKey}:`, error);
    }
  }

  async function invalidateReviewSummary(subjectId, university = null) {
    if (!redisClient) return;
    const cacheKey = getReviewSummaryCacheKey(subjectId, university);
    if (redisClient.isReady === false) {
      console.error(`Redis review summary invalidation skipped for ${cacheKey}: client is not ready.`);
      return;
    }
    try {
      if (typeof redisClient.del !== 'function') {
        console.error(`Redis review summary invalidation skipped for ${cacheKey}: no del operation.`);
        return;
      }
      await redisClient.del(cacheKey);
    } catch (error) {
      console.error(`Redis review summary invalidation failed for ${cacheKey}:`, error);
    }
  }

  async function readLatestPosts(cacheKey) {
    if (!redisClient || redisClient.isReady === false) return null;
    try {
      const raw = await redisClient.get(cacheKey);
      if (raw === null || raw === undefined) return null;
      const parsed = JSON.parse(raw);
      if (!isLatestPostsPage(parsed)) {
        console.error(`Invalid Redis latest-post page at ${cacheKey}; reading MySQL.`);
        return null;
      }
      return parsed;
    } catch (error) {
      console.error(`Redis latest-post read fallback to MySQL for ${cacheKey}:`, error);
      return null;
    }
  }

  async function writeLatestPosts(cacheKey, page) {
    if (!redisClient || redisClient.isReady === false) return;
    try {
      const payload = JSON.stringify(page);
      if (typeof redisClient.setEx === 'function') {
        await redisClient.setEx(cacheKey, CLASS_LATEST_POSTS_TTL_SECONDS, payload);
      } else if (typeof redisClient.set === 'function') {
        await redisClient.set(cacheKey, payload, { EX: CLASS_LATEST_POSTS_TTL_SECONDS });
      } else {
        console.error(`Redis latest-post write skipped for ${cacheKey}: no set operation.`);
      }
    } catch (error) {
      console.error(`Redis latest-post write failed for ${cacheKey}:`, error);
    }
  }

  async function invalidateLatestPosts(classCode) {
    if (!redisClient) return;
    const cacheKey = getLatestPostsCacheKey(classCode);
    if (redisClient.isReady === false) {
      console.error(`Redis latest-post invalidation skipped for ${cacheKey}: client is not ready.`);
      return;
    }
    try {
      if (typeof redisClient.del !== 'function') {
        console.error(`Redis latest-post invalidation skipped for ${cacheKey}: no del operation.`);
        return;
      }
      await redisClient.del(cacheKey);
    } catch (error) {
      console.error(`Redis latest-post invalidation failed for ${cacheKey}:`, error);
    }
  }

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

function normalizeUniversityKey(university) {
  return String(university || '').trim().toLowerCase() || 'all';
}

function getReviewSummaryCacheKey(subjectId, university = null) {
  if (university && String(university).trim()) {
    return `review:subject:${subjectId}:uni:${normalizeUniversityKey(university)}:summary`;
  }
  return `review:subject:${subjectId}:summary`;
}

function getLatestPostsCacheKey(classCode) {
  return `qa:class:${classCode}:latest`;
}

function normalizeClassCode(classCode) {
  return String(classCode).trim().toUpperCase();
}

function isLatestPostsPage(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    Array.isArray(value.posts) &&
    value.pagination &&
    value.pagination.page === 1 &&
    value.pagination.limit === 20 &&
    Number.isInteger(value.pagination.total) &&
    Number.isInteger(value.pagination.totalPages)
  );
}

function isReviewSummary(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value.avgRating === null || Number.isFinite(value.avgRating)) &&
    Number.isInteger(value.totalReviews) &&
    value.totalReviews >= 0 &&
    Number.isFinite(value.attendanceRate)
  );
}

function normalizeReviewSummary(row = {}) {
  const average = row.avg_rating === null || row.avg_rating === undefined
    ? null
    : Number(row.avg_rating);
  const totalReviews = Number(row.total_reviews || 0);
  const attendanceRate = Number(row.attendance_rate || 0);
  return {
    avgRating: Number.isFinite(average) ? average : null,
    totalReviews: Number.isFinite(totalReviews) ? totalReviews : 0,
    attendanceRate: Number.isFinite(attendanceRate) ? attendanceRate : 0
  };
}

function isDuplicateReviewError(error) {
  if (!error || error.code !== 'ER_DUP_ENTRY') return false;
  const message = `${error.message || ''} ${error.sqlMessage || ''}`;
  return message.includes('uq_course_reviews_user_subject');
}

function mapReview(row) {
  return {
    id: toPublicId('review', row.id),
    subjectId: toPublicId('subject', row.subject_id),
    userId: toPublicId('user', row.user_id),
    authorName: row.author_name || null,
    authorUniversity: row.author_university || null,
    lecturerName: row.lecturer_name,
    rating: Number(row.rating),
    difficulty: Number(row.difficulty),
    attendanceRequired: Boolean(row.attendance_required),
    gradingNotes: row.grading_notes,
    materialsNotes: row.materials_notes,
    content: row.content,
    createdAt: toIsoUtcString(row.created_at),
    updatedAt: toIsoUtcString(row.updated_at)
  };
}

function mapPost(row) {
  return {
    id: toPublicId('post', row.id),
    subjectId: toPublicId('subject', row.subject_id),
    classCode: row.class_code,
    userId: toPublicId('user', row.user_id),
    authorName: row.author_name || null,
    authorUniversity: row.author_university || null,
    title: row.title,
    content: row.content,
    upvoteCount: Number(row.upvote_count),
    createdAt: toIsoUtcString(row.created_at)
  };
}

function mapComment(row) {
  return {
    id: toPublicId('comment', row.id),
    postId: toPublicId('post', row.post_id),
    userId: toPublicId('user', row.user_id),
    authorName: row.author_name || null,
    authorUniversity: row.author_university || null,
    content: row.content,
    upvoteCount: Number(row.upvote_count),
    createdAt: toIsoUtcString(row.created_at)
  };
}

module.exports = {
  createCommunityService,
  getReviewSummaryCacheKey,
  getLatestPostsCacheKey,
  normalizeReviewSummary,
  mapReview,
  mapPost,
  mapComment
};
