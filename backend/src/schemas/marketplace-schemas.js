const { z } = require('zod');

const MARKETPLACE_CATEGORIES = ['textbook', 'slides', 'notes', 'supplies', 'other'];
const MARKETPLACE_STATUSES = ['available', 'sold'];

const marketplaceItemCreateSchema = z.object({
  subjectId: z.number().int().positive().nullable().optional(),
  subject_id: z.number().int().positive().nullable().optional(),
  subjectTag: z.string().trim().min(1, 'Tên môn học không được để trống.').max(150).optional(),
  subject_tag: z.string().trim().min(1, 'Tên môn học không được để trống.').max(150).optional(),
  title: z
    .string()
    .trim()
    .min(5, 'Tiêu đề phải có từ 5 đến 200 ký tự.')
    .max(200, 'Tiêu đề phải có từ 5 đến 200 ký tự.'),
  description: z.string().trim().max(5000).nullable().optional(),
  category: z.enum(MARKETPLACE_CATEGORIES).default('textbook'),
  price: z
    .number()
    .int('Giá phải là số nguyên.')
    .min(0, 'Giá không được nhỏ hơn 0.')
    .default(0),
  contactInfo: z.string().trim().min(1, 'Thông tin liên hệ không được để trống.').max(255).optional(),
  contact_info: z.string().trim().min(1, 'Thông tin liên hệ không được để trống.').max(255).optional(),
  imageUrl: z.string().trim().url('Link ảnh không hợp lệ.').max(500).nullable().optional(),
  image_url: z.string().trim().url('Link ảnh không hợp lệ.').max(500).nullable().optional()
}).strict().superRefine((val, ctx) => {
  const subjectTag = val.subjectTag ?? val.subject_tag;
  const contactInfo = val.contactInfo ?? val.contact_info;
  if (!subjectTag) {
    ctx.addIssue({
      code: 'custom',
      path: ['subject_tag'],
      message: 'Thẻ môn học (subject_tag) là bắt buộc.'
    });
  }
  if (!contactInfo) {
    ctx.addIssue({
      code: 'custom',
      path: ['contact_info'],
      message: 'Thông tin liên hệ (contact_info) là bắt buộc.'
    });
  }
}).transform(val => ({
  subjectId: val.subjectId ?? val.subject_id ?? null,
  subjectTag: val.subjectTag ?? val.subject_tag,
  title: val.title,
  description: val.description ?? null,
  category: val.category ?? 'textbook',
  price: val.price ?? 0,
  contactInfo: val.contactInfo ?? val.contact_info,
  imageUrl: val.imageUrl ?? val.image_url ?? null
}));

const marketplaceItemUpdateSchema = z.object({
  subjectId: z.number().int().positive().nullable().optional(),
  subject_id: z.number().int().positive().nullable().optional(),
  subjectTag: z.string().trim().min(1).max(150).optional(),
  subject_tag: z.string().trim().min(1).max(150).optional(),
  title: z.string().trim().min(5, 'Tiêu đề phải có từ 5 đến 200 ký tự.').max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  category: z.enum(MARKETPLACE_CATEGORIES).optional(),
  price: z.number().int('Giá phải là số nguyên.').min(0, 'Giá không được nhỏ hơn 0.').optional(),
  contactInfo: z.string().trim().min(1).max(255).optional(),
  contact_info: z.string().trim().min(1).max(255).optional(),
  imageUrl: z.string().trim().url('Link ảnh không hợp lệ.').max(500).nullable().optional(),
  image_url: z.string().trim().url('Link ảnh không hợp lệ.').max(500).nullable().optional(),
  status: z.enum(MARKETPLACE_STATUSES).optional()
}).strict().refine(val => Object.keys(val).length > 0, {
  message: 'Cần ít nhất một trường để cập nhật.'
}).transform(val => {
  const out = {};
  if ('subjectId' in val || 'subject_id' in val) out.subjectId = val.subjectId ?? val.subject_id ?? null;
  if ('subjectTag' in val || 'subject_tag' in val) out.subjectTag = val.subjectTag ?? val.subject_tag;
  if ('title' in val) out.title = val.title;
  if ('description' in val) out.description = val.description;
  if ('category' in val) out.category = val.category;
  if ('price' in val) out.price = val.price;
  if ('contactInfo' in val || 'contact_info' in val) out.contactInfo = val.contactInfo ?? val.contact_info;
  if ('imageUrl' in val || 'image_url' in val) out.imageUrl = val.imageUrl ?? val.image_url ?? null;
  if ('status' in val) out.status = val.status;
  return out;
});

const marketplaceStatusUpdateSchema = z.object({
  status: z.enum(MARKETPLACE_STATUSES, {
    message: "Trạng thái chỉ chấp nhận 'available' hoặc 'sold'."
  })
}).strict();

const marketplaceListQuerySchema = z.object({
  subject_tag: z.string().trim().max(150).optional(),
  subjectTag: z.string().trim().max(150).optional(),
  category: z.enum(MARKETPLACE_CATEGORIES).optional(),
  q: z.string().trim().max(200).optional(),
  max_price: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  status: z.enum(MARKETPLACE_STATUSES).default('available'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
}).transform(val => ({
  subjectTag: val.subject_tag || val.subjectTag || undefined,
  category: val.category,
  q: val.q || undefined,
  maxPrice: val.max_price !== undefined ? val.max_price : val.maxPrice,
  status: val.status || 'available',
  page: val.page,
  limit: val.limit
}));

module.exports = {
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_STATUSES,
  marketplaceItemCreateSchema,
  marketplaceItemUpdateSchema,
  marketplaceStatusUpdateSchema,
  marketplaceListQuerySchema
};
