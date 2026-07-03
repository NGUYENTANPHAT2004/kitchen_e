// controllers/review.controller.js
const Review = require('../models/Review');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const asyncHandler = require('../middlewares/async.middleware');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const mongoose = require('mongoose');

// @desc      Get all reviews
// @route     GET /api/reviews
// @access    Public
exports.getReviews = asyncHandler(async (req, res, next) => {
  const { productId, userId, rating, verified, page = 1, limit = 10, sort = '-createdAt' } = req.query;
  const query = {};
  
  // Apply filters
  if (productId) query.productId = productId;
  if (userId) query.userId = userId;
  if (rating) query.rating = parseInt(rating);
  if (verified === 'true') query.isVerifiedPurchase = true;
  
  // By default, only show approved reviews
  if (!req.user || req.user.role !== 'admin') {
    query.isApproved = true;
    query.isDeleted = false;
  }
  
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort,
    populate: [
      { path: 'userId', select: 'username firstName lastName avatar' },
      { path: 'productId', select: 'name slug images' },
      { path: 'productVariantId', select: 'name color size' }
    ]
  };
  
  const reviews = await Review.paginate(query, options);
  
  return ApiResponse.success(res, {
    reviews: reviews.docs,
    pagination: {
      totalDocs: reviews.totalDocs,
      totalPages: reviews.totalPages,
      currentPage: reviews.page,
      hasNextPage: reviews.hasNextPage,
      hasPrevPage: reviews.hasPrevPage
    }
  }, 'Danh sách đánh giá');
});

// @desc      Get single review
// @route     GET /api/reviews/:id
// @access    Public
exports.getReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id)
    .populate('userId', 'username firstName lastName avatar')
    .populate('productId', 'name slug images')
    .populate('productVariantId', 'name color size');
  
  if (!review) {
    return next(new ApiError(`Không tìm thấy đánh giá với id ${req.params.id}`, 404));
  }
  
  // If review is not approved, only show to admin or the user who created it
  if (!review.isApproved && (!req.user || (req.user.role !== 'admin' && req.user._id.toString() !== review.userId._id.toString()))) {
    return next(new ApiError(`Không tìm thấy đánh giá với id ${req.params.id}`, 404));
  }
  
  return ApiResponse.success(res, review, 'Chi tiết đánh giá');
});

// @desc      Create new review
// @route     POST /api/reviews
// @access    Private
exports.createReview = asyncHandler(async (req, res, next) => {
  // Add user ID to request body
  req.body.userId = req.user.id;
  
  // Check if product exists
  const product = await Product.findById(req.body.productId);
  if (!product) {
    return next(new ApiError(`Không tìm thấy sản phẩm với id ${req.body.productId}`, 404));
  }
  
  // Check if variant exists if provided
  if (req.body.productVariantId) {
    const variant = await ProductVariant.findById(req.body.productVariantId);
    if (!variant || variant.productId.toString() !== req.body.productId) {
      return next(new ApiError(`Biến thể sản phẩm không hợp lệ`, 400));
    }
  }
  
  // Check if user already reviewed this product
  const existingReview = await Review.findOne({
    userId: req.user.id,
    productId: req.body.productId,
    isDeleted: false
  });
  
  if (existingReview) {
    return next(new ApiError('Bạn đã đánh giá sản phẩm này rồi', 400));
  }
  
  // Check if user purchased the product (verified purchase)
  let isVerifiedPurchase = false;
  let orderId = null;
  
  // Simple version - in a real app, you would implement more complex logic
  // to find user's orders containing this product
  const orders = await Order.find({
    userId: req.user.id,
    'items.productId': req.body.productId,
    status: 'delivered'
  }).sort('-createdAt');
  
  if (orders.length > 0) {
    isVerifiedPurchase = true;
    orderId = orders[0]._id;
  }
  
  // Create review
  const review = await Review.create({
    ...req.body,
    isVerifiedPurchase,
    orderId
  });
  
  return ApiResponse.created(res, review, 'Tạo đánh giá thành công');
});

