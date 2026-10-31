const express = require('express');
const { registerSchema, loginSchema } = require('../schemas');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../utils/async-handler');

function createAuthRouter(authService) {
  const router = express.Router();

  router.post('/register', validate(registerSchema), asyncHandler(async (req, res) => {
    const data = await authService.createAccount(req.body);
    res.status(201).json({ data });
  }));

  router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
    const data = await authService.login(req.body);
    res.json({ data });
  }));

  return router;
}

module.exports = { createAuthRouter };
