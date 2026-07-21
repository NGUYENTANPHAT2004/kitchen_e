// controllers/voucher.controller.js
const Voucher = require('../models/Voucher');
const UserVoucher = require('../models/UserVoucher');
const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');
const Cart = require('../models/Cart');
const CartItem = require('../models/CartItem');
const pricingService = require('../services/pricing.service');
const voucherService = require('../services/voucher.service');
const asyncHandler = require('../middlewares/async.middleware');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

// @desc      Get all vouchers
// @route     GET /api/vouchers
// @access    Private (Admin)
exports.getVouchers = asyncHandler(async (req, res, _next) => {
  const { active, expired, page = 1, limit = 10 } = req.query;
  const query = { isDeleted: false };
  
  // Filter for active vouchers
  if (active === 'true') {
    const now = new Date();
    query.startDate = { $lte: now };
    query.endDate = { $gte: now };
    query.isActive = true;
  }
  
  // Filter for expired vouchers
  if (expired === 'true') {
    const now = new Date();
    query.endDate = { $lt: now };
  }
  
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { endDate: 1 },
    populate: [
      { path: 'categoryIds', select: 'name' },
      { path: 'productIds', select: 'name' }
    ]
  };
  
  const vouchers = await Voucher.paginate(query, options);
  
  return ApiResponse.success(res, {
    vouchers: vouchers.docs,
    pagination: {
      totalDocs: vouchers.totalDocs,
      totalPages: vouchers.totalPages,
      currentPage: vouchers.page,
      hasNextPage: vouchers.hasNextPage,
      hasPrevPage: vouchers.hasPrevPage
    }
  }, 'Danh sách mã giảm giá');
});

// @desc      Get single voucher
// @route     GET /api/vouchers/:id
// @access    Private (Admin)
exports.getVoucher = asyncHandler(async (req, res, next) => {
  const voucher = await Voucher.findById(req.params.id)
    .populate('categoryIds', 'name')
    .populate('productIds', 'name');
  
  if (!voucher) {
    return next(new ApiError(`Không tìm thấy mã giảm giá với id ${req.params.id}`, 404));
  }
  
  // Get usage statistics
  const userVouchersCount = await UserVoucher.countDocuments({ voucherId: req.params.id });
  const usedVouchersCount = await UserVoucher.countDocuments({ voucherId: req.params.id, isUsed: true });
  
  const voucherWithStats = {
    ...voucher.toObject(),
    stats: {
      assigned: userVouchersCount,
      used: usedVouchersCount,
      available: userVouchersCount - usedVouchersCount
    }
  };
  
  return ApiResponse.success(res, voucherWithStats, 'Chi tiết mã giảm giá');
});

// @desc      Create new voucher
// @route     POST /api/vouchers
// @access    Private (Admin)
exports.createVoucher = asyncHandler(async (req, res, next) => {
  // Validate dates
  const { startDate, endDate, categoryIds, productIds } = req.body;
  
  if (new Date(startDate) >= new Date(endDate)) {
    return next(new ApiError('Ngày kết thúc phải sau ngày bắt đầu', 400));
  }
  
  // Validate categories if provided
  if (categoryIds && categoryIds.length > 0) {
    const categories = await Category.find({ _id: { $in: categoryIds } });
    if (categories.length !== categoryIds.length) {
      return next(new ApiError('Một hoặc nhiều danh mục không hợp lệ', 400));
    }
  }
  
  // Validate products if provided
  if (productIds && productIds.length > 0) {
    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length !== productIds.length) {
      return next(new ApiError('Một hoặc nhiều sản phẩm không hợp lệ', 400));
    }
  }
  
  // Create voucher
  const voucher = await Voucher.create(req.body);
  
  return ApiResponse.created(res, voucher, 'Tạo mã giảm giá thành công');
});

// @desc      Update voucher
// @route     PUT /api/vouchers/:id
// @access    Private (Admin)
exports.updateVoucher = asyncHandler(async (req, res, next) => {
  let voucher = await Voucher.findById(req.params.id);
  
  if (!voucher) {
    return next(new ApiError(`Không tìm thấy mã giảm giá với id ${req.params.id}`, 404));
  }
  
  // Validate dates if updating
  if (req.body.startDate && req.body.endDate) {
    if (new Date(req.body.startDate) >= new Date(req.body.endDate)) {
      return next(new ApiError('Ngày kết thúc phải sau ngày bắt đầu', 400));
    }
  } else if (req.body.startDate && !req.body.endDate) {
    if (new Date(req.body.startDate) >= new Date(voucher.endDate)) {
      return next(new ApiError('Ngày bắt đầu phải trước ngày kết thúc', 400));
    }
  } else if (!req.body.startDate && req.body.endDate) {
    if (new Date(voucher.startDate) >= new Date(req.body.endDate)) {
      return next(new ApiError('Ngày kết thúc phải sau ngày bắt đầu', 400));
    }
  }
  
  // Validate categories if provided
  if (req.body.categoryIds && req.body.categoryIds.length > 0) {
    const categories = await Category.find({ _id: { $in: req.body.categoryIds } });
    if (categories.length !== req.body.categoryIds.length) {
      return next(new ApiError('Một hoặc nhiều danh mục không hợp lệ', 400));
    }
  }
  
  // Validate products if provided
  if (req.body.productIds && req.body.productIds.length > 0) {
    const products = await Product.find({ _id: { $in: req.body.productIds } });
    if (products.length !== req.body.productIds.length) {
      return next(new ApiError('Một hoặc nhiều sản phẩm không hợp lệ', 400));
    }
  }
  
  voucher = await Voucher.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  return ApiResponse.success(res, voucher, 'Cập nhật mã giảm giá thành công');
});

