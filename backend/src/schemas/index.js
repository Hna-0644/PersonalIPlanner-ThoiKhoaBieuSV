const { z } = require('zod');
const { DateTime } = require('luxon');

const nullableText = z.string().trim().max(500).nullable().optional();
const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  value => DateTime.fromISO(value, { zone: 'utc' }).isValid,
  'Ngày không hợp lệ.'
);
const instant = z.iso.datetime({ offset: true });
const taskPublicId = z.string().regex(/^tsk_[1-9]\d*$/);
const password = z.string().min(8).max(72).refine(
  value => Buffer.byteLength(value, 'utf8') <= 72,
  'Mật khẩu không được vượt quá 72 byte.'
);

const timeWindow = z.object({
  active: z.boolean(),
  start: localTime,
  end: localTime
}).refine(value => !value.active || value.start < value.end, {
  message: 'Giờ kết thúc phải sau giờ bắt đầu khi khung giờ đang bật.'
});

const timezone = z.string().trim().min(1).max(100).refine(value => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'Múi giờ IANA không hợp lệ.');

const preferredHours = z.object({
  morning: timeWindow,
  afternoon: timeWindow,
  evening: timeWindow
}).refine(value => {
  const activeWindows = Object.values(value)
    .filter(window => window.active)
    .sort((a, b) => a.start.localeCompare(b.start));
  return activeWindows.every((window, index) =>
    index === 0 || activeWindows[index - 1].end <= window.start
  );
}, 'Các khung giờ đang bật không được chồng lấn.');

const registerSchema = z.object({
  fullName: z.string().trim().min(1).max(150),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  studentId: z.string().trim().max(50).optional().nullable(),
  password
}).strict();

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).max(72)
}).strict();

const profileSchema = z.object({
  fullName: z.string().trim().min(1).max(150).optional(),
  studentId: nullableText,
  major: nullableText,
  university: nullableText,
  avatar: z.string().trim().url().max(2048).nullable().optional(),
  preferredHours: preferredHours.optional(),
  breakMinutes: z.number().int().min(0).max(180).optional(),
  timezone: timezone.optional(),
  emailReminder: z.boolean().optional(),
  browserReminder: z.boolean().optional()
}).strict().refine(value => Object.keys(value).length > 0, {
  message: 'Cần có ít nhất một trường để cập nhật.'
});

const classFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  code: nullableText,
  room: nullableText,
  lecturer: nullableText,
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: localTime,
  endTime: localTime,
  semesterStart: localDate.nullable().optional(),
  semesterEnd: localDate.nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional()
}).strict();

const classSchema = classFieldsSchema.refine(value => value.startTime < value.endTime, {
  message: 'Giờ kết thúc phải sau giờ bắt đầu.',
  path: ['endTime']
}).refine(value => !value.semesterStart || !value.semesterEnd || value.semesterStart <= value.semesterEnd, {
  message: 'Ngày kết thúc học kỳ không được trước ngày bắt đầu.',
  path: ['semesterEnd']
});

const classUpdateSchema = classFieldsSchema.partial().strict().refine(value => Object.keys(value).length > 0, {
  message: 'Cần có ít nhất một trường để cập nhật.'
}).refine(value => !value.startTime || !value.endTime || value.startTime < value.endTime, {
  message: 'Giờ kết thúc phải sau giờ bắt đầu.',
  path: ['endTime']
}).refine(value => !value.semesterStart || !value.semesterEnd || value.semesterStart <= value.semesterEnd, {
  message: 'Ngày kết thúc học kỳ không được trước ngày bắt đầu.',
  path: ['semesterEnd']
});

const taskFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subject: nullableText,
  description: z.string().trim().max(10000).nullable().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']),
  status: z.enum(['todo', 'inprogress', 'done']),
  progress: z.number().int().min(0).max(100),
  estimatedHours: z.number().positive().max(1000).nullable().optional(),
  deadline: instant.nullable().optional()
}).strict();

const taskSchema = taskFieldsSchema.extend({
  priority: z.enum(['urgent', 'high', 'medium', 'low']).default('medium'),
  status: z.enum(['todo', 'inprogress', 'done']).default('todo'),
  progress: z.number().int().min(0).max(100).default(0)
}).strict().refine(value => value.status !== 'done' || value.progress === 100, {
  message: 'Công việc hoàn thành phải có tiến độ 100%.',
  path: ['progress']
}).refine(value => value.progress !== 100 || value.status === 'done', {
  message: 'Công việc đạt 100% phải có trạng thái hoàn thành.',
  path: ['status']
});

const taskUpdateSchema = taskFieldsSchema.partial().strict().refine(value => Object.keys(value).length > 0, {
  message: 'Cần có ít nhất một trường để cập nhật.'
}).refine(value => value.status !== 'done' || value.progress === undefined || value.progress === 100, {
  message: 'Công việc hoàn thành phải có tiến độ 100%.',
  path: ['progress']
}).refine(value => value.progress !== 100 || value.status === 'done', {
  message: 'Công việc đạt 100% phải có trạng thái hoàn thành.',
  path: ['status']
});

const scheduleRequestSchema = z.object({
  taskIds: z.array(taskPublicId).min(1).max(100),
  days: z.number().int().min(1).max(30).default(7),
  breakMinutes: z.number().int().min(0).max(180).optional()
}).strict().refine(value => new Set(value.taskIds).size === value.taskIds.length, {
  message: 'Danh sách taskIds không được chứa ID trùng lặp.',
  path: ['taskIds']
});

const schedulePlanItemSchema = z.object({
  taskId: taskPublicId,
  date: localDate,
  startTime: localTime,
  endTime: localTime,
  durationMinutes: z.number().int().positive(),
  taskTitle: z.string().trim().min(1).max(200).optional(),
  subject: z.string().nullable().optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
  estimatedHours: z.number().positive().nullable().optional(),
  deadline: instant.nullable().optional()
}).strict().refine(value => value.startTime < value.endTime, {
  message: 'Giờ kết thúc phải sau giờ bắt đầu.',
  path: ['endTime']
});

const scheduleApplySchema = z.object({
  plan: z.array(schedulePlanItemSchema).min(1).max(100),
  breakMinutes: z.number().int().min(0).max(180),
  timezone
}).strict().refine(value =>
  new Set(value.plan.map(item => item.taskId)).size === value.plan.length,
{
  message: 'Mỗi công việc chỉ được xuất hiện một lần trong phương án.',
  path: ['plan']
});

module.exports = {
  preferredHours,
  registerSchema,
  loginSchema,
  profileSchema,
  classSchema,
  classUpdateSchema,
  taskSchema,
  taskUpdateSchema,
  scheduleRequestSchema,
  scheduleApplySchema
};
