const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createMarketplaceService,
  LATEST_PAGE1_CACHE_KEY
} = require('../src/services/marketplace-service');
const {
  marketplaceItemCreateSchema,
  marketplaceStatusUpdateSchema
} = require('../src/schemas/marketplace-schemas');

function createInMemoryMarketplaceRepository() {
  let nextId = 1;
  const items = [];

  return {
    items,
    async findItems(filters = {}) {
      const status = filters.status || 'available';
      let matched = items.filter(i => i.status === status);

      if (filters.subjectTag) {
        matched = matched.filter(i => i.subject_tag === filters.subjectTag);
      }
      if (filters.category) {
        matched = matched.filter(i => i.category === filters.category);
      }
      if (filters.maxPrice !== undefined && filters.maxPrice !== null) {
        matched = matched.filter(i => i.price <= Number(filters.maxPrice));
      }
      if (filters.q) {
        const kw = filters.q.toLowerCase();
        matched = matched.filter(
          i => i.title.toLowerCase().includes(kw) || i.subject_tag.toLowerCase().includes(kw)
        );
      }

      const page = Number(filters.page || 1);
      const limit = Number(filters.limit || 20);
      const offset = (page - 1) * limit;
      return {
        rows: matched.slice(offset, offset + limit),
        total: matched.length,
        page,
        limit
      };
    },
    async findById(itemId) {
      return items.find(i => String(i.id) === String(itemId)) || null;
    },
    async findByUserId(userId) {
      return items.filter(i => String(i.user_id) === String(userId));
    },
    async create(userId, data) {
      const row = {
        id: nextId++,
        user_id: String(userId),
        subject_id: data.subjectId ?? null,
        subject_tag: data.subjectTag,
        title: data.title,
        description: data.description ?? null,
        category: data.category || 'textbook',
        price: Number(data.price ?? 0),
        contact_info: data.contactInfo,
        image_url: data.imageUrl ?? null,
        status: 'available',
        seller_name: `Sinh viên ${userId}`,
        seller_university: 'NTTU',
        created_at: new Date('2026-11-19T05:00:00.000Z'),
        updated_at: new Date('2026-11-19T05:00:00.000Z')
      };
      items.unshift(row);
      return row;
    },
    async updateByOwner(itemId, userId, patch) {
      const row = items.find(
        i => String(i.id) === String(itemId) && String(i.user_id) === String(userId)
      );
      if (!row) return null;
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.subjectTag !== undefined) row.subject_tag = patch.subjectTag;
      if (patch.description !== undefined) row.description = patch.description;
      if (patch.category !== undefined) row.category = patch.category;
      if (patch.price !== undefined) row.price = patch.price;
      if (patch.contactInfo !== undefined) row.contact_info = patch.contactInfo;
      if (patch.status !== undefined) row.status = patch.status;
      row.updated_at = new Date('2026-11-19T05:30:00.000Z');
      return row;
    },
    async updateStatusByOwner(itemId, userId, status) {
      const row = items.find(
        i => String(i.id) === String(itemId) && String(i.user_id) === String(userId)
      );
      if (!row) return null;
      row.status = status;
      row.updated_at = new Date('2026-11-19T05:35:00.000Z');
      return row;
    },
    async deleteByOwner(itemId, userId) {
      const idx = items.findIndex(
        i => String(i.id) === String(itemId) && String(i.user_id) === String(userId)
      );
      if (idx === -1) return false;
      items.splice(idx, 1);
      return true;
    }
  };
}

function createFakeRedis() {
  const store = new Map();
  return {
    isReady: true,
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async setEx(key, ttl, value) {
      store.set(key, value);
    },
    async del(key) {
      store.delete(key);
    }
  };
}

test('Marketplace: lọc theo subject_tag và max_price=0 (tặng miễn phí)', async () => {
  const repository = createInMemoryMarketplaceRepository();
  const redisClient = createFakeRedis();
  const service = createMarketplaceService({ pool: {}, redisClient, repository });

  await service.createItem('10', {
    subjectTag: 'Lập trình Web',
    title: 'Pass giáo trình Lập trình Web + slide in sẵn',
    category: 'textbook',
    price: 0,
    contactInfo: 'Zalo: 0901234567'
  });

  await service.createItem('10', {
    subjectTag: 'Cấu trúc dữ liệu',
    title: 'Sách Cấu trúc dữ liệu & Giải thuật mới 95%',
    category: 'textbook',
    price: 45000,
    contactInfo: 'Zalo: 0901234567'
  });

  const webOnly = await service.listItems({ subjectTag: 'Lập trình Web', page: 1, limit: 20 });
  assert.equal(webOnly.data.items.length, 1);
  assert.equal(webOnly.data.items[0].subjectTag, 'Lập trình Web');
  assert.equal(webOnly.data.items[0].isFree, true);

  const freeOnly = await service.listItems({ maxPrice: 0, page: 1, limit: 20 });
  assert.equal(freeOnly.data.items.length, 1);
  assert.equal(freeOnly.data.items[0].price, 0);
});

