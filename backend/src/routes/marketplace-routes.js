const express = require('express');
const { validate } = require('../middleware/validate');
const { createRateLimiter } = require('../middleware/rate-limit');
const {
  marketplaceItemCreateSchema,
  marketplaceItemUpdateSchema,
  marketplaceStatusUpdateSchema,
  marketplaceListQuerySchema
} = require('../schemas/marketplace-schemas');
const { createMarketplaceController } = require('../controllers/marketplace-controller');

function createMarketplaceRouter(marketplaceService, authenticate, options = {}) {
  const router = express.Router();
  const controller = createMarketplaceController(marketplaceService);
  const createItemRateLimiter = createRateLimiter({
    windowMs: options.rateLimitWindowMs || 60 * 1000,
    maxRequests: options.rateLimitMax || 5
  });

  // 1. GET /api/marketplace/items - Danh sách tin đang bán (hỗ trợ filter & cache page 1)
  router.get('/items', validate(marketplaceListQuerySchema, 'query'), controller.listItems);

  // 2. GET /api/marketplace/my-items - Danh sách tin đăng của chính user hiện tại (bắt buộc JWT)
  router.get('/my-items', authenticate, controller.listMyItems);

  // 3. GET /api/marketplace/items/:id - Chi tiết 1 tin đăng
  router.get('/items/:id', controller.getItemDetail);

  // 4. POST /api/marketplace/items - Đăng tin mới (bắt buộc JWT + Rate Limit)
  router.post(
    '/items',
    authenticate,
    createItemRateLimiter,
    validate(marketplaceItemCreateSchema),
    controller.createItem
  );

  // 5. PUT /api/marketplace/items/:id - Cập nhật nội dung tin đăng (chỉ chính chủ)
  router.put(
    '/items/:id',
    authenticate,
    validate(marketplaceItemUpdateSchema),
    controller.updateItem
  );

  // 6. PATCH /api/marketplace/items/:id/status - Đổi nhanh trạng thái available / sold (chỉ chính chủ)
  router.patch(
    '/items/:id/status',
    authenticate,
    validate(marketplaceStatusUpdateSchema),
    controller.updateItemStatus
  );

  // 7. DELETE /api/marketplace/items/:id - Xóa tin đăng (chỉ chính chủ)
  router.delete('/items/:id', authenticate, controller.deleteItem);

  return router;
}

module.exports = { createMarketplaceRouter };