// @desc      Update review
// @route     PUT /api/reviews/:id
// @access    Private
exports.updateReview = asyncHandler(async (req, res, next) => {
  let review = await Review.findById(req.params.id);
  
  if (!review) {
    return next(new ApiError(`Không tìm thấy đánh giá với id ${req.params.id}`, 404));
  }
  
  // Make sure user is review owner or admin
  if (review.userId.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ApiError(`Bạn không có quyền cập nhật đánh giá này`, 401));
  }
  
  // Don't allow updating verified status or product/user
  const {
    isVerifiedPurchase, userId, productId, orderId, isApproved,
    isRejected, rejectionReason, ...updateData
  } = req.body;
  
  // If admin is updating, allow updating approval status
  if (req.user.role === 'admin') {
    if (typeof isApproved === 'boolean') updateData.isApproved = isApproved;
    if (typeof isRejected === 'boolean') updateData.isRejected = isRejected;
    if (rejectionReason) updateData.rejectionReason = rejectionReason;
  }
  
  review = await Review.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true
  });
  
  return ApiResponse.success(res, review, 'Cập nhật đánh giá thành công');
});

// @desc      Delete review
// @route     DELETE /api/reviews/:id
// @access    Private
exports.deleteReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  
  if (!review) {
    return next(new ApiError(`Không tìm thấy đánh giá với id ${req.params.id}`, 404));
  }
  
  // Make sure user is review owner or admin
  if (review.userId.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ApiError(`Bạn không có quyền xóa đánh giá này`, 401));
  }
  
  // Soft delete
  review.isDeleted = true;
  await review.save();
  
  return ApiResponse.success(res, null, 'Xóa đánh giá thành công');
});

// @desc      Report a review
// @route     POST /api/reviews/:id/report
// @access    Private
exports.reportReview = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;
  
  if (!reason) {
    return next(new ApiError('Vui lòng cung cấp lý do báo cáo', 400));
  }
  
  const review = await Review.findById(req.params.id);
  
  if (!review) {
    return next(new ApiError(`Không tìm thấy đánh giá với id ${req.params.id}`, 404));
  }
  
  try {
    await review.reportReview(req.user.id, reason);
    
    return ApiResponse.success(res, null, 'Báo cáo đánh giá thành công');
  } catch (error) {
    return next(new ApiError(error.message, 400));
  }
});

// @desc      Approve a review
// @route     PUT /api/reviews/:id/approve
// @access    Private (Admin)
exports.approveReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  
  if (!review) {
    return next(new ApiError(`Không tìm thấy đánh giá với id ${req.params.id}`, 404));
  }
  
  if (review.isApproved) {
    return next(new ApiError(`Đánh giá này đã được phê duyệt rồi`, 400));
  }
  
  await review.approveReview(req.user.id);
  
  return ApiResponse.success(res, review, 'Phê duyệt đánh giá thành công');
});

// @desc      Reject a review
// @route     PUT /api/reviews/:id/reject
// @access    Private (Admin)
exports.rejectReview = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;
  
  const review = await Review.findById(req.params.id);
  
  if (!review) {
    return next(new ApiError(`Không tìm thấy đánh giá với id ${req.params.id}`, 404));
  }
  
  if (review.isRejected) {
    return next(new ApiError(`Đánh giá này đã bị từ chối rồi`, 400));
  }
  
  await review.rejectReview(req.user.id, reason);
  
  return ApiResponse.success(res, review, 'Từ chối đánh giá thành công');
});

// @desc      Respond to a review (admin response)
// @route     POST /api/reviews/:id/respond
// @access    Private (Admin)
exports.respondToReview = asyncHandler(async (req, res, next) => {
  const { comment } = req.body;
  
  if (!comment) {
    return next(new ApiError('Vui lòng cung cấp nội dung phản hồi', 400));
  }
  
  const review = await Review.findById(req.params.id);
  
  if (!review) {
    return next(new ApiError(`Không tìm thấy đánh giá với id ${req.params.id}`, 404));
  }
  
  await review.respondToReview(req.user.id, comment);
  
  return ApiResponse.success(res, review, 'Phản hồi đánh giá thành công');
});

