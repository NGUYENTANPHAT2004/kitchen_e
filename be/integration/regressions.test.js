const request = require('supertest');
const express = require('express');
const FlashSaleItem = require('../models/FlashSaleItem');
const notificationsRouter = require('../routes/api/notifications.routes');
const categoriesRouter = require('../routes/api/categories.routes');
const bundlesRouter = require('../routes/api/bundles.routes');
const vouchersRouter = require('../routes/api/vouchers.routes');
const { createStaticMiddleware } = require('../middlewares/static.middleware');

jest.mock('../models/Product', () => ({ findOneAndUpdate: jest.fn() }));
jest.mock('../models/ProductVariant', () => ({ findOneAndUpdate: jest.fn() }));
jest.mock('../models/FlashSaleItem', () => {
  const actual = jest.requireActual('../models/FlashSaleItem');
  actual.findOneAndUpdate = jest.fn();
  return actual;
});

const Product = require('../models/Product');
const FlashSaleModel = require('../models/FlashSaleItem');
const inventoryService = require('../services/inventory.service');

const routeSignatures = (router) => router.stack
  .filter((layer) => layer.route)
  .map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);

describe('Routing regressions', () => {
  test('specific notification routes precede /:id', () => {
    const routes = routeSignatures(notificationsRouter);
    expect(routes.indexOf('GET /unread-count')).toBeLessThan(routes.indexOf('GET /:id'));
    expect(routes.indexOf('DELETE /read')).toBeLessThan(routes.indexOf('DELETE /:id'));
  });

  test('category reorder precedes PUT /:id', () => {
    const routes = routeSignatures(categoriesRouter);
    expect(routes.indexOf('PUT /reorder')).toBeLessThan(routes.indexOf('PUT /:id'));
  });

  test('bundle item reorder precedes PUT /:bundleId/items/:id', () => {
    const routes = routeSignatures(bundlesRouter);
    expect(routes.indexOf('PUT /:bundleId/items/reorder'))
      .toBeLessThan(routes.indexOf('PUT /:bundleId/items/:id'));
  });

  test('voucher router can load its authorization guard', () => {
    expect(vouchersRouter.stack.some((layer) => layer.route?.path === '/users/:userId/vouchers')).toBe(true);
  });
});

describe('Flash-sale and inventory regressions', () => {
  test('remainingQuantity is derived from quantitySold', () => {
    const item = new FlashSaleItem({ quantity: 10, quantitySold: 3 });
    expect(item.remainingQuantity).toBe(7);
    expect(FlashSaleItem.schema.path('quantitySold')).toBeDefined();
    expect(FlashSaleItem.schema.path('usedQuantity')).toBeUndefined();
  });

  test('reserves product stock with an atomic conditional decrement', async () => {
    Product.findOneAndUpdate.mockResolvedValue({ _id: 'p1', stockQuantity: 2 });

    await inventoryService.reserveProductStock({
      productId: 'p1',
      quantity: 1,
      session: 'session-1'
    });

    expect(Product.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'p1', stockQuantity: { $gte: 1 } },
      { $inc: { stockQuantity: -1 } },
      { session: 'session-1', new: true }
    );
  });

  test('uses quantitySold for flash-sale reservation and release', async () => {
    FlashSaleModel.findOneAndUpdate.mockResolvedValue({ _id: 'fs1' });

    await inventoryService.reserveFlashSaleStock({
      flashSaleItemId: 'fs1',
      quantity: 2,
      session: 'session-2'
    });
    await inventoryService.releaseFlashSaleStock({
      flashSaleItemId: 'fs1',
      quantity: 2,
      session: 'session-2'
    });

    expect(FlashSaleModel.findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      {
        _id: 'fs1',
        isActive: true,
        $expr: { $lte: ['$quantitySold', { $subtract: ['$quantity', 2] }] }
      },
      { $inc: { quantitySold: 2 } },
      { session: 'session-2', new: true }
    );
    expect(FlashSaleModel.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { _id: 'fs1', quantitySold: { $gte: 2 } },
      { $inc: { quantitySold: -2 } },
      { session: 'session-2', new: true }
    );
  });
});

describe('Static file fallback', () => {
  test('serves the configured SVG fallback for a missing image', async () => {
    const app = express();
    app.use('/uploads', createStaticMiddleware());

    const response = await request(app).get('/uploads/missing-image.jpg');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/image\/svg\+xml/);
    expect(response.body.toString('utf8')).toMatch(/No Image/);
  });
});
