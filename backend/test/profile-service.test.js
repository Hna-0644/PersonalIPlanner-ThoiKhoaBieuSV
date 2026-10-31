const test = require('node:test');
const assert = require('node:assert/strict');
const { createProfileService } = require('../src/services/profile-service');

test('profile updates accept unchanged values and return the canonical user', async () => {
  let committed = false;
  const connection = {
    async beginTransaction() {},
    async commit() { committed = true; },
    async rollback() {},
    release() {},
    async execute() {
      return [{ affectedRows: 0 }, []];
    }
  };
  const pool = {
    async getConnection() { return connection; },
    async execute() {
      return [[{
        id: '7',
        full_name: 'Student',
        email: 'student@example.com',
        student_id: null,
        major: null,
        university: null,
        avatar: null,
        preferred_hours: {
          morning: { start: '08:00', end: '11:30', active: true },
          afternoon: { start: '14:00', end: '17:30', active: false },
          evening: { start: '19:30', end: '22:00', active: false }
        },
        break_minutes: 15,
        timezone: 'Asia/Ho_Chi_Minh',
        email_reminder: 1,
        browser_reminder: 1
      }], []];
    }
  };
  const service = createProfileService({ pool });

  const user = await service.updateProfile('7', { breakMinutes: 15 });

  assert.equal(committed, true);
  assert.equal(user.id, 'usr_7');
  assert.equal(user.breakMinutes, 15);
});
