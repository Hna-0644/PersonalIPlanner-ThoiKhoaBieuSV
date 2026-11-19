const { asyncHandler } = require('../utils/async-handler');

function createMarketplaceController(marketplaceService) {
  const listItems = asyncHandler(async (req, res) => {
    const { data, cacheStatus } = await marketplaceService.listItems(req.query);
    res.set('X-Cache', cacheStatus);
    res.json({ data });
  });

  const getItemDetail = asyncHandler(async (req, res) => {
    const data = await marketplaceService.getItemById(req.params.id);
    res.json({ data });
  });

  const listMyItems = asyncHandler(async (req, res) => {
    const data = await marketplaceService.listMyItems(req.user.id);
    res.json({ data });
  });

  const createItem = asyncHandler(async (req, res) => {
    const data = await marketplaceService.createItem(req.user.id, req.body);
    res.status(201).json({ data });
  });

  const updateItem = asyncHandler(async (req, res) => {
    const data = await marketplaceService.updateItem(req.user.id, req.params.id, req.body);
    res.json({ data });
  });

  const updateItemStatus = asyncHandler(async (req, res) => {
    const data = await marketplaceService.updateItemStatus(
      req.user.id,
      req.params.id,
      req.body.status
    );
    res.json({ data });
  });

  const deleteItem = asyncHandler(async (req, res) => {
    const data = await marketplaceService.deleteItem(req.user.id, req.params.id);
    res.json({ data });
  });

  return {
    listItems,
    getItemDetail,
    listMyItems,
    createItem,
    updateItem,
    updateItemStatus,
    deleteItem
  };
}

module.exports = { createMarketplaceController };
