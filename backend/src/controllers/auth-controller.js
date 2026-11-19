const { asyncHandler } = require('../utils/async-handler');

function createAuthController({ authService, profileService } = {}) {
  const register = asyncHandler(async (req, res) => {
    const data = await authService.createAccount(req.body);
    res.status(201).json({ data });
  });

  const login = asyncHandler(async (req, res) => {
    const data = await authService.login(req.body);
    res.json({ data });
  });

  const getProfile = asyncHandler(async (req, res) => {
    const data = await profileService.getProfile(req.user.id);
    res.json({ data });
  });

  const updateProfile = asyncHandler(async (req, res) => {
    const data = await profileService.updateProfile(req.user.id, req.body);
    res.json({ data });
  });

  return {
    register,
    login,
    getProfile,
    updateProfile
  };
}

module.exports = { createAuthController };
