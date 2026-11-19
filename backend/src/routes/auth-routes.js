const express = require('express');
const { registerSchema, loginSchema } = require('../schemas');
const { validate } = require('../middleware/validate');
const { createAuthController } = require('../controllers/auth-controller');

function createAuthRouter(authService, authController) {
  const router = express.Router();
  const controller = authController || createAuthController({ authService });

  router.post('/register', validate(registerSchema), controller.register);
  router.post('/login', validate(loginSchema), controller.login);

  return router;
}

module.exports = { createAuthRouter };
