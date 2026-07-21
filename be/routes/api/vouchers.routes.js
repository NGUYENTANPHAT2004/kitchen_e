// be/routes/api/vouchers.routes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middlewares/auth.middleware');
const ApiError = require('../../utils/apiError');
const {
  getVouchers,
  getVoucher,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  assignVoucherToUser,
  assignVoucherToMultipleUsers,
  getPublicVouchers,
  applyVoucher,
  useVoucher,
  getUserVouchers
} = require('../../controllers/voucher.controller');

// @route   /api/vouchers

// Public routes
router.get('/public', getPublicVouchers);

// Protected routes (logged in users)
router.post('/apply', protect, applyVoucher);
router.put('/:id/use', protect, useVoucher);

// Admin only routes
router.get('/', protect, authorize('admin'), getVouchers);
router.get('/:id', protect, authorize('admin'), getVoucher);
router.post('/', protect, authorize('admin'), createVoucher);
router.put('/:id', protect, authorize('admin'), updateVoucher);
router.delete('/:id', protect, authorize('admin'), deleteVoucher);
router.post('/:id/assign', protect, authorize('admin'), assignVoucherToUser);
router.post('/:id/assign-bulk', protect, authorize('admin'), assignVoucherToMultipleUsers);

router.get('/users/:userId/vouchers', protect, (req, res, next) => {

  if (req.user.role === 'admin' || req.user.id === req.params.userId) {
    next();
  } else {
    return next(new ApiError('Bạn không có quyền truy cập tài nguyên này', 403));
  }
}, getUserVouchers);

module.exports = router;