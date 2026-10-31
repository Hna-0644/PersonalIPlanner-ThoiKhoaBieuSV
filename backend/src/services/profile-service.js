const { AppError } = require('../utils/app-error');
const { mapUser } = require('./auth-service');

const USER_COLUMNS = {
  fullName: 'full_name',
  studentId: 'student_id',
  major: 'major',
  university: 'university',
  avatar: 'avatar'
};

const PREFERENCE_COLUMNS = {
  breakMinutes: 'break_minutes',
  timezone: 'timezone',
  emailReminder: 'email_reminder',
  browserReminder: 'browser_reminder'
};

function createProfileService({ pool }) {
  async function getProfile(userId) {
    const [rows] = await pool.execute(
      `SELECT u.id, u.full_name, u.email, u.student_id, u.major, u.university, u.avatar,
              p.preferred_hours, p.break_minutes, p.timezone, p.email_reminder, p.browser_reminder
       FROM users u
       JOIN study_preferences p ON p.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng.');
    return mapUser(rows[0]);
  }

  async function updateProfile(userId, input) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const userEntries = Object.entries(input)
        .filter(([key]) => Object.hasOwn(USER_COLUMNS, key));
      if (userEntries.length) {
        const assignments = userEntries.map(([key]) => `${USER_COLUMNS[key]} = ?`).join(', ');
        const values = userEntries.map(([, value]) => value);
        await connection.execute(
          `UPDATE users SET ${assignments} WHERE id = ?`,
          [...values, userId]
        );
      }

      const preferenceEntries = Object.entries(input)
        .filter(([key]) => Object.hasOwn(PREFERENCE_COLUMNS, key));
      if (Object.hasOwn(input, 'preferredHours')) {
        preferenceEntries.push(['preferredHours', input.preferredHours]);
      }
      if (preferenceEntries.length) {
        const assignments = preferenceEntries.map(([key]) =>
          key === 'preferredHours' ? 'preferred_hours = ?' : `${PREFERENCE_COLUMNS[key]} = ?`
        ).join(', ');
        const values = preferenceEntries.map(([key, value]) =>
          key === 'preferredHours' ? JSON.stringify(value) : value
        );
        await connection.execute(
          `UPDATE study_preferences SET ${assignments} WHERE user_id = ?`,
          [...values, userId]
        );
      }

      await connection.commit();
      return await getProfile(userId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  return { getProfile, updateProfile };
}

module.exports = { createProfileService };
