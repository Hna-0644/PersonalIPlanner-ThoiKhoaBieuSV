const path = require('node:path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createAuthenticate } = require('./middleware/authenticate');
const { errorHandler } = require('./middleware/error-handler');
const { AppError } = require('./utils/app-error');
const { createAuthService } = require('./services/auth-service');
const { createProfileService } = require('./services/profile-service');
const { createClassService } = require('./services/class-service');
const { createTaskService } = require('./services/task-service');
const { createScheduleService } = require('./services/schedule-service');
const { createWorkScheduleService } = require('./services/work-schedule-service');
const { createNotificationService } = require('./services/notification-service');
const { createAiVisionService } = require('./services/ai-vision-service');
const { createMarketplaceService } = require('./services/marketplace-service');
const { createCommunityService } = require('./services/community-service');
const { createAuthRouter } = require('./routes/auth-routes');
const { createProfileRouter } = require('./routes/profile-routes');
const { createClassRouter } = require('./routes/class-routes');
const { createTaskRouter } = require('./routes/task-routes');
const { createWorkScheduleRouter } = require('./routes/work-schedule-routes');
const { createScheduleRouter } = require('./routes/schedule-routes');
const { createNotificationRouter } = require('./routes/notification-routes');
const { createAiRouter } = require('./routes/ai-routes');
const { createMarketplaceRouter } = require('./routes/marketplace-routes');
const { createCommunityRouter } = require('./routes/community-routes');

function createApp({ pool, config, redisClient }) {
  if (!pool) throw new Error('A database pool is required.');
  if (!config || !config.JWT_SECRET) throw new Error('JWT configuration is required.');

  const app = express();
  const authenticate = createAuthenticate(config.JWT_SECRET);
  const authService = createAuthService({
    pool,
    jwtSecret: config.JWT_SECRET,
    jwtExpiresIn: config.JWT_EXPIRES_IN
  });
  const profileService = createProfileService({ pool });
  const classService = createClassService({ pool, redisClient });
  const taskService = createTaskService({ pool, redisClient });
  const workScheduleService = createWorkScheduleService({ pool, redisClient });
  const scheduleService = createScheduleService({ pool, redisClient });
  const notificationService = createNotificationService({ pool, redisClient });
  const aiVisionService = createAiVisionService({ pool, config });
  const marketplaceService = createMarketplaceService({ pool, redisClient });
  const communityService = createCommunityService({ pool, redisClient });

  const allowedOrigins = String(config.CORS_ORIGIN || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: false
  }));
  app.use(express.json({ limit: '10mb' }));

  // Phục vụ giao diện Frontend tĩnh
  const frontendPath = path.join(__dirname, '../../frontend');
  app.use(express.static(frontendPath));

  app.get('/api/health', (req, res) => res.json({ data: { status: 'ok' } }));
  app.use('/api/auth', createAuthRouter(authService));
  app.use('/api/user/profile', createProfileRouter(profileService, authenticate));
  app.use('/api/classes', createClassRouter(classService, authenticate));
  app.use('/api/tasks', createTaskRouter(taskService, authenticate));
  app.use('/api/work-schedules', createWorkScheduleRouter(workScheduleService, authenticate));
  app.use('/api/schedule', createScheduleRouter(scheduleService, authenticate));
  app.use('/api/notifications', createNotificationRouter(notificationService, authenticate));
  app.use('/api/ai', createAiRouter(aiVisionService, profileService, authenticate));
  app.use('/api/marketplace', createMarketplaceRouter(marketplaceService, authenticate));
  app.use('/api', createCommunityRouter(communityService, authenticate));

  // 404 cho API routes
  app.use('/api/*', (req, res, next) => next(new AppError(404, 'NOT_FOUND', 'Không tìm thấy API này.')));

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
