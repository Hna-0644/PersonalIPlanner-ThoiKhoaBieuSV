const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { AppError } = require('../utils/app-error');
const { toPublicId, toDatabaseId } = require('../utils/public-id');
const { toIsoUtcString } = require('../utils/timezone');
const { createDocumentRepository } = require('../repositories/document-repository');

const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024;
const FILE_TYPES = {
  '.pdf': {
    mimeType: 'application/pdf',
    matches(buffer) {
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    }
  },
  '.doc': {
    mimeType: 'application/msword',
    matches(buffer) {
      return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    }
  },
  '.docx': {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    matches(buffer) {
      return buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    }
  }
};

function normalizeDocumentId(rawId) {
  const value = String(rawId || '').trim();
  if (/^[1-9]\d*$/.test(value)) return value;
  return toDatabaseId(value, 'document');
}

function sanitizeOriginalName(originalName) {
  return path.posix.basename(String(originalName || '').replace(/\\/g, '/'))
    .replace(/[\r\n\0]/g, '_')
    .slice(0, 255);
}

function mapDocument(row) {
  return {
    id: toPublicId('document', row.id),
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    title: row.title,
    description: row.description || '',
    category: row.category,
    fileName: row.original_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size),
    uploaderName: row.uploader_name || 'Sinh viên',
    uploaderUniversity: row.uploader_university || '',
    uploaderStudentYear: row.uploader_student_year === null || row.uploader_student_year === undefined
      ? null
      : Number(row.uploader_student_year),
    isBookmarked: Boolean(row.is_bookmarked),
    createdAt: toIsoUtcString(row.created_at),
    downloadUrl: `/api/documents/${toPublicId('document', row.id)}/file`
  };
}

function createDocumentService({
  pool,
  repository,
  storageDirectory = path.join(__dirname, '../../uploads/documents')
} = {}) {
  const repo = repository || createDocumentRepository({ pool });

  async function listDocuments(userId, query = {}) {
    const { rows, total, page, limit } = await repo.findDocuments(query, userId);
    return {
      documents: rows.map(mapDocument),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  async function getDocumentFilters() {
    const filters = await repo.findDocumentFilters();
    return {
      ...filters,
      studentYears: [1, 2, 3, 4]
    };
  }

  async function createDocument(userId, input, upload) {
    if (!upload || !Buffer.isBuffer(upload.buffer)) {
      throw new AppError(400, 'FILE_REQUIRED', 'Vui lòng chọn một tệp PDF, DOC hoặc DOCX.');
    }
    if (upload.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new AppError(413, 'FILE_TOO_LARGE', 'Tệp tải lên không được vượt quá 15 MB.');
    }

    const extension = path.extname(upload.originalname || '').toLowerCase();
    const fileType = FILE_TYPES[extension];
    if (!fileType || upload.mimetype !== fileType.mimeType || !fileType.matches(upload.buffer)) {
      throw new AppError(400, 'INVALID_DOCUMENT_FILE', 'Tệp không đúng định dạng PDF, DOC hoặc DOCX.');
    }

    const safeOriginalName = sanitizeOriginalName(upload.originalname);
    const storageName = `${crypto.randomUUID()}${extension}`;
    const filePath = path.join(storageDirectory, storageName);
    await fs.mkdir(storageDirectory, { recursive: true });

    let row;
    try {
      await fs.writeFile(filePath, upload.buffer, { flag: 'wx', mode: 0o600 });
      row = await repo.create(userId, input, {
        originalName: safeOriginalName,
        storageName,
        mimeType: fileType.mimeType,
        size: upload.size
      });
    } catch (error) {
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') {
          console.error('Failed to remove an unregistered study document:', cleanupError.message);
        }
      }
      throw error;
    }
    return mapDocument(row);
  }

  async function getDocumentFile(rawId) {
    const documentId = normalizeDocumentId(rawId);
    const row = await repo.findById(documentId);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài liệu.');
    }

    if (!/^[a-f0-9-]{36}\.(pdf|doc|docx)$/.test(row.storage_name)) {
      throw new AppError(500, 'INVALID_DOCUMENT_STORAGE', 'Không thể xác định tệp tài liệu.');
    }

    const filePath = path.join(storageDirectory, row.storage_name);
    try {
      await fs.access(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, 'DOCUMENT_FILE_NOT_FOUND', 'Tệp tài liệu không còn tồn tại trên máy chủ.');
      }
      throw error;
    }

    return {
      filePath,
      fileName: sanitizeOriginalName(row.original_name),
      mimeType: row.mime_type
    };
  }

  async function setBookmark(userId, rawDocumentId, isBookmarked) {
    const documentId = normalizeDocumentId(rawDocumentId);
    const document = await repo.findById(documentId);
    if (!document) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài liệu.');
    }
    await repo.setBookmark(userId, documentId, isBookmarked);
    return {
      id: toPublicId('document', documentId),
      isBookmarked
    };
  }

  return { listDocuments, getDocumentFilters, createDocument, getDocumentFile, setBookmark };
}

module.exports = {
  MAX_DOCUMENT_SIZE_BYTES,
  createDocumentService,
  mapDocument,
  normalizeDocumentId,
  sanitizeOriginalName
};
