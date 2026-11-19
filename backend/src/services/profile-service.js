const { AppError } = require('../utils/app-error');
const { mapUser } = require('./auth-service');
const { createAuthRepository } = require('../repositories/auth-repository');

function createProfileService({ pool, authRepository }) {
  const repository = authRepository || createAuthRepository({ pool });

  async function getProfile(userId) {
    const row = await repository.findUserProfileById(userId);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng.');
    return mapUser(row);
  }

  async function updateProfile(userId, input) {
    await repository.updateUserProfileById(userId, input);
    return await getProfile(userId);
  }

  return { getProfile, updateProfile };
}

module.exports = { createProfileService };
