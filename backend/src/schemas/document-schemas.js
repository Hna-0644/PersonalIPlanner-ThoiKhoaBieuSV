const { z } = require('zod');

const DOCUMENT_CATEGORIES = ['notes', 'slides', 'exam', 'assignment', 'summary', 'other'];

const documentCreateSchema = z.object({
  subjectCode: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9._-]+$/).transform(value => value.toUpperCase()),
  subjectName: z.string().trim().min(1).max(150),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional().default(''),
  category: z.enum(DOCUMENT_CATEGORIES)
}).strict();

const documentListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  subjectCode: z.string().trim().max(50).optional(),
  subject_code: z.string().trim().max(50).optional(),
  university: z.string().trim().max(500).optional(),
  studentYear: z.preprocess(
    value => value === '' ? undefined : value,
    z.coerce.number().int().min(1).max(4).optional()
  ),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12)
}).transform(value => ({
  q: value.q || undefined,
  subjectCode: (value.subjectCode || value.subject_code || '').trim().toUpperCase() || undefined,
  university: value.university || undefined,
  studentYear: value.studentYear,
  category: value.category,
  page: value.page,
  limit: value.limit
}));

const documentIdParamsSchema = z.object({
  id: z.string().regex(/^doc_[1-9]\d*$/, 'ID tài liệu không hợp lệ.')
});

module.exports = {
  DOCUMENT_CATEGORIES,
  documentCreateSchema,
  documentListQuerySchema,
  documentIdParamsSchema
};
