const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'schedule.js'), 'utf8');

function createScheduleService({ tasks, events = [], classes = [], user } = {}) {
  const storage = new Map();
  const notifications = [];
  let savedEvents = events;
  const store = {
    getUser: () => user || {
      timezone: 'Asia/Ho_Chi_Minh',
      breakMinutes: 0,
      preferredHours: { morning: { active: true, start: '00:00', end: '23:59' } }
    },
    getTasks: () => storage.has('pp_tasks_data')
      ? JSON.parse(storage.get('pp_tasks_data'))
      : tasks,
    getClasses: () => classes,
    getScheduledEvents: () => savedEvents,
    saveScheduledEvents: next => { savedEvents = next; },
    getNotifications: () => notifications
  };
  const window = { AppStore: store };
  const context = {
    window,
    localStorage: {
      setItem: (key, value) => storage.set(key, value),
      getItem: key => storage.get(key) || null
    },
    Intl,
    Date,
    Map,
    Set,
    Object,
    String,
    Math,
    Number,
    JSON
  };
  vm.runInNewContext(source, context);
  return { service: window.ScheduleService, getEvents: () => savedEvents };
}

function localDate(timezone = 'Asia/Ho_Chi_Minh') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

test('generation only plans selected unscheduled tasks and explains tasks it cannot place', () => {
  const today = localDate();
  const { service } = createScheduleService({
    tasks: [
      { id: 'tsk_1', title: 'selected', status: 'todo', priority: 'high', estimatedHours: 1 },
      { id: 'tsk_2', title: 'not selected', status: 'todo', priority: 'high', estimatedHours: 1 },
      { id: 'tsk_3', title: 'expired', status: 'todo', deadline: '2020-01-01T10:00:00+07:00' },
      { id: 'tsk_4', title: 'too long', status: 'todo', estimatedHours: 25 },
      { id: 'tsk_5', title: 'already scheduled', status: 'todo', scheduled: true }
    ],
    events: [{
      id: 'sch_existing',
      taskId: 'tsk_old',
      start: `${today}T00:00:00+07:00`,
      end: `${today}T23:59:00+07:00`
    }]
  });

  const result = service.generate({
    taskIds: ['tsk_1', 'tsk_3', 'tsk_4', 'tsk_5'],
    days: 3,
    breakMinutes: 0
  });

  assert.deepEqual(Array.from(result.plan, item => item.taskId), ['tsk_1']);
  assert.ok(result.plan[0].date > today, 'an existing event should block the current day');
  assert.deepEqual(
    Array.from(result.unscheduled, item => item.reason).sort(),
    ['DEADLINE_PASSED', 'DURATION_EXCEEDS_WINDOW'].sort()
  );
  assert.equal(result.timezone, 'Asia/Ho_Chi_Minh');
});

test('apply stores ISO instants in the selected timezone and prevents duplicate scheduling', () => {
  const { service, getEvents } = createScheduleService({
    tasks: [{ id: 'tsk_1', title: 'selected', status: 'todo', estimatedHours: 1 }]
  });
  const result = service.generate({ taskIds: ['tsk_1'], days: 7, breakMinutes: 0 });
  const applied = service.apply(result.plan, result);

  assert.equal(applied.events.length, 1);
  assert.equal(getEvents().filter(event => event.taskId === 'tsk_1').length, 1);
  const localStart = new Intl.DateTimeFormat('en-CA', {
    timeZone: result.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(new Date(applied.events[0].start));
  assert.equal(localStart, result.plan[0].startTime);
  assert.equal(
    service.generate({ taskIds: ['tsk_1'], days: 7, breakMinutes: 0 }).plan.length,
    0
  );
  assert.throws(() => service.apply(result.plan, result), /đã thay đổi hoặc được xếp lịch/);
});
