const { AppError } = require('./app-error');

const ID_PREFIXES = {
  user: 'usr',
  class: 'cls',
  task: 'tsk',
  schedule: 'sch',
  notification: 'ntf'
};

function toPublicId(type, databaseId) {
  const prefix = ID_PREFIXES[type];
  if (!prefix) throw new Error(`Unknown public ID type: ${type}`);
  return `${prefix}_${databaseId}`;
}

function toDatabaseId(publicId, type) {
  const prefix = ID_PREFIXES[type];
  if (!prefix || typeof publicId !== 'string' ||
    !new RegExp(`^${prefix}_[1-9]\\d*$`).test(publicId)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ID không hợp lệ.');
  }
  return publicId.slice(prefix.length + 1);
}

module.exports = { toPublicId, toDatabaseId };
