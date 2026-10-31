const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/app-error');
const { toDatabaseId } = require('../utils/public-id');

function createAuthenticate(secret) {
  return function authenticate(req, res, next) {
    const authorization = req.get('authorization') || '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập.'));
    }

    try {
      const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: 'personalplanner-api',
        audience: 'personalplanner-client'
      });
      if (!payload.sub) {
        throw new Error('Token subject is missing');
      }
      req.user = { id: toDatabaseId(payload.sub, 'user') };
      return next();
    } catch (error) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'));
    }
  };
}

module.exports = { createAuthenticate };
