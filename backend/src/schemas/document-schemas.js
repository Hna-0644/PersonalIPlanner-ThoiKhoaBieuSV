const { z } = require('zod');

const DOCUMENT_CATEGORIES = ['lecture_notes', 'summaries', 'assignments', 'past_exams'];
const LEGACY_DOCUMENT_CATEGORIES = {
  notes: 'lecture_notes',
  slides: 'lecture_notes',
  summary: 'summaries',
  assignment: 'assignments',
  exam: 'past_exams'
};

function normalizeDocumentCategory(value) {
  return typeof value === 'string' ? (LEGACY_DOCUMENT_CATEGORIES[value] || value) : value;
}

const documentCreateSchema = z.object({
  subjectCode: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9._-]+$/).transform(value => value.toUpperCase()),
  subjectName: z.string().trim().min(1).max(150),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional().default(''),
  university: z.string().trim().min(1).max(500),
  academicYear: z.string().trim()
    .regex(/^\d{4}-\d{4}$/)
    .refine(value => Number(value.slice(5)) === Number(value.slice(0, 4)) + 1),
  sourceUrl: z.preprocess(
    value => value === '' ? undefined : value,
    z.string().trim().url().max(2048)
      .refine(value => new URL(value).protocol === 'https:', 'Chỉ chấp nhận URL HTTPS.')
      .optional()
  ),
  category: z.preprocess(normalizeDocumentCategory, z.enum(DOCUMENT_CATEGORIES))
}).strict();

const documentListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  subjectCode: z.string().trim().max(50).optional(),
  subject_code: z.string().trim().max(50).optional(),
  university: z.string().trim().max(500).optional(),
  academicYear: z.string().trim()
    .regex(/^\d{4}-\d{4}$/)
    .refine(value => Number(value.slice(5)) === Number(value.slice(0, 4)) + 1)
    .optional(),
  studentYear: z.preprocess(
    value => value === '' ? undefined : value,
    z.coerce.number().int().min(1).max(4).optional()
  ),
  category: z.preprocess(
    normalizeDocumentCategory,
    z.enum([...DOCUMENT_CATEGORIES, 'other']).optional()
  ),
  savedOnly: z.enum(['true', 'false']).optional().transform(value => value === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12)
}).transform(value => ({
  q: value.q || undefined,
  subjectCode: (value.subjectCode || value.subject_code || '').trim().toUpperCase() || undefined,
  university: value.university || undefined,
  academicYear: value.academicYear || undefined,
  studentYear: value.studentYear,
  category: value.category,
  savedOnly: value.savedOnly,
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
