const express = require('express');
const router = express.Router();
const categoryController = require('../../controllers/category.controller');
const { protect, authorize } = require('../../middlewares/auth.middleware');
const { uploadCategoryImage } = require('../../middlewares/upload.middleware');

router.get('/', categoryController.getCategories);
router.get('/featured', categoryController.getFeaturedCategories);
router.get('/:id/products', categoryController.getCategoryProducts);
router.get('/:id', categoryController.getCategory);

// Static mutation route must be registered before PUT /:id.
router.put(
  '/reorder',
  protect,
  authorize('admin', 'staff'),
  categoryController.reorderCategories
);

router.post(
  '/',
  protect,
  authorize('admin', 'staff'),
  uploadCategoryImage,
  categoryController.createCategory
);

router.put(
  '/:id',
  protect,
  authorize('admin', 'staff'),
  uploadCategoryImage,
  categoryController.updateCategory
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  categoryController.deleteCategory
);

router.put(
  '/:id/restore',
  protect,
  authorize('admin'),
  categoryController.restoreCategory
);

module.exports = router;
