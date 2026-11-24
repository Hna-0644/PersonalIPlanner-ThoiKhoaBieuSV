const { asyncHandler } = require('../utils/async-handler');
const { toDatabaseId } = require('../utils/public-id');

function createDocumentController(documentService) {
  const listDocuments = asyncHandler(async (req, res) => {
    const data = await documentService.listDocuments(req.user.id, req.query);
    res.json({ data });
  });

  const listDocumentFilters = asyncHandler(async (_req, res) => {
    const data = await documentService.getDocumentFilters();
    res.json({ data });
  });

  const createDocument = asyncHandler(async (req, res) => {
    const data = await documentService.createDocument(req.user.id, req.body, req.file);
    res.status(201).json({ data });
  });

  const setBookmark = isBookmarked => asyncHandler(async (req, res) => {
    const data = await documentService.setBookmark(
      req.user.id,
      req.params.id,
      isBookmarked
    );
    res.json({ data });
  });

  const downloadDocument = asyncHandler(async (req, res, next) => {
    const file = await documentService.getDocumentFile(
      toDatabaseId(req.params.id, 'document')
    );
    res.set('Content-Type', file.mimeType);
    res.set('X-Content-Type-Options', 'nosniff');
    res.download(file.filePath, file.fileName, error => {
      if (error && !res.headersSent) next(error);
    });
  });

  return {
    listDocuments,
    listDocumentFilters,
    createDocument,
    setBookmark: setBookmark(true),
    removeBookmark: setBookmark(false),
    downloadDocument
  };
}

module.exports = { createDocumentController };
