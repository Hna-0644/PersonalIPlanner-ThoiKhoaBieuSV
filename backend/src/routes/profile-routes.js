const express = require('express');
const { profileSchema } = require('../schemas');
const { validate } = require('../middleware/validate');
const { createAuthController } = require('../controllers/auth-controller');

function createProfileRouter(profileService, authenticate, authController) {
  const router = express.Router();
  const controller = authController || createAuthController({ profileService });

  router.use(authenticate);
  router.get('/', controller.getProfile);
  router.patch('/', validate(profileSchema), controller.updateProfile);
  router.put('/', validate(profileSchema), controller.updateProfile);

  return router;
}

module.exports = { createProfileRouter };
