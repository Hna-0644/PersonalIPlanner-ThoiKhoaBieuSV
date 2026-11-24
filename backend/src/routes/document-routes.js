const express = require('express');
const multer = require('multer');
const path = require('node:path');
const { AppError } = require('../utils/app-error');
const { validate } = require('../middleware/validate');
const { createRateLimiter } = require('../middleware/rate-limit');
const {
  documentCreateSchema,
  documentListQuerySchema,
  documentIdParamsSchema
} = require('../schemas/document-schemas');
const { createDocumentController } = require('../controllers/document-controller');

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = new Map([
  ['.pdf', 'application/pdf'],
  ['.doc', 'application/msword'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
]);

function createDocumentRouter(documentService, authenticate, options = {}) {
  const router = express.Router();
  const controller = createDocumentController(documentService);
  const createRateLimit = createRateLimiter({
    windowMs: options.rateLimitWindowMs || 60 * 1000,
    maxRequests: options.createRateLimitMax || 5
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
      files: 1,
      fields: 5,
      fieldSize: 8000
    },
    fileFilter(req, file, callback) {
      const extension = path.extname(file.originalname || '').toLowerCase();
      if (ACCEPTED_TYPES.get(extension) !== file.mimetype) {
        callback(new AppError(400, 'INVALID_DOCUMENT_FILE', 'Chỉ chấp nhận tệp PDF, DOC hoặc DOCX.'));
        return;
      }
      callback(null, true);
    }
  });
  const parseUpload = (req, res, next) => {
    upload.single('file')(req, res, error => {
      if (!error) return next();
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(413, 'FILE_TOO_LARGE', 'Tệp tải lên không được vượt quá 15 MB.'));
      }
      if (error instanceof AppError) return next(error);
      if (error instanceof multer.MulterError) {
        return next(new AppError(400, 'INVALID_UPLOAD', 'Yêu cầu tải tệp không hợp lệ.'));
      }
      return next(error);
    });
  };

  router.get('/filters', authenticate, controller.listDocumentFilters);
  router.get('/', authenticate, validate(documentListQuerySchema, 'query'), controller.listDocuments);
  router.post(
    '/',
    authenticate,
    createRateLimit,
    parseUpload,
    validate(documentCreateSchema),
    controller.createDocument
  );
  router.get(
    '/:id/file',
    authenticate,
    validate(documentIdParamsSchema, 'params'),
    controller.downloadDocument
  );

  return router;
}

module.exports = { MAX_UPLOAD_BYTES, createDocumentRouter };