test('Marketplace: chuyển trạng thái available -> sold và ẩn khỏi danh sách đang bán', async () => {
  const repository = createInMemoryMarketplaceRepository();
  const redisClient = createFakeRedis();
  const service = createMarketplaceService({ pool: {}, redisClient, repository });

  const created = await service.createItem('10', {
    subjectTag: 'Cơ sở dữ liệu',
    title: 'Tài liệu ôn thi Cơ sở dữ liệu có đáp án',
    category: 'notes',
    price: 20000,
    contactInfo: 'FB: fb.com/sv10'
  });

  assert.equal(created.status, 'available');

  const updated = await service.updateItemStatus('10', created.id, 'sold');
  assert.equal(updated.status, 'sold');

  const publicAvailable = await service.listItems({ page: 1, limit: 20 });
  assert.equal(publicAvailable.data.items.length, 0);

  const myItems = await service.listMyItems('10');
  assert.equal(myItems.length, 1);
  assert.equal(myItems[0].status, 'sold');
});

test('Marketplace Anti-IDOR: chặn user khác sửa, đổi trạng thái hoặc xóa tin đăng của mình', async () => {
  const repository = createInMemoryMarketplaceRepository();
  const redisClient = createFakeRedis();
  const service = createMarketplaceService({ pool: {}, redisClient, repository });

  const ownerItem = await service.createItem('10', {
    subjectTag: 'Trí tuệ nhân tạo',
    title: 'Pass lại bộ slide Trí tuệ nhân tạo đóng gáy xoắn',
    category: 'slides',
    price: 30000,
    contactInfo: 'Zalo: 0988888888'
  });

  await assert.rejects(
    () => service.updateItem('99', ownerItem.id, { price: 0 }),
    err => err.status === 403 && err.code === 'FORBIDDEN'
  );

  await assert.rejects(
    () => service.updateItemStatus('99', ownerItem.id, 'sold'),
    err => err.status === 403 && err.code === 'FORBIDDEN'
  );

  await assert.rejects(
    () => service.deleteItem('99', ownerItem.id),
    err => err.status === 403 && err.code === 'FORBIDDEN'
  );
});

test('Marketplace Redis Cache-Aside: HIT/MISS, Cache Invalidation và Graceful Fallback', async () => {
  const repository = createInMemoryMarketplaceRepository();
  const redisClient = createFakeRedis();
  const service = createMarketplaceService({ pool: {}, redisClient, repository });

  await service.createItem('10', {
    subjectTag: 'Mạng máy tính',
    title: 'Giáo trình Mạng máy tính Kurose Ross tiếng Việt',
    category: 'textbook',
    price: 50000,
    contactInfo: 'Zalo: 0911223344'
  });

  // Lần đọc 1: Cache MISS -> nạp vào Redis key marketplace:items:latest:page1
  const firstRead = await service.listItems({ page: 1, limit: 20 });
  assert.equal(firstRead.cacheStatus, 'MISS');
  assert.equal(redisClient.store.has(LATEST_PAGE1_CACHE_KEY), true);

  // Lần đọc 2: Cache HIT
  const secondRead = await service.listItems({ page: 1, limit: 20 });
  assert.equal(secondRead.cacheStatus, 'HIT');

  // Khi đổi trạng thái sang sold -> Cache bị xóa ngay lập tức (Invalidation)
  await service.updateItemStatus('10', firstRead.data.items[0].id, 'sold');
  assert.equal(redisClient.store.has(LATEST_PAGE1_CACHE_KEY), false);

  // Khi Redis mất kết nối -> Graceful Fallback về MySQL mà không crash
  redisClient.get = async () => {
    throw new Error('Redis ECONNREFUSED');
  };
  const fallbackRead = await service.listItems({ page: 1, limit: 20 });
  assert.equal(fallbackRead.cacheStatus, 'MISS');
  assert.equal(fallbackRead.data.items.length, 0);
});

test('Marketplace Validation: kiểm tra độ dài title, price >= 0 và enum status', () => {
  const badTitle = marketplaceItemCreateSchema.safeParse({
    subject_tag: 'Toán rời rạc',
    title: 'Sách', // < 5 ký tự
    price: 10000,
    contact_info: '0909090909'
  });
  assert.equal(badTitle.success, false);

  const badPrice = marketplaceItemCreateSchema.safeParse({
    subject_tag: 'Toán rời rạc',
    title: 'Giáo trình Toán rời rạc chuẩn',
    price: -5000,
    contact_info: '0909090909'
  });
  assert.equal(badPrice.success, false);

  const badStatus = marketplaceStatusUpdateSchema.safeParse({
    status: 'pending'
  });
  assert.equal(badStatus.success, false);
});
