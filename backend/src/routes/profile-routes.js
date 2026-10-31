const express = require('express');
const { profileSchema } = require('../schemas');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../utils/async-handler');

function createProfileRouter(profileService, authenticate) {
  const router = express.Router();

  router.use(authenticate);
  router.get('/', asyncHandler(async (req, res) => {
    res.json({ data: await profileService.getProfile(req.user.id) });
  }));
  const updateProfile = asyncHandler(async (req, res) => {
    res.json({ data: await profileService.updateProfile(req.user.id, req.body) });
  });
  router.patch('/', validate(profileSchema), updateProfile);
  router.put('/', validate(profileSchema), updateProfile);

  return router;
}

module.exports = { createProfileRouter };
