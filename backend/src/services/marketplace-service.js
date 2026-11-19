const { AppError } = require('../utils/app-error');
const { toPublicId, toDatabaseId } = require('../utils/public-id');
const { toIsoUtcString } = require('../utils/timezone');
const { createMarketplaceRepository } = require('../repositories/marketplace-repository');

const LATEST_PAGE1_CACHE_KEY = 'marketplace:items:latest:page1';
const LATEST_PAGE1_TTL_SECONDS = 300;

function isDefaultPage1Query(query = {}) {
  return (
    (query.status || 'available') === 'available' &&
    (query.page || 1) === 1 &&
    (query.limit || 20) === 20 &&
    !query.subjectTag &&
    !query.category &&
    !query.q &&
    (query.maxPrice === undefined || query.maxPrice === null)
  );
}

function normalizeMarketplaceId(rawId) {
  const str = String(rawId || '').trim();
  if (/^[1-9]\d*$/.test(str)) return str;
  return toDatabaseId(str, 'marketplace');
}

function mapMarketplaceItem(row) {
  return {
    id: toPublicId('marketplace', row.id),
    userId: toPublicId('user', row.user_id),
    subjectId: row.subject_id !== null && row.subject_id !== undefined ? Number(row.subject_id) : null,
    subjectTag: row.subject_tag,
    title: row.title,
    description: row.description ?? null,
    category: row.category,
    price: Number(row.price),
    isFree: Number(row.price) === 0,
    contactInfo: row.contact_info,
    imageUrl: row.image_url ?? null,
    status: row.status,
    seller: row.seller_name
      ? {
          fullName: row.seller_name,
          university: row.seller_university || null
        }
      : null,
    createdAt: toIsoUtcString(row.created_at),
    updatedAt: toIsoUtcString(row.updated_at)
  };
}

function createMarketplaceService({ pool, redisClient, repository }) {
  const repo = repository || createMarketplaceRepository({ pool });

  async function readPage1Cache() {
    if (!redisClient || redisClient.isReady === false) return null;
    try {
      const raw = await redisClient.get(LATEST_PAGE1_CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.error('Marketplace Redis cache read fallback to MySQL:', error.message);
      return null;
    }
  }

  async function writePage1Cache(payload) {
    if (!redisClient || redisClient.isReady === false) return;
    try {
      const serialized = JSON.stringify(payload);
      if (typeof redisClient.setEx === 'function') {
        await redisClient.setEx(LATEST_PAGE1_CACHE_KEY, LATEST_PAGE1_TTL_SECONDS, serialized);
      } else if (typeof redisClient.set === 'function') {
        await redisClient.set(LATEST_PAGE1_CACHE_KEY, serialized, { EX: LATEST_PAGE1_TTL_SECONDS });
      }
    } catch (error) {
      console.error('Marketplace Redis cache write error (ignored):', error.message);
    }
  }

  async function invalidateCache() {
    if (!redisClient || redisClient.isReady === false) return;
    try {
      if (typeof redisClient.del === 'function') {
        await redisClient.del(LATEST_PAGE1_CACHE_KEY);
      }
    } catch (error) {
      console.error('Marketplace Redis cache invalidation error (ignored):', error.message);
    }
  }

  async function listItems(query = {}) {
    const canUseCache = isDefaultPage1Query(query);
    if (canUseCache) {
      const cached = await readPage1Cache();
      if (cached) {
        return { data: cached, cacheStatus: 'HIT' };
      }
    }

    const { rows, total, page, limit } = await repo.findItems(query);
    const result = {
      items: rows.map(mapMarketplaceItem),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };

    if (canUseCache) {
      await writePage1Cache(result);
    }

    return { data: result, cacheStatus: 'MISS' };
  }

  async function getItemById(rawId) {
    const itemId = normalizeMarketplaceId(rawId);
    const row = await repo.findById(itemId);
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tin đăng giáo trình/tài liệu.');
    }
    return mapMarketplaceItem(row);
  }

  async function listMyItems(userId) {
    const rows = await repo.findByUserId(userId);
    return rows.map(mapMarketplaceItem);
  }

  async function createItem(userId, input) {
    const createdRow = await repo.create(userId, input);
    await invalidateCache();
    return mapMarketplaceItem(createdRow);
  }

  async function updateItem(userId, rawId, patch) {
    const itemId = normalizeMarketplaceId(rawId);
    const updatedRow = await repo.updateByOwner(itemId, userId, patch);
    if (!updatedRow) {
      const existing = await repo.findById(itemId);
      if (existing) {
        throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền chỉnh sửa tin đăng của người khác.');
      }
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tin đăng giáo trình/tài liệu.');
    }
    await invalidateCache();
    return mapMarketplaceItem(updatedRow);
  }

  async function updateItemStatus(userId, rawId, status) {
    const itemId = normalizeMarketplaceId(rawId);
    const updatedRow = await repo.updateStatusByOwner(itemId, userId, status);
    if (!updatedRow) {
      const existing = await repo.findById(itemId);
      if (existing) {
        throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền đổi trạng thái tin đăng của người khác.');
      }
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tin đăng giáo trình/tài liệu.');
    }
    await invalidateCache();
    return mapMarketplaceItem(updatedRow);
  }

  async function deleteItem(userId, rawId) {
    const itemId = normalizeMarketplaceId(rawId);
    const deleted = await repo.deleteByOwner(itemId, userId);
    if (!deleted) {
      const existing = await repo.findById(itemId);
      if (existing) {
        throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền xóa tin đăng của người khác.');
      }
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tin đăng giáo trình/tài liệu.');
    }
    await invalidateCache();
    return { id: toPublicId('marketplace', itemId), deleted: true };
  }

  return {
    listItems,
    getItemById,
    listMyItems,
    createItem,
    updateItem,
    updateItemStatus,
    deleteItem,
    invalidateCache
  };
}

module.exports = {
  LATEST_PAGE1_CACHE_KEY,
  LATEST_PAGE1_TTL_SECONDS,
  createMarketplaceService,
  mapMarketplaceItem,
  normalizeMarketplaceId
};
