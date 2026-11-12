const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'store.js'), 'utf8');

test('one-time migration refreshes only expired unfinished demo task deadlines', () => {
  const storage = new Map([
    ['pp_tasks_data', JSON.stringify([
      { id: 'tsk_001', title: 'Làm bài tập lớn Web - Xây dựng RESTful API', status: 'todo', deadline: '2020-01-01T23:59:00' },
      { id: 'tsk_002', title: 'Thiết kế mô hình quan hệ ERD CSDL', status: 'todo', deadline: '2020-01-01T18:00:00' },
      { id: 'tsk_004', title: 'Báo cáo thực hành mã hóa bất đối xứng RSA', status: 'done', deadline: '2020-01-01T23:59:00' },
      { id: 'tsk_custom', title: 'My task', status: 'todo', deadline: '2020-01-01T23:59:00' },
      { id: 'tsk_005', title: 'Đọc tài liệu React Query & Zustand state management', status: 'todo', scheduled: true, deadline: '2020-01-01T22:00:00' }
    ])]
  ]);
  const loadStore = () => vm.runInNewContext(source, {
    window: {},
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    },
    Date,
    Math,
    JSON,
    String,
    Number,
    parseInt,
    setTimeout
  });

  loadStore();
  const tasks = JSON.parse(storage.get('pp_tasks_data'));
  const taskById = new Map(tasks.map(task => [task.id, task]));

  assert.ok(new Date(taskById.get('tsk_001').deadline).getTime() > Date.now());
  assert.ok(new Date(taskById.get('tsk_002').deadline).getTime() > Date.now());
  assert.equal(taskById.get('tsk_004').deadline, '2020-01-01T23:59:00');
  assert.equal(taskById.get('tsk_custom').deadline, '2020-01-01T23:59:00');
  assert.equal(taskById.get('tsk_005').deadline, '2020-01-01T22:00:00');

  const migratedDeadline = taskById.get('tsk_001').deadline;
  loadStore();
  assert.equal(
    JSON.parse(storage.get('pp_tasks_data')).find(task => task.id === 'tsk_001').deadline,
    migratedDeadline,
    'the migration must not continually replace deadlines'
  );
});
