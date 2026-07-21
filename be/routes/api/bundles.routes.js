// routes/api/bundles.routes.js
const express = require('express');
const router = express.Router();
const bundleController = require('../../controllers/bundle.controller');
const bundleItemController = require('../../controllers/bundle-item.controller');
const { protect, authorize } = require('../../middlewares/auth.middleware');
const { uploadSingle } = require('../../middlewares/upload.middleware');

router.get('/', bundleController.getBundles);
router.get('/featured', bundleController.getFeaturedBundles);
router.get('/active', bundleController.getActiveBundles);
router.get('/:id', bundleController.getBundle);

router.post(
  '/',
  protect,
  authorize('admin', 'staff'),
  uploadSingle('image'),
  bundleController.createBundle
);

router.put(
  '/:id',
  protect,
  authorize('admin', 'staff'),
  uploadSingle('image'),
  bundleController.updateBundle
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  bundleController.deleteBundle
);

router.put(
  '/:id/restore',
  protect,
  authorize('admin'),
  bundleController.restoreBundle
);

router.post(
  '/:id/calculate',
  protect,
  authorize('admin', 'staff'),
  bundleController.calculateBundlePrices
);

// Reorder must be registered before /:bundleId/items/:id.
router.put(
  '/:bundleId/items/reorder',
  protect,
  authorize('admin', 'staff'),
  bundleItemController.reorderBundleItems
);

router.get('/:bundleId/items', bundleItemController.getBundleItems);
router.post(
  '/:bundleId/items',
  protect,
  authorize('admin', 'staff'),
  bundleItemController.addBundleItem
);

router.get('/:bundleId/items/:id', bundleItemController.getBundleItem);
router.get('/:bundleId/items/:id/alternatives', bundleItemController.getItemAlternatives);
router.put(
  '/:bundleId/items/:id',
  protect,
  authorize('admin', 'staff'),
  bundleItemController.updateBundleItem
);
router.delete(
  '/:bundleId/items/:id',
  protect,
  authorize('admin', 'staff'),
  bundleItemController.removeBundleItem
);

module.exports = router;
