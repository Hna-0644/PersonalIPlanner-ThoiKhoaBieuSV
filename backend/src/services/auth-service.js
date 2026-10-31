const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/app-error');
const { toPublicId } = require('../utils/public-id');

const DEFAULT_HOURS = {
  morning: { start: '08:00', end: '11:30', active: true },
  afternoon: { start: '14:00', end: '17:30', active: true },
  evening: { start: '19:30', end: '22:00', active: true }
};

function createAuthService({ pool, jwtSecret, jwtExpiresIn }) {
  async function createAccount(input) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        `INSERT INTO users (full_name, email, password_hash, student_id)
         VALUES (?, ?, ?, ?)`,
        [
          input.fullName,
          input.email,
          await bcrypt.hash(input.password, 12),
          input.studentId || null
        ]
      );
      const userId = String(result.insertId);
      await connection.execute(
        `INSERT INTO study_preferences (user_id, preferred_hours)
         VALUES (?, ?)`,
        [userId, JSON.stringify(DEFAULT_HOURS)]
      );
      await connection.commit();
      return issueSession(userId, {
        id: toPublicId('user', userId),
        fullName: input.fullName,
        email: input.email,
        studentId: input.studentId || null,
        major: null,
        university: null,
        avatar: null,
        preferredHours: DEFAULT_HOURS,
        breakMinutes: 15,
        timezone: 'Asia/Ho_Chi_Minh',
        emailReminder: true,
        browserReminder: true
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function login(input) {
    const [rows] = await pool.execute(
      'SELECT id, full_name, email, password_hash FROM users WHERE email = ? LIMIT 1',
      [input.email]
    );
    const user = rows[0];
    const valid = user && await bcrypt.compare(input.password, user.password_hash);
    if (!valid) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Email hoặc mật khẩu không chính xác.');
    }
    return issueSession(String(user.id), await getPublicUser(user.id));
  }

  async function getPublicUser(userId) {
    const [rows] = await pool.execute(
      `SELECT u.id, u.full_name, u.email, u.student_id, u.major, u.university, u.avatar,
              p.preferred_hours, p.break_minutes, p.timezone, p.email_reminder, p.browser_reminder
       FROM users u
       JOIN study_preferences p ON p.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );
    if (!rows[0]) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng.');
    }
    return mapUser(rows[0]);
  }

  function issueSession(userId, user) {
    const accessToken = jwt.sign({}, jwtSecret, {
      subject: toPublicId('user', userId),
      expiresIn: jwtExpiresIn,
      algorithm: 'HS256',
      issuer: 'personalplanner-api',
      audience: 'personalplanner-client'
    });
    return { user, accessToken, tokenType: 'Bearer' };
  }

  return { createAccount, login, getPublicUser };
}

function mapUser(row) {
  return {
    id: toPublicId('user', row.id),
    fullName: row.full_name,
    email: row.email,
    studentId: row.student_id,
    major: row.major,
    university: row.university,
    avatar: row.avatar,
    preferredHours: typeof row.preferred_hours === 'string'
      ? JSON.parse(row.preferred_hours)
      : row.preferred_hours,
    breakMinutes: Number(row.break_minutes),
    timezone: row.timezone,
    emailReminder: Boolean(row.email_reminder),
    browserReminder: Boolean(row.browser_reminder)
  };
}

module.exports = { createAuthService, mapUser };
