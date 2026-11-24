const { AppError } = require('../utils/app-error');

const REVIEW_COLUMNS = `
  course_reviews.id,
  course_reviews.subject_id,
  course_reviews.user_id,
  course_reviews.lecturer_name,
  course_reviews.rating,
  course_reviews.difficulty,
  course_reviews.attendance_required,
  course_reviews.grading_notes,
  course_reviews.materials_notes,
  course_reviews.content,
  course_reviews.created_at,
  course_reviews.updated_at,
  u.full_name AS author_name,
  u.university AS author_university
`;

const POST_COLUMNS = `
  class_posts.id,
  class_posts.subject_id,
  class_posts.class_code,
  class_posts.user_id,
  class_posts.title,
  class_posts.content,
  class_posts.upvote_count,
  class_posts.created_at
`;

const POST_WITH_AUTHOR_COLUMNS = `
  ${POST_COLUMNS},
  u.full_name AS author_name,
  u.university AS author_university
`;

const COMMENT_COLUMNS = `
  post_comments.id,
  post_comments.post_id,
  post_comments.user_id,
  post_comments.content,
  post_comments.upvote_count,
  post_comments.created_at,
  u.full_name AS author_name,
  u.university AS author_university
`;

const REVIEW_UPDATE_COLUMNS = {
  lecturerName: 'lecturer_name',
  rating: 'rating',
  difficulty: 'difficulty',
  attendanceRequired: 'attendance_required',
  gradingNotes: 'grading_notes',
  materialsNotes: 'materials_notes',
  content: 'content'
};