// @desc      Get product reviews
// @route     GET /api/products/:productId/reviews
// @access    Public
exports.getProductReviews = asyncHandler(async (req, res, next) => {
  const { rating, verified, page = 1, limit = 10, sort = '-createdAt' } = req.query;
  
  // Check if product exists
  const product = await Product.findById(req.params.productId);
  if (!product) {
    return next(new ApiError(`Không tìm thấy sản phẩm với id ${req.params.productId}`, 404));
  }
  
  const query = {
    productId: req.params.productId,
    isApproved: true,
    isDeleted: false
  };
  
  // Apply additional filters
  if (rating) query.rating = parseInt(rating);
  if (verified === 'true') query.isVerifiedPurchase = true;
  
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort,
    populate: [
      { path: 'userId', select: 'username firstName lastName avatar' },
      { path: 'productVariantId', select: 'name color size' }
    ]
  };
  
  const reviews = await Review.paginate(query, options);
  
  // Get review statistics
  const stats = await Review.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(req.params.productId),
        isApproved: true,
        isDeleted: false
      }
    },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: -1 }
    }
  ]);
  
  const reviewStats = {
    totalReviews: reviews.totalDocs,
    averageRating: 0,
    ratingCounts: {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0
    }
  };
  
  let totalRating = 0;
  stats.forEach(stat => {
    reviewStats.ratingCounts[stat._id] = stat.count;
    totalRating += stat._id * stat.count;
  });
  
  if (reviewStats.totalReviews > 0) {
    reviewStats.averageRating = (totalRating / reviewStats.totalReviews).toFixed(1);
  }
  
  return ApiResponse.success(res, {
    stats: reviewStats,
    reviews: reviews.docs,
    pagination: {
      totalPages: reviews.totalPages,
      currentPage: reviews.page,
      hasNextPage: reviews.hasNextPage,
      hasPrevPage: reviews.hasPrevPage
    }
  }, 'Đánh giá sản phẩm');
});

// @desc      Get pending reviews (admin)
// @route     GET /api/reviews/pending
// @access    Private (Admin)
exports.getPendingReviews = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  
  const query = {
    isApproved: false,
    isRejected: false,
    isDeleted: false
  };
  
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: '-createdAt',
    populate: [
      { path: 'userId', select: 'username firstName lastName avatar' },
      { path: 'productId', select: 'name slug images' }
    ]
  };
  
  const reviews = await Review.paginate(query, options);
  
  return ApiResponse.success(res, {
    reviews: reviews.docs,
    pagination: {
      totalDocs: reviews.totalDocs,
      totalPages: reviews.totalPages,
      currentPage: reviews.page,
      hasNextPage: reviews.hasNextPage,
      hasPrevPage: reviews.hasPrevPage
    }
  }, 'Danh sách đánh giá chờ phê duyệt');
});

// @desc      Get reported reviews (admin)
// @route     GET /api/reviews/reported
// @access    Private (Admin)
exports.getReportedReviews = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  
  const query = {
    reportCount: { $gt: 0 },
    isDeleted: false
  };
  
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: '-reportCount',
    populate: [
      { path: 'userId', select: 'username firstName lastName avatar' },
      { path: 'productId', select: 'name slug images' }
    ]
  };
  
  const reviews = await Review.paginate(query, options);
  
  return ApiResponse.success(res, {
    reviews: reviews.docs,
    pagination: {
      totalDocs: reviews.totalDocs,
      totalPages: reviews.totalPages,
      currentPage: reviews.page,
      hasNextPage: reviews.hasNextPage,
      hasPrevPage: reviews.hasPrevPage
    }
  }, 'Danh sách đánh giá bị báo cáo');
});