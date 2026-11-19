const ITEM_SELECT_COLUMNS = `
  m.id,
  m.user_id,
  m.subject_id,
  m.subject_tag,
  m.title,
  m.description,
  m.category,
  m.price,
  m.contact_info,
  m.image_url,
  m.status,
  m.created_at,
  m.updated_at,
  u.full_name AS seller_name,
  u.university AS seller_university
`;

const FIELD_TO_COLUMN = {
  subjectId: 'subject_id',
  subjectTag: 'subject_tag',
  title: 'title',
  description: 'description',
  category: 'category',
  price: 'price',
  contactInfo: 'contact_info',
  imageUrl: 'image_url',
  status: 'status'
};

function createMarketplaceRepository({ pool }) {
  async function findItems(filters = {}) {
    const conditions = ['m.status = ?'];
    const params = [filters.status || 'available'];

    if (filters.subjectTag) {
      conditions.push('m.subject_tag = ?');
      params.push(filters.subjectTag);
    }

    if (filters.category) {
      conditions.push('m.category = ?');
      params.push(filters.category);
    }

    if (filters.maxPrice !== undefined && filters.maxPrice !== null) {
      conditions.push('m.price <= ?');
      params.push(Number(filters.maxPrice));
    }

    if (filters.q) {
      conditions.push('(m.title LIKE ? OR m.subject_tag LIKE ?)');
      const keyword = `%${filters.q}%`;
      params.push(keyword, keyword);
    }

    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(50, Math.max(1, Number(filters.limit || 20)));
    const offset = (page - 1) * limit;
    const whereClause = conditions.join(' AND ');

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM marketplace_items m
       WHERE ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await pool.execute(
      `SELECT ${ITEM_SELECT_COLUMNS}
       FROM marketplace_items m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE ${whereClause}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ? OFFSET ?`,
      [...params, String(limit), String(offset)]
    );

    return { rows, total, page, limit };
  }

  async function findById(itemId) {
    const [rows] = await pool.execute(
      `SELECT ${ITEM_SELECT_COLUMNS}
       FROM marketplace_items m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.id = ?
       LIMIT 1`,
      [itemId]
    );
    return rows[0] || null;
  }

  async function findByUserId(userId) {
    const [rows] = await pool.execute(
      `SELECT ${ITEM_SELECT_COLUMNS}
       FROM marketplace_items m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.user_id = ?
       ORDER BY m.created_at DESC, m.id DESC`,
      [userId]
    );
    return rows;
  }

  async function create(userId, data) {
    const [result] = await pool.execute(
      `INSERT INTO marketplace_items (
        user_id, subject_id, subject_tag, title, description,
        category, price, contact_info, image_url, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')`,
      [
        userId,
        data.subjectId ?? null,
        data.subjectTag,
        data.title,
        data.description ?? null,
        data.category || 'textbook',
        Number(data.price ?? 0),
        data.contactInfo,
        data.imageUrl ?? null
      ]
    );
    return findById(result.insertId);
  }

  async function updateByOwner(itemId, userId, patch) {
    const entries = Object.entries(patch).filter(([key]) => FIELD_TO_COLUMN[key]);
    if (entries.length === 0) return findByIdAndOwner(itemId, userId);

    const assignments = entries.map(([key]) => `${FIELD_TO_COLUMN[key]} = ?`).join(', ');
    const values = entries.map(([, val]) => (val === undefined ? null : val));

    const [result] = await pool.execute(
      `UPDATE marketplace_items
       SET ${assignments}
       WHERE id = ? AND user_id = ?`,
      [...values, itemId, userId]
    );

    if (!result.affectedRows) return null;
    return findById(itemId);
  }

  async function updateStatusByOwner(itemId, userId, status) {
    const [result] = await pool.execute(
      `UPDATE marketplace_items
       SET status = ?
       WHERE id = ? AND user_id = ?`,
      [status, itemId, userId]
    );
    if (!result.affectedRows) return null;
    return findById(itemId);
  }

  async function deleteByOwner(itemId, userId) {
    const [result] = await pool.execute(
      `DELETE FROM marketplace_items
       WHERE id = ? AND user_id = ?`,
      [itemId, userId]
    );
    return result.affectedRows > 0;
  }

  async function findByIdAndOwner(itemId, userId) {
    const [rows] = await pool.execute(
      `SELECT ${ITEM_SELECT_COLUMNS}
       FROM marketplace_items m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.id = ? AND m.user_id = ?
       LIMIT 1`,
      [itemId, userId]
    );
    return rows[0] || null;
  }

  return {
    findItems,
    findById,
    findByUserId,
    create,
    updateByOwner,
    updateStatusByOwner,
    deleteByOwner,
    findByIdAndOwner
  };
}

module.exports = { createMarketplaceRepository };
