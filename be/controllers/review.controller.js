// controllers/review.controller.js
const Review = require("../models/Review");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const asyncHandler = require("../middlewares/async.middleware");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const mongoose = require("mongoose");

const listOptions = ({ page, limit, sort } = {}, defaultSort = "-createdAt") => ({
  page: Math.max(1, parseInt(page, 10) || 1),
  limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 10)),
  sort: typeof sort === "string" && /^-?(createdAt|rating|reportCount|likes)$/.test(sort) ? sort : defaultSort,
});

const reviewList = (result) => ({
  reviews: result.docs,
  pagination: {
    totalDocs: result.totalDocs,
    totalItems: result.totalDocs,
    totalPages: result.totalPages,
    currentPage: result.page,
    limit: result.limit,
    hasNextPage: result.hasNextPage,
    hasPrevPage: result.hasPrevPage,
  },
});

// @desc      Get all reviews
// @route     GET /api/reviews
// @access    Public
exports.getReviews = asyncHandler(async (req, res) => {
  const {
    productId,
    userId,
    rating,
    verified,
    search,
  } = req.query;
  const query = { isDeleted: { $ne: true } };
  const isAdmin = req.user?.role === "admin";

  // Apply filters
  if (productId) query.productId = productId;
  if (userId) query.userId = userId;
  if ([1, 2, 3, 4, 5].includes(Number(rating))) query.rating = Number(rating);
  if (verified === "true") query.isVerifiedPurchase = true;

  if (typeof search === "string" && search.trim()) {
    const pattern = { $regex: search.trim().slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const products = await Product.find({ name: pattern }).select("_id");
    query.$or = [
      { title: pattern },
      { comment: pattern },
      { productId: { $in: products.map(product => product._id) } },
    ];
  }

  // By default, only show approved reviews
  if (!isAdmin) {
    query.isApproved = true;
    query.isRejected = { $ne: true };
  }

  const options = {
    ...listOptions(req.query),
    options: { includeUnapproved: isAdmin },
    populate: [
      { path: "userId", select: "username firstName lastName avatar" },
      { path: "productId", select: "name slug images" },
      { path: "productVariantId", select: "name color size" },
    ],
  };

  const reviews = await Review.paginate(query, options);

  return ApiResponse.success(
    res,
    reviewList(reviews),
    "Danh sách đánh giá"
  );
});

// @desc      Get single review
// @route     GET /api/reviews/:id
// @access    Public
exports.getReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id, null, { includeUnapproved: !!req.user })
    .populate("userId", "username firstName lastName avatar")
    .populate("productId", "name slug images")
    .populate("productVariantId", "name color size");

  if (!review) {
    return next(
      new ApiError(`Không tìm thấy đánh giá với id ${req.params.id}`, 404)
    );
  }

  // If review is not approved, only show to admin or the user who created it
  if (
    (!review.isApproved || review.isRejected) &&
    (!req.user ||
      (req.user.role !== "admin" &&
        String(req.user._id || req.user.id) !== review.userId?._id?.toString()))
  ) {
    return next(
      new ApiError(`Không tìm thấy đánh giá với id ${req.params.id}`, 404)
    );
  }

  return ApiResponse.success(res, review, "Chi tiết đánh giá");
});

// @desc      Create new review
// @route     POST /api/reviews
// @access    Private
exports.createReview = asyncHandler(async (req, res, next) => {
  req.body.productId = req.params?.productId || req.body.productId;
  req.body.userId = req.user.id;

  // Check if product exists
  const product = await Product.findById(req.body.productId);
  if (!product) {
    return next(
      new ApiError(`Không tìm thấy sản phẩm với id ${req.body.productId}`, 404)
    );
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
    isDeleted: false,
  }, null, { includeUnapproved: true });

  if (existingReview) {
    return next(new ApiError("Bạn đã đánh giá sản phẩm này rồi", 400));
  }

  // Check if user purchased the product (verified purchase)
  let isVerifiedPurchase = false;
  let orderId = null;

  const deliveredOrders = await Order.find({
    userId: req.user.id,
    status: "delivered",
  }).select("_id");
  const deliveredOrderIds = deliveredOrders.map((order) => order._id);
  const purchasedItem =
    deliveredOrderIds.length > 0
      ? await OrderItem.findOne({
          orderId: { $in: deliveredOrderIds },
          productId: req.body.productId,
          ...(req.body.productVariantId
            ? { variantId: req.body.productVariantId }
            : {}),
        }).select("orderId")
      : null;

  if (purchasedItem) {
    isVerifiedPurchase = true;
    orderId = purchasedItem.orderId;
  }

  // Create review
  const review = await Review.create({
    userId: req.user.id,
    productId: req.body.productId,
    productVariantId: req.body.productVariantId,
    title: req.body.title,
    comment: req.body.comment,
    rating: req.body.rating,
    isApproved: false,
    isRejected: false,
    isVerifiedPurchase,
    orderId,
  });

  return ApiResponse.created(res, review, "Tạo đánh giá thành công");
});