// @desc      Delete voucher
// @route     DELETE /api/vouchers/:id
// @access    Private (Admin)
exports.deleteVoucher = asyncHandler(async (req, res, next) => {
  const voucher = await Voucher.findById(req.params.id);
  
  if (!voucher) {
    return next(new ApiError(`Không tìm thấy mã giảm giá với id ${req.params.id}`, 404));
  }
  
  // Soft delete
  voucher.isDeleted = true;
  voucher.isActive = false;
  await voucher.save();
  
  // Also mark all user vouchers as deleted
  await UserVoucher.updateMany(
    { voucherId: req.params.id },
    { isDeleted: true }
  );
  
  return ApiResponse.success(res, null, 'Xóa mã giảm giá thành công');
});

// @desc      Assign voucher to user
// @route     POST /api/vouchers/:id/assign
// @access    Private (Admin)
exports.assignVoucherToUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.body;
  
  if (!userId) {
    return next(new ApiError('Vui lòng cung cấp ID người dùng', 400));
  }
  
  // Check if voucher exists
  const voucher = await Voucher.findById(req.params.id);
  if (!voucher) {
    return next(new ApiError(`Không tìm thấy mã giảm giá với id ${req.params.id}`, 404));
  }
  
  // Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    return next(new ApiError(`Không tìm thấy người dùng với id ${userId}`, 404));
  }
  
  // Check if voucher is active
  if (!voucher.isActive) {
    return next(new ApiError('Mã giảm giá này không còn hoạt động', 400));
  }
  
  // Check if voucher is expired
  const now = new Date();
  if (now < voucher.startDate || now > voucher.endDate) {
    return next(new ApiError('Mã giảm giá này đã hết hạn hoặc chưa bắt đầu', 400));
  }
  
  // Check if user already has this voucher
  const existingUserVoucher = await UserVoucher.findOne({
    userId,
    voucherId: req.params.id,
    isDeleted: false
  });
  
  if (existingUserVoucher) {
    return next(new ApiError('Người dùng đã có mã giảm giá này', 400));
  }
  
  // Create user voucher
  const userVoucher = await UserVoucher.create({
    userId,
    voucherId: req.params.id,
    expiresAt: voucher.endDate
  });
  
  return ApiResponse.success(res, userVoucher, 'Gán mã giảm giá cho người dùng thành công');
});

// @desc      Assign voucher to multiple users
// @route     POST /api/vouchers/:id/assign-bulk
// @access    Private (Admin)
exports.assignVoucherToMultipleUsers = asyncHandler(async (req, res, next) => {
  const { userIds } = req.body;
  
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return next(new ApiError('Vui lòng cung cấp danh sách ID người dùng', 400));
  }
  
  // Check if voucher exists
  const voucher = await Voucher.findById(req.params.id);
  if (!voucher) {
    return next(new ApiError(`Không tìm thấy mã giảm giá với id ${req.params.id}`, 404));
  }
  
  // Check if voucher is active
  if (!voucher.isActive) {
    return next(new ApiError('Mã giảm giá này không còn hoạt động', 400));
  }
  
  // Check if voucher is expired
  const now = new Date();
  if (now < voucher.startDate || now > voucher.endDate) {
    return next(new ApiError('Mã giảm giá này đã hết hạn hoặc chưa bắt đầu', 400));
  }
  
  // Check if users exist
  const users = await User.find({ _id: { $in: userIds } });
  if (users.length !== userIds.length) {
    return next(new ApiError('Một hoặc nhiều người dùng không tồn tại', 400));
  }
  
  // Get existing user vouchers
  const existingUserVouchers = await UserVoucher.find({
    userId: { $in: userIds },
    voucherId: req.params.id,
    isDeleted: false
  });
  
  const existingUserIds = existingUserVouchers.map(uv => uv.userId.toString());
  const newUserIds = userIds.filter(id => !existingUserIds.includes(id.toString()));
  
  // Create user vouchers for new users
  const userVouchers = await UserVoucher.insertMany(
    newUserIds.map(userId => ({
      userId,
      voucherId: req.params.id,
      expiresAt: voucher.endDate
    }))
  );
  
  return ApiResponse.success(
    res, 
    {
      assigned: userVouchers.length,
      alreadyAssigned: existingUserIds.length,
      total: userIds.length
    }, 
    'Gán mã giảm giá cho nhiều người dùng thành công'
  );
});

