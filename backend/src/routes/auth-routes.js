const express = require('express');
const { registerSchema, loginSchema } = require('../schemas');
const { validate } = require('../middleware/validate');
const { createRateLimiter } = require('../middleware/rate-limit');
const { createAuthController } = require('../controllers/auth-controller');

function createAuthRouter(authService, authController, options = {}) {
  const router = express.Router();
  const controller = authController || createAuthController({ authService });
  const authRateLimiter = createRateLimiter({
    windowMs: options.rateLimitWindowMs || 60 * 1000,
    maxRequests: options.rateLimitMax || 10
  });

  router.post('/register', authRateLimiter, validate(registerSchema), controller.register);
  router.post('/login', authRateLimiter, validate(loginSchema), controller.login);

  return router;
}

module.exports = { createAuthRouter };
