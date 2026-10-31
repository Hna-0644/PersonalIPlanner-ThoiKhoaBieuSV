const test = require('node:test');
const assert = require('node:assert/strict');
const {
  registerSchema,
  classSchema,
  taskSchema,
  taskUpdateSchema,
  scheduleRequestSchema
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
