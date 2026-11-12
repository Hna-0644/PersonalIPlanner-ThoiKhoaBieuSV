const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'pages', 'statistics.html'), 'utf8');
const scripts = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g));
const source = scripts[scripts.length - 1][1];

function dateKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function createPage(tasks) {
  const elements = new Map();
  const charts = [];
  const getElement = id => {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        value: id === 'statsPeriodSelect' ? 'all' : '',
        textContent: '',
        innerHTML: '',
        classList: { toggle() {}, add() {}, remove() {} },
        addEventListener() {},
        getContext: () => ({ id })
      });
    }
    return elements.get(id);
  };
  class Chart {
    constructor(context, config) {
      this.context = context;
      this.config = config;
      charts.push(this);
    }
    destroy() {}
  }
  const context = vm.createContext({
    document: { getElementById: getElement, addEventListener() {} },
    ApiService: {
      getTasks: async () => ({ data: tasks }),
      getProfile: async () => ({ data: { timezone: 'UTC' } })
    },
    UIStates: { loading() {}, error() {}, empty() {} },
    Chart,
    Intl,
    Date,
    Number,
    String,
    Set,
    Math,
    Object,
    Array,
    JSON,
    escapeHtml: value => String(value)
  });
  vm.runInContext(source, context);
  return { context, elements, charts };
}

test('statistics period filters all metrics and table by deadline, with clear hours calculation', async () => {
  const today = dateKey(new Date());
  const dueDate = new Date(`${today}T00:00:00Z`);
  const plus = days => {
    const date = new Date(dueDate);
    date.setUTCDate(date.getUTCDate() + days);
    return dateKey(date);
  };
  const tasks = [
    { id: 'tsk_1', title: 'Done in range', subject: 'Math', status: 'done', priority: 'high', progress: 100, estimatedHours: 1, deadline: `${plus(1)}T09:00:00Z` },
    { id: 'tsk_2', title: 'Overdue', subject: 'Web', status: 'todo', priority: 'urgent', progress: 0, estimatedHours: 2, deadline: `${plus(-2)}T09:00:00Z` },
    { id: 'tsk_3', title: 'Future', subject: 'Web', status: 'inprogress', progress: 50, estimatedHours: 3, deadline: `${plus(10)}T09:00:00Z` },
    { id: 'tsk_4', title: 'No deadline', subject: null, status: 'todo', progress: 0, deadline: null }
  ];
  const { context, elements, charts } = createPage(tasks);

  await vm.runInContext('loadStatistics()', context);
  assert.equal(elements.get('kpiCompletionRate').textContent, '25%');
  assert.equal(elements.get('kpiTotalHours').textContent, '6h');
  assert.equal(elements.get('kpiTotalSubjects').textContent, 2);
  assert.equal(elements.get('kpiOverdueTasks').textContent, 1);
  assert.match(elements.get('statsTaskTableBody').innerHTML, /No deadline/);

  const element = id => {
    if (!elements.has(id)) context.document.getElementById(id);
    return elements.get(id);
  };
  element('statsPeriodSelect').value = 'custom';
  element('statsStartDate').value = today;
  element('statsEndDate').value = plus(2);
  vm.runInContext('refreshStatistics()', context);

  assert.equal(elements.get('kpiCompletionRate').textContent, '100%');
  assert.equal(elements.get('kpiTotalHours').textContent, '1h');
  assert.equal(elements.get('kpiTotalSubjects').textContent, 1);
  assert.equal(elements.get('kpiOverdueTasks').textContent, 0);
  assert.match(elements.get('statsTaskTableBody').innerHTML, /Done in range/);
  assert.doesNotMatch(elements.get('statsTaskTableBody').innerHTML, /Overdue|Future|No deadline/);
  assert.deepEqual(Array.from(charts[charts.length - 3].config.data.datasets[0].data), [0, 0, 1]);
  assert.match(elements.get('statsPeriodSummary').textContent, /Phạm vi:/);
});