function createCommunityRepository({ pool }) {
  async function findSubject(subjectId) {
    const [rows] = await pool.execute(
      `SELECT id, course_code, subject_name, school_code, created_at
       FROM subjects
       WHERE id = ?
       LIMIT 1`,
      [subjectId]
    );
    return rows[0] || null;
  }

  async function findPost(postId) {
    const [rows] = await pool.execute(
      `SELECT ${POST_COLUMNS}
       FROM class_posts
       WHERE id = ?
       LIMIT 1`,
      [postId]
    );
    return rows[0] || null;
  }

  async function getReviewSummary(subjectId) {
    const [rows] = await pool.execute(
      `SELECT AVG(rating) AS avg_rating,
              COUNT(*) AS total_reviews,
              COALESCE(AVG(attendance_required) * 100, 0) AS attendance_rate
       FROM course_reviews
       WHERE subject_id = ?`,
      [subjectId]
    );
    return rows[0] || {
      avg_rating: null,
      total_reviews: 0,
      attendance_rate: 0
    };
  }

  async function listReviews(subjectId, offset, limit) {
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) AS total FROM course_reviews WHERE subject_id = ?',
      [subjectId]
    );
    const [rows] = await pool.execute(
      `SELECT ${REVIEW_COLUMNS}
       FROM course_reviews
       LEFT JOIN users u ON u.id = course_reviews.user_id
       WHERE course_reviews.subject_id = ?
       ORDER BY course_reviews.created_at DESC, course_reviews.id DESC
       LIMIT ? OFFSET ?`,
      [subjectId, String(limit), String(offset)]
    );
    return { rows, total: Number(countRows[0]?.total || 0) };
  }

  async function createReview(userId, subjectId, input) {
    const [result] = await pool.execute(
      `INSERT INTO course_reviews (
         subject_id, user_id, lecturer_name, rating, difficulty,
         attendance_required, grading_notes, materials_notes, content
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subjectId,
        userId,
        input.lecturerName ?? null,
        input.rating,
        input.difficulty,
        input.attendanceRequired,
        input.gradingNotes ?? null,
        input.materialsNotes ?? null,
        input.content
      ]
    );
    const row = await findReviewById(result.insertId);
    if (!row) {
      throw new Error('Review was inserted but could not be read back.');
    }
    return row;
  }

  async function updateMyReview(userId, subjectId, input) {
    const entries = Object.entries(input)
      .filter(([field]) => Object.hasOwn(REVIEW_UPDATE_COLUMNS, field));
    if (entries.length === 0) return findReviewByOwner(userId, subjectId);

    const assignments = entries
      .map(([field]) => `${REVIEW_UPDATE_COLUMNS[field]} = ?`)
      .join(', ');
    const values = entries.map(([, value]) => value ?? null);
    await pool.execute(
      `UPDATE course_reviews
       SET ${assignments}
       WHERE user_id = ? AND subject_id = ?`,
      [...values, userId, subjectId]
    );
    return findReviewByOwner(userId, subjectId);
  }

  async function deleteMyReview(userId, subjectId) {
    const [result] = await pool.execute(
      `DELETE FROM course_reviews
       WHERE user_id = ? AND subject_id = ?`,
      [userId, subjectId]
    );
    return result.affectedRows > 0;
  }

  async function listPosts(classCode, offset, limit) {
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) AS total FROM class_posts WHERE class_code = ?',
      [classCode]
    );
    const [rows] = await pool.execute(
      `SELECT ${POST_WITH_AUTHOR_COLUMNS}
       FROM class_posts
       LEFT JOIN users u ON u.id = class_posts.user_id
       WHERE class_posts.class_code = ?
       ORDER BY class_posts.created_at DESC, class_posts.id DESC
       LIMIT ? OFFSET ?`,
      [classCode, String(limit), String(offset)]
    );
    return { rows, total: Number(countRows[0]?.total || 0) };
  }

  async function createPost(userId, classCode, input) {
    return withTransaction(pool, 'create post', async connection => {
      await connection.execute(
        `INSERT INTO class_sections (class_code, subject_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE class_code = VALUES(class_code)`,
        [classCode, input.subjectId]
      );
      const [sectionRows] = await connection.execute(
        `SELECT subject_id
         FROM class_sections
         WHERE class_code = ?
         FOR UPDATE`,
        [classCode]
      );
      if (!sectionRows[0]) {
        throw new Error('Class section was not available after insert.');
      }
      if (String(sectionRows[0].subject_id) !== String(input.subjectId)) {
        throw new AppError(409, 'CLASS_SUBJECT_CONFLICT', 'Mã lớp này đã gắn với môn học khác.');
      }

      const [result] = await connection.execute(
        `INSERT INTO class_posts (
           subject_id, class_code, user_id, title, content
         ) VALUES (?, ?, ?, ?, ?)`,
        [input.subjectId, classCode, userId, input.title, input.content]
      );
      const [rows] = await connection.execute(
        `SELECT ${POST_WITH_AUTHOR_COLUMNS}
         FROM class_posts
         LEFT JOIN users u ON u.id = class_posts.user_id
         WHERE class_posts.id = ?
         LIMIT 1`,
        [result.insertId]
      );
      if (!rows[0]) {
        throw new Error('Post was inserted but could not be read back.');
      }
      return rows[0];
    });
  }

  async function deleteMyPost(userId, postId) {
    return withTransaction(pool, 'delete post', async connection => {
      const [rows] = await connection.execute(
        `SELECT class_code
         FROM class_posts
         WHERE id = ? AND user_id = ?
         FOR UPDATE`,
        [postId, userId]
      );
      if (!rows[0]) return null;

      const [result] = await connection.execute(
        `DELETE FROM class_posts
         WHERE id = ? AND user_id = ?`,
        [postId, userId]
      );
      return result.affectedRows > 0 ? rows[0].class_code : null;
    });
  }

  async function listComments(postId, offset, limit) {
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) AS total FROM post_comments WHERE post_id = ?',
      [postId]
    );
    const [rows] = await pool.execute(
      `SELECT ${COMMENT_COLUMNS}
       FROM post_comments
       LEFT JOIN users u ON u.id = post_comments.user_id
       WHERE post_comments.post_id = ?
       ORDER BY post_comments.created_at ASC, post_comments.id ASC
       LIMIT ? OFFSET ?`,
      [postId, String(limit), String(offset)]
    );
    return { rows, total: Number(countRows[0]?.total || 0) };
  }

  async function createComment(userId, postId, input) {
    return withTransaction(pool, 'create comment', async connection => {
      const [posts] = await connection.execute(
        `SELECT id
         FROM class_posts
         WHERE id = ?
         FOR UPDATE`,
        [postId]
      );
      if (!posts[0]) {
        throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy bài viết.');
      }

      const [result] = await connection.execute(
        `INSERT INTO post_comments (post_id, user_id, content)
         VALUES (?, ?, ?)`,
        [postId, userId, input.content]
      );
      const [rows] = await connection.execute(
        `SELECT ${COMMENT_COLUMNS}
         FROM post_comments
         LEFT JOIN users u ON u.id = post_comments.user_id
         WHERE post_comments.id = ?
         LIMIT 1`,
        [result.insertId]
      );
      if (!rows[0]) {
        throw new Error('Comment was inserted but could not be read back.');
      }
      return rows[0];
    });
  }

  async function togglePostVote(userId, postId) {
    return withTransaction(pool, 'toggle post vote', async connection => {
      const [posts] = await connection.execute(
        `SELECT id, class_code, upvote_count
         FROM class_posts
         WHERE id = ?
         FOR UPDATE`,
        [postId]
      );
      const post = posts[0];
      if (!post) {
        throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy bài viết.');
      }

      const [votes] = await connection.execute(
        `SELECT id
         FROM post_votes
         WHERE post_id = ? AND user_id = ?
         FOR UPDATE`,
        [postId, userId]
      );
      const upvoted = votes.length === 0;
      if (upvoted) {
        await connection.execute(
          'INSERT INTO post_votes (post_id, user_id) VALUES (?, ?)',
          [postId, userId]
        );
        await connection.execute(
          'UPDATE class_posts SET upvote_count = upvote_count + 1 WHERE id = ?',
          [postId]
        );
      } else {
        await connection.execute(
          'DELETE FROM post_votes WHERE post_id = ? AND user_id = ?',
          [postId, userId]
        );
        await connection.execute(
          `UPDATE class_posts
           SET upvote_count = IF(upvote_count > 0, upvote_count - 1, 0)
           WHERE id = ?`,
          [postId]
        );
      }
      const count = Number(post.upvote_count);
      return {
        upvoted,
        upvoteCount: Math.max(0, count + (upvoted ? 1 : -1)),
        classCode: post.class_code
      };
    });
  }

  async function toggleCommentVote(userId, commentId) {
    return withTransaction(pool, 'toggle comment vote', async connection => {
      const [comments] = await connection.execute(
        `SELECT id, upvote_count
         FROM post_comments
         WHERE id = ?
         FOR UPDATE`,
        [commentId]
      );
      const comment = comments[0];
      if (!comment) {
        throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy bình luận.');
      }

      const [votes] = await connection.execute(
        `SELECT id
         FROM comment_votes
         WHERE comment_id = ? AND user_id = ?
         FOR UPDATE`,
        [commentId, userId]
      );
      const upvoted = votes.length === 0;
      if (upvoted) {
        await connection.execute(
          'INSERT INTO comment_votes (comment_id, user_id) VALUES (?, ?)',
          [commentId, userId]
        );
        await connection.execute(
          'UPDATE post_comments SET upvote_count = upvote_count + 1 WHERE id = ?',
          [commentId]
        );
      } else {
        await connection.execute(
          'DELETE FROM comment_votes WHERE comment_id = ? AND user_id = ?',
          [commentId, userId]
        );
        await connection.execute(
          `UPDATE post_comments
           SET upvote_count = IF(upvote_count > 0, upvote_count - 1, 0)
           WHERE id = ?`,
          [commentId]
        );
      }
      const count = Number(comment.upvote_count);
      return {
        upvoted,
        upvoteCount: Math.max(0, count + (upvoted ? 1 : -1))
      };
    });
  }

  async function findReviewById(reviewId) {
    const [rows] = await pool.execute(
      `SELECT ${REVIEW_COLUMNS}
       FROM course_reviews
       LEFT JOIN users u ON u.id = course_reviews.user_id
       WHERE course_reviews.id = ?
       LIMIT 1`,
      [reviewId]
    );
    return rows[0] || null;
  }

  async function findReviewByOwner(userId, subjectId) {
    const [rows] = await pool.execute(
      `SELECT ${REVIEW_COLUMNS}
       FROM course_reviews
       LEFT JOIN users u ON u.id = course_reviews.user_id
       WHERE course_reviews.user_id = ? AND course_reviews.subject_id = ?
       LIMIT 1`,
      [userId, subjectId]
    );
    return rows[0] || null;
  }

  return {
    findSubject,
    findPost,
    getReviewSummary,
    listReviews,
    createReview,
    updateMyReview,
    deleteMyReview,
    listPosts,
    createPost,
    deleteMyPost,
    listComments,
    createComment,
    togglePostVote,
    toggleCommentVote
  };
}

async function withTransaction(pool, operation, callback) {
  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(`Community ${operation} rollback failed:`, rollbackError);
      }
    }
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { createCommunityRepository };