// @desc      Update review
// @route     PUT /api/reviews/:id
// @access    Private
exports.updateReview = asyncHandler(async (req, res, next) => {
  let review = await Review.findById(req.params.id, null, { includeUnapproved: true });

  if (!review) {
    return next(
      new ApiError(`Không tìm thấy đánh giá với id ${req.params.id}`, 404)
    );
  }

  // Make sure user is review owner or admin
  if (review.userId.toString() !== req.user.id && req.user.role !== "admin") {
    return next(new ApiError(`Bạn không có quyền cập nhật đánh giá này`, 401));
  }

  // Don't allow updating verified status or product/user.
  const { isApproved, isRejected, rejectionReason } = req.body;
  const editableFields = new Set(["title", "comment", "rating"]);
  const updateData = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => editableFields.has(key))
  );
  if (req.user.role !== "admin") {
    updateData.isApproved = false;
    updateData.isRejected = false;
  }

  // If admin is updating, allow updating approval status
  if (req.user.role === "admin") {
    if (typeof isApproved === "boolean") updateData.isApproved = isApproved;
    if (typeof isRejected === "boolean") updateData.isRejected = isRejected;
    if (rejectionReason) updateData.rejectionReason = rejectionReason;
  }

  review = await Review.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
    includeUnapproved: true,
  });

  return ApiResponse.success(res, review, "Cập nhật đánh giá thành công");
});

// @desc      Delete review
// @route     DELETE /api/reviews/:id
// @access    Private
exports.deleteReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id, null, { includeUnapproved: true });

  if (!review) {
    return next(
      new ApiError(`Không tìm thấy đánh giá với id ${req.params.id}`, 404)
    );
  }

  // Make sure user is review owner or admin
  if (review.userId.toString() !== req.user.id && req.user.role !== "admin") {
    return next(new ApiError(`Bạn không có quyền xóa đánh giá này`, 401));
  }

  // Soft delete
  review.isDeleted = true;
  await review.save();

  return ApiResponse.success(res, null, "Xóa đánh giá thành công");
});

// @desc      Report a review
// @route     POST /api/reviews/:id/report
// @access    Private
exports.reportReview = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;

  if (!reason) {
    return next(new ApiError("Vui lòng cung cấp lý do báo cáo", 400));
  }

  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(
      new ApiError(`Không tìm thấy đánh giá với id ${req.params.id}`, 404)
    );
  }

  try {
    await review.reportReview(req.user.id, reason);

    return ApiResponse.success(res, null, "Báo cáo đánh giá thành công");
  } catch (error) {
    return next(new ApiError(error.message, 400));
  }
});

// @desc      Approve a review
// @route     PUT /api/reviews/:id/approve
// @access    Private (Admin)
exports.approveReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id, null, { includeUnapproved: true });

  if (!review) {
    return next(
      new ApiError(`Không tìm thấy đánh giá với id ${req.params.id}`, 404)
    );
  }

  if (review.isApproved) {
    return next(new ApiError(`Đánh giá này đã được phê duyệt rồi`, 400));
  }

  await review.approveReview(req.user.id);

  return ApiResponse.success(res, review, "Phê duyệt đánh giá thành công");
});

// @desc      Reject a review
// @route     PUT /api/reviews/:id/reject
// @access    Private (Admin)
exports.rejectReview = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;

  const review = await Review.findById(req.params.id, null, { includeUnapproved: true });

  if (!review) {
    return next(
      new ApiError(`Không tìm thấy đánh giá với id ${req.params.id}`, 404)
    );
  }

  if (review.isRejected) {
    return next(new ApiError(`Đánh giá này đã bị từ chối rồi`, 400));
  }

  await review.rejectReview(req.user.id, reason);

  return ApiResponse.success(res, review, "Từ chối đánh giá thành công");
});

// @desc      Respond to a review (admin response)
// @route     POST /api/reviews/:id/respond
// @access    Private (Admin)
exports.respondToReview = asyncHandler(async (req, res, next) => {
  const { comment, approve = false } = req.body;

  if (typeof comment !== "string" || !comment.trim()) {
    return next(new ApiError("Vui lòng cung cấp nội dung phản hồi", 400));
  }
  if (comment.trim().length > 1000 || typeof approve !== "boolean") {
    return next(new ApiError("Nội dung phản hồi hoặc lựa chọn duyệt không hợp lệ", 400));
  }

  const review = await Review.findById(req.params.id, null, { includeUnapproved: true });

  if (!review) {
    return next(
      new ApiError(`Không tìm thấy đánh giá với id ${req.params.id}`, 404)
    );
  }

  await review.respondToReview(req.user.id, comment.trim(), approve);

  return ApiResponse.success(res, review, "Phản hồi đánh giá thành công");
});

// @desc      Get product reviews
// @route     GET /api/products/:productId/reviews
// @access    Public
exports.getProductReviews = asyncHandler(async (req, res, next) => {
  const {
    rating,
    verified,
  } = req.query;

  // Check if product exists
  const product = await Product.findById(req.params.productId);
  if (!product) {
    return next(
      new ApiError(
        `Không tìm thấy sản phẩm với id ${req.params.productId}`,
        404
      )
    );
  }

  const query = {
    productId: req.params.productId,
    isApproved: true,
    isDeleted: { $ne: true },
    isRejected: { $ne: true },
  };

  // Apply additional filters
  if ([1, 2, 3, 4, 5].includes(Number(rating))) query.rating = Number(rating);
  if (verified === "true") query.isVerifiedPurchase = true;

  const options = {
    ...listOptions(req.query),
    populate: [
      { path: "userId", select: "username firstName lastName avatar" },
      { path: "productVariantId", select: "name color size" },
    ],
  };

  const reviews = await Review.paginate(query, options);

  // Get review statistics
  const stats = await Review.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(req.params.productId),
        isApproved: true,
        isDeleted: { $ne: true },
        isRejected: { $ne: true },
      },
    },
    {
      $group: {
        _id: "$rating",
        count: { $sum: 1 },
      },
    },
    {
      $sort: { _id: -1 },
    },
  ]);

  const reviewStats = {
    totalReviews: stats.reduce((total, stat) => total + stat.count, 0),
    averageRating: 0,
    ratingCounts: {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    },
  };

  let totalRating = 0;
  stats.forEach((stat) => {
    reviewStats.ratingCounts[stat._id] = stat.count;
    totalRating += stat._id * stat.count;
  });

  if (reviewStats.totalReviews > 0) {
    reviewStats.averageRating = (
      totalRating / reviewStats.totalReviews
    ).toFixed(1);
  }

  return ApiResponse.success(
    res,
    {
      stats: reviewStats,
      ...reviewList(reviews),
    },
    "Đánh giá sản phẩm"
  );
});

// @desc      Get pending reviews (admin)
// @route     GET /api/reviews/admin/pending
// @access    Private (Admin)
exports.getPendingReviews = asyncHandler(async (req, res) => {
  const query = {
    isApproved: false,
    isRejected: false,
    isDeleted: { $ne: true },
  };

  const options = {
    ...listOptions(req.query),
    options: { includeUnapproved: true },
    populate: [
      { path: "userId", select: "username firstName lastName avatar" },
      { path: "productId", select: "name slug images" },
    ],
  };

  const reviews = await Review.paginate(query, options);

  return ApiResponse.success(
    res,
    reviewList(reviews),
    "Danh sách đánh giá chờ phê duyệt"
  );
});

// @desc      Get reported reviews (admin)
// @route     GET /api/reviews/admin/reported
// @access    Private (Admin)
exports.getReportedReviews = asyncHandler(async (req, res) => {
  const query = {
    reportCount: { $gt: 0 },
    isDeleted: { $ne: true },
  };

  const options = {
    ...listOptions(req.query, "-reportCount"),
    options: { includeUnapproved: true },
    populate: [
      { path: "userId", select: "username firstName lastName avatar" },
      { path: "productId", select: "name slug images" },
    ],
  };

  const reviews = await Review.paginate(query, options);

  return ApiResponse.success(
    res,
    reviewList(reviews),
    "Danh sách đánh giá bị báo cáo"
  );
});
