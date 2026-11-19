const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/app-error');
const { toPublicId } = require('../utils/public-id');
const { DEFAULT_TIMEZONE } = require('../utils/timezone');
const { createAuthRepository } = require('../repositories/auth-repository');

const DEFAULT_HOURS = {
  morning: { start: '08:00', end: '11:30', active: true },
  afternoon: { start: '14:00', end: '17:30', active: true },
  evening: { start: '19:30', end: '22:00', active: true }
};

function createAuthService({ pool, authRepository, jwtSecret, jwtExpiresIn }) {
  const repository = authRepository || createAuthRepository({ pool });

  async function createAccount(input) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const userId = await repository.createUserWithPreferences({
      fullName: input.fullName,
      email: input.email,
      passwordHash,
      studentId: input.studentId || null,
      defaultHours: DEFAULT_HOURS
    });

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
      timezone: DEFAULT_TIMEZONE,
      emailReminder: true,
      browserReminder: true
    });
  }

  async function login(input) {
    const user = await repository.findUserCredentialsByEmail(input.email);
    const valid = user && await bcrypt.compare(input.password, user.password_hash);
    if (!valid) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Email hoặc mật khẩu không chính xác.');
    }
    return issueSession(String(user.id), await getPublicUser(user.id));
  }

  async function getPublicUser(userId) {
    const row = await repository.findUserProfileById(userId);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng.');
    }
    return mapUser(row);
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
