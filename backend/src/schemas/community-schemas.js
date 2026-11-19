const { z } = require('zod');

const subjectIdSchema = z.string().regex(/^sub_[1-9]\d*$/);
const reviewIdSchema = z.string().regex(/^rev_[1-9]\d*$/);
const postIdSchema = z.string().regex(/^pst_[1-9]\d*$/);
const commentIdSchema = z.string().regex(/^cmt_[1-9]\d*$/);
const classCodeSchema = z.string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[A-Za-z0-9._-]+$/);
const requiredText = max => z.string().trim().min(1).max(max);
const nullableText = max => requiredText(max).nullable().optional();

const courseReviewCreateSchema = z.object({
  lecturerName: nullableText(150),
  rating: z.number().int().min(1).max(5),
  difficulty: z.number().int().min(1).max(5),
  attendanceRequired: z.boolean(),
  gradingNotes: nullableText(2000),
  materialsNotes: nullableText(2000),
  content: requiredText(5000)
}).strict();

const courseReviewUpdateSchema = courseReviewCreateSchema.partial()
  .strict()
  .refine(value => Object.keys(value).length > 0, {
    message: 'Cần có ít nhất một trường để cập nhật.'
  });

const classPostCreateSchema = z.object({
  subjectId: subjectIdSchema,
  title: requiredText(120),
  content: requiredText(2000)
}).strict();

const postCommentCreateSchema = z.object({
  content: requiredText(2000)
}).strict();

const communityPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
}).strict();

const subjectParamsSchema = z.object({ subjectId: subjectIdSchema }).strict();
const classPostsParamsSchema = z.object({ classCode: classCodeSchema }).strict();
const postParamsSchema = z.object({ postId: postIdSchema }).strict();
const commentParamsSchema = z.object({ commentId: commentIdSchema }).strict();

module.exports = {
  subjectIdSchema,
  reviewIdSchema,
  postIdSchema,
  commentIdSchema,
  classCodeSchema,
  courseReviewCreateSchema,
  courseReviewUpdateSchema,
  classPostCreateSchema,
  postCommentCreateSchema,
  communityPaginationSchema,
  subjectParamsSchema,
  classPostsParamsSchema,
  postParamsSchema,
  commentParamsSchema
};