// @desc      Get user vouchers
// @route     GET /api/users/:userId/vouchers
// @access    Private
exports.getUserVouchers = asyncHandler(async (req, res, _next) => {
  const { active, page = 1, limit = 10 } = req.query;
  const query = { 
    userId: req.params.userId,
    isDeleted: false
  };
  
  // Filter for active/usable vouchers
  if (active === 'true') {
    const now = new Date();
    query.isUsed = false;
    query.expiresAt = { $gte: now };
  }
  
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { expiresAt: 1 },
    populate: {
      path: 'voucherId',
      match: { isActive: true, isDeleted: false }
    }
  };
  
  const userVouchers = await UserVoucher.paginate(query, options);
  
  // Filter out vouchers where populated voucherId is null (because of match condition)
  const filteredVouchers = userVouchers.docs.filter(uv => uv.voucherId);
  
  return ApiResponse.success(res, {
    vouchers: filteredVouchers,
    pagination: {
      totalDocs: filteredVouchers.length,
      totalPages: userVouchers.totalPages,
      currentPage: userVouchers.page,
      hasNextPage: userVouchers.hasNextPage,
      hasPrevPage: userVouchers.hasPrevPage
    }
  }, 'Danh sách mã giảm giá của người dùng');
});

// @desc      Get public vouchers
// @route     GET /api/vouchers/public
// @access    Public
exports.getPublicVouchers = asyncHandler(async (req, res, _next) => {
  const now = new Date();
  
  const query = {
    isActive: true,
    isDeleted: false,
    isPrivate: false,
    startDate: { $lte: now },
    endDate: { $gte: now }
  };
  
  // Add maxUsage check
  query.$or = [
    { maxUsage: 0 }, // Unlimited
    { $expr: { $lt: ['$currentUsage', '$maxUsage'] } } // Has remaining uses
  ];
  
  const vouchers = await Voucher.find(query)
    .select('code description discountType discountValue minOrderValue startDate endDate categoryIds productIds')
    .populate('categoryIds', 'name')
    .populate('productIds', 'name slug')
    .sort('endDate');
  
  return ApiResponse.success(res, vouchers, 'Danh sách mã giảm giá công khai');
});

// @desc      Apply voucher (check validity)
// @route     POST /api/vouchers/apply
// @access    Private
exports.applyVoucher = asyncHandler(async (req, res, next) => {
  const { code } = req.body;
  if (!code) {
    return next(new ApiError('Please provide a voucher code', 400));
  }

  const cart = await Cart.findOne({ userId: req.user._id, status: 'active' });
  if (!cart) {
    return next(new ApiError('Active cart not found', 404));
  }

  const cartItems = await CartItem.find({ cartId: cart._id })
    .populate('productId')
    .populate('variantId')
    .populate({ path: 'flashSaleItemId', populate: 'flashSaleId' });
  if (cartItems.length === 0) {
    return next(new ApiError('Cart is empty', 400));
  }

  const pricedCart = pricingService.priceCartItems(cartItems);
  const voucherItems = pricedCart.lines.map(({ item, lineTotal }) => ({
    ...(typeof item.toObject === 'function' ? item.toObject() : item),
    lineTotal
  }));
  const result = await voucherService.validateVoucher({
    code,
    userId: req.user._id,
    cartTotal: pricedCart.subtotal,
    cartItems: voucherItems
  });
  const discountAmount = result.discountAmount;

  return ApiResponse.success(res, {
    voucher: {
      _id: result.voucher._id,
      code: result.voucher.code,
      discountType: result.voucher.discountType,
      discountValue: result.voucher.discountValue,
      discountAmount
    },
    newTotal: pricedCart.subtotal - discountAmount
  }, 'Voucher applied successfully');
});
// @desc      Mark voucher as used
// @route     PUT /api/vouchers/:id/use
// @access    Private
exports.useVoucher = asyncHandler(async (req, res, next) => {
  const { orderId } = req.body;
  
  if (!orderId) {
    return next(new ApiError('Vui lòng cung cấp ID đơn hàng', 400));
  }
  
  let userVoucher;
  
  // If private voucher, update UserVoucher record
  const voucher = await Voucher.findById(req.params.id);
  if (!voucher) {
    return next(new ApiError(`Không tìm thấy mã giảm giá với id ${req.params.id}`, 404));
  }
  
  if (voucher.isPrivate) {
    userVoucher = await UserVoucher.findOne({
      userId: req.user.id,
      voucherId: req.params.id,
      isUsed: false,
      isDeleted: false
    });
    
    if (!userVoucher) {
      return next(new ApiError('Mã giảm giá không khả dụng hoặc đã sử dụng', 400));
    }
    
    // Mark as used
    await userVoucher.markAsUsed(orderId);
  } else {
    // For public vouchers, just increment usage count
    await voucher.incrementUsage();
  }
  
  return ApiResponse.success(res, {
    voucherId: req.params.id,
    orderId
  }, 'Đánh dấu mã giảm giá đã sử dụng thành công');
});