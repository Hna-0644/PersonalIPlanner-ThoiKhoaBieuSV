const DOCUMENT_SELECT_COLUMNS = `
  d.id,
  d.user_id,
  d.subject_code,
  d.subject_name,
  d.title,
  d.description,
  d.category,
  d.original_name,
  d.storage_name,
  d.mime_type,
  d.file_size,
  d.created_at,
  u.full_name AS uploader_name,
  u.university AS uploader_university,
  u.student_year AS uploader_student_year
`;

function createDocumentRepository({ pool }) {
  async function findDocuments(filters = {}, userId) {
    const conditions = [];
    const values = [];

    if (filters.subjectCode) {
      conditions.push('d.subject_code = ?');
      values.push(filters.subjectCode);
    }

    if (filters.university) {
      conditions.push('TRIM(u.university) = ?');
      values.push(filters.university);
    }

    if (filters.studentYear) {
      conditions.push('u.student_year = ?');
      values.push(filters.studentYear);
    }

    if (filters.category) {
      conditions.push('d.category = ?');
      values.push(filters.category);
    }

    if (filters.q) {
      conditions.push(`(
        d.title LIKE ? OR
        d.description LIKE ? OR
        d.subject_code LIKE ? OR
        d.subject_name LIKE ? OR
        d.original_name LIKE ? OR
        u.university LIKE ?
      )`);
      const keyword = `%${filters.q}%`;
      values.push(keyword, keyword, keyword, keyword, keyword, keyword);
    }

    if (filters.savedOnly) {
      conditions.push(`EXISTS (
        SELECT 1
        FROM study_document_bookmarks b
        WHERE b.user_id = ? AND b.document_id = d.id
      )`);
      values.push(userId);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(50, Math.max(1, Number(filters.limit || 12)));
    const offset = (page - 1) * limit;

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM study_documents d
       JOIN users u ON u.id = d.user_id
       ${whereClause}`,
      values
    );
    const [rows] = await pool.execute(
      `SELECT ${DOCUMENT_SELECT_COLUMNS},
       EXISTS (
         SELECT 1
         FROM study_document_bookmarks b
         WHERE b.user_id = ? AND b.document_id = d.id
       ) AS is_bookmarked
       FROM study_documents d
       JOIN users u ON u.id = d.user_id
       ${whereClause}
       ORDER BY d.created_at DESC, d.id DESC
       LIMIT ? OFFSET ?`,
      [userId, ...values, String(limit), String(offset)]
    );

    return {
      rows,
      total: Number(countRows[0]?.total || 0),
      page,
      limit
    };
  }

  async function findDocumentFilters() {
    const [universityRows] = await pool.execute(
      `SELECT DISTINCT TRIM(u.university) AS university
       FROM study_documents d
       JOIN users u ON u.id = d.user_id
       WHERE u.university IS NOT NULL AND TRIM(u.university) <> ''
       ORDER BY university`
    );
    const [subjectRows] = await pool.execute(
      `SELECT subject_code AS code, MAX(subject_name) AS name
       FROM study_documents
       GROUP BY subject_code
       ORDER BY name, code`
    );

    return {
      universities: universityRows.map(row => row.university),
      subjects: subjectRows
    };
  }

  async function create(userId, input, file) {
    return withTransaction(pool, async connection => {
      const [result] = await connection.execute(
        `INSERT INTO study_documents (
          user_id, subject_code, subject_name, title, description, category,
          original_name, storage_name, mime_type, file_size
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          input.subjectCode,
          input.subjectName,
          input.title,
          input.description || null,
          input.category,
          file.originalName,
          file.storageName,
          file.mimeType,
          file.size
        ]
      );
      const row = await findById(result.insertId, connection);
      if (!row) throw new Error('Created study document could not be read back.');
      return row;
    });
  }

  async function findById(documentId, executor = pool) {
    const [rows] = await executor.execute(
      `SELECT ${DOCUMENT_SELECT_COLUMNS}
       FROM study_documents d
       JOIN users u ON u.id = d.user_id
       WHERE d.id = ?
       LIMIT 1`,
      [documentId]
    );
    return rows[0] || null;
  }

  async function setBookmark(userId, documentId, isBookmarked) {
    if (isBookmarked) {
      await pool.execute(
        `INSERT INTO study_document_bookmarks (user_id, document_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE created_at = study_document_bookmarks.created_at`,
        [userId, documentId]
      );
      return;
    }

    await pool.execute(
      'DELETE FROM study_document_bookmarks WHERE user_id = ? AND document_id = ?',
      [userId, documentId]
    );
  }

  return { findDocuments, findDocumentFilters, create, findById, setBookmark };
}

async function withTransaction(pool, operation) {
  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const result = await operation(connection);
    await connection.commit();
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Study document creation rollback failed:', rollbackError);
      }
    }
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { createDocumentRepository };
