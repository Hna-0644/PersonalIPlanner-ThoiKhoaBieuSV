const test = require('node:test');
const assert = require('node:assert/strict');
const {
  registerSchema,
  classSchema,
  taskSchema,
  taskUpdateSchema,
  scheduleRequestSchema,
  workScheduleSchema,
  workScheduleUpdateSchema
} = require('../src/schemas');

test('registration normalizes email and requires a strong minimum password length', () => {
  const result = registerSchema.parse({
    fullName: 'Student',
    email: 'STUDENT@example.com',
    password: 'strongpass123'
  });
  assert.equal(result.email, 'student@example.com');
  assert.throws(() => registerSchema.parse({
    fullName: 'Student',
    email: 'student@example.com',
    password: 'short'
  }));
});

test('class validation rejects invalid weekday and overlapping interval shape', () => {
  const result = classSchema.safeParse({
    title: 'Math',
    dayOfWeek: 7,
    startTime: '10:00',
    endTime: '09:00'
  });
  assert.equal(result.success, false);
});

test('completed tasks must have 100 percent progress', () => {
  const result = taskSchema.safeParse({
    title: 'Submit report',
    status: 'done',
    progress: 50
  });
  assert.equal(result.success, false);
});

test('partial task updates preserve optional defaults and reject empty updates', () => {
  assert.deepEqual(taskUpdateSchema.parse({ title: 'Updated title' }), {
    title: 'Updated title'
  });
  assert.equal(taskUpdateSchema.safeParse({}).success, false);
  assert.equal(taskUpdateSchema.safeParse({ progress: 100 }).success, false);
});

test('schedule requests reject duplicate task ids', () => {
  const result = scheduleRequestSchema.safeParse({
    taskIds: ['tsk_12', 'tsk_12']
  });

  test('study windows reject overlaps but allow touching boundaries', () => {
    const { preferredHours } = require('../src/schemas');
    const base = {
      morning: { active: true, start: '08:00', end: '11:00' },
      afternoon: { active: true, start: '11:00', end: '17:00' },
      evening: { active: false, start: '19:00', end: '22:00' }
    };
    assert.equal(preferredHours.safeParse(base).success, true);
    assert.equal(preferredHours.safeParse({
      ...base,
      afternoon: { active: true, start: '10:59', end: '17:00' }
    }).success, false);
  });
  assert.equal(result.success, false);
});

test('work schedule validation requires dayOfWeek or workDate, validates time and date ordering', () => {
  // Valid recurring shift
  const validRecurring = workScheduleSchema.safeParse({
    title: 'Part-time barista',
    workplace: 'Coffee House',
    dayOfWeek: 2,
    startTime: '18:00',
    endTime: '22:00',
    startDate: '2026-09-01',
    endDate: '2026-12-31',
    color: '#0d7480'
  });
  assert.equal(validRecurring.success, true);

  // Valid date-specific shift
  const validSpecific = workScheduleSchema.safeParse({
    title: 'Weekend event staff',
    workDate: '2026-11-20',
    startTime: '08:00',
    endTime: '16:00'
  });
  assert.equal(validSpecific.success, true);

  // Rejects when neither dayOfWeek nor workDate is provided
  const noDayOrDate = workScheduleSchema.safeParse({
    title: 'Missing date info',
    startTime: '08:00',
    endTime: '12:00'
  });
  assert.equal(noDayOrDate.success, false);

  // Rejects invalid dayOfWeek
  const invalidDay = workScheduleSchema.safeParse({
    title: 'Invalid day',
    dayOfWeek: 7,
    startTime: '08:00',
    endTime: '12:00'
  });
  assert.equal(invalidDay.success, false);

  // Rejects startTime >= endTime
  const reversedTime = workScheduleSchema.safeParse({
    title: 'Reversed time',
    dayOfWeek: 1,
    startTime: '17:00',
    endTime: '09:00'
  });
  assert.equal(reversedTime.success, false);

  const equalTime = workScheduleSchema.safeParse({
    title: 'Equal time',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '09:00'
  });
  assert.equal(equalTime.success, false);

  // Rejects startDate > endDate
  const reversedDates = workScheduleSchema.safeParse({
    title: 'Reversed dates',
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '12:00',
    startDate: '2026-12-01',
    endDate: '2026-11-01'
  });
  assert.equal(reversedDates.success, false);

  // Rejects invalid color
  const badColor = workScheduleSchema.safeParse({
    title: 'Bad color',
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '12:00',
    color: 'invalid-hex'
  });
  assert.equal(badColor.success, false);
});

test('work schedule update validation accepts partial fields and enforces constraints', () => {
  // Valid partial update
  const validPartial = workScheduleUpdateSchema.safeParse({
    title: 'Updated title',
    startTime: '10:00',
    endTime: '14:00'
  });
  assert.equal(validPartial.success, true);

  // Rejects empty update
  const emptyUpdate = workScheduleUpdateSchema.safeParse({});
  assert.equal(emptyUpdate.success, false);

  // Rejects update with startTime >= endTime
  const invalidTimeUpdate = workScheduleUpdateSchema.safeParse({
    startTime: '15:00',
    endTime: '10:00'
  });
  assert.equal(invalidTimeUpdate.success, false);

  // Rejects update with startDate > endDate
  const invalidDateUpdate = workScheduleUpdateSchema.safeParse({
    startDate: '2026-12-01',
    endDate: '2026-10-01'
  });
  assert.equal(invalidDateUpdate.success, false);
});
