// be/routes/api/reviews.routes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middlewares/auth.middleware');
const {
  getReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
  reportReview,
  approveReview,
  rejectReview,
  respondToReview,
  getPendingReviews,
  getReportedReviews
} = require('../../controllers/review.controller');

// @route   /api/reviews
router.get('/', getReviews);
router.get('/admin/pending', protect, authorize('admin'), getPendingReviews);
router.get('/admin/reported', protect, authorize('admin'), getReportedReviews);
router.get('/:id', getReview);

router.post('/', protect, createReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);
router.post('/:id/report', protect, reportReview);

router.put('/:id/approve', protect, authorize('admin'), approveReview);
router.put('/:id/reject', protect, authorize('admin'), rejectReview);
router.post('/:id/respond', protect, authorize('admin'), respondToReview);

module.exports = router;
