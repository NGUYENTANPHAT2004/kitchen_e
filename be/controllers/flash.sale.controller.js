// controllers/flash.sale.controller.js
const FlashSale = require('../models/FlashSale');
const FlashSaleItem = require('../models/FlashSaleItem');
const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');
const asyncHandler = require('../middlewares/async.middleware');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

// @desc      Get all flash sales
// @route     GET /api/flash-sales
// @access    Public
exports.getFlashSales = asyncHandler(async (req, res) => {
  // Support for query parameters
  const { status, active, upcoming, page = 1, limit = 10 } = req.query;
  const query = { isDeleted: false };
  
  // Filter by status if provided
  if (status) {
    query.status = status;
  }
  
  // Filter for active flash sales
  if (active === 'true') {
    const now = new Date();
    query.startDate = { $lte: now };
    query.endDate = { $gte: now };
    query.status = 'active';
  }
  
  // Filter for upcoming flash sales
  if (upcoming === 'true') {
    const now = new Date();
    query.startDate = { $gt: now };
    query.status = 'scheduled';
  }
  
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { startDate: 1 },
    populate: {
      path: 'items',
      model: 'FlashSaleItem',
      populate: {
        path: 'productId',
        select: 'name slug images'
      }
    }
  };
  
  const flashSales = await FlashSale.paginate(query, options);
  
  return ApiResponse.success(res, {
    flashSales: flashSales.docs,
    pagination: {
      totalDocs: flashSales.totalDocs,
      totalPages: flashSales.totalPages,
      currentPage: flashSales.page,
      hasNextPage: flashSales.hasNextPage,
      hasPrevPage: flashSales.hasPrevPage
    }
  }, 'Danh sách flash sale');
});

// @desc      Get single flash sale
// @route     GET /api/flash-sales/:id
// @access    Public
exports.getFlashSale = asyncHandler(async (req, res, next) => {
  const flashSale = await FlashSale.findById(req.params.id).populate({
    path: 'items',
    populate: [
      {
        path: 'productId',
        select: 'name description images basePrice slug'
      },
      {
        path: 'variantId',
        select: 'name color size material priceAdjustment'
      }
    ]
  });
  
  if (!flashSale) {
    return next(new ApiError(`Không tìm thấy flash sale với id ${req.params.id}`, 404));
  }
  
  // Check if flash sale is active
  const now = new Date();
  const isCurrentlyActive = flashSale.startDate <= now && flashSale.endDate >= now && flashSale.status === 'active';
  
  return ApiResponse.success(res, {
    ...flashSale.toObject(),
    isCurrentlyActive
  }, 'Chi tiết flash sale');
});

// @desc      Create new flash sale
// @route     POST /api/flash-sales
// @access    Private (Admin)
exports.createFlashSale = asyncHandler(async (req, res, next) => {
  // Validate dates
  const { startDate, endDate } = req.body;
  
  if (new Date(startDate) >= new Date(endDate)) {
    return next(new ApiError('Ngày kết thúc phải sau ngày bắt đầu', 400));
  }
  
  const flashSale = await FlashSale.create(req.body);
  
  return ApiResponse.created(res, flashSale, 'Tạo flash sale thành công');
});

// @desc      Update flash sale
// @route     PUT /api/flash-sales/:id
// @access    Private (Admin)
exports.updateFlashSale = asyncHandler(async (req, res, next) => {
  let flashSale = await FlashSale.findById(req.params.id);
  
  if (!flashSale) {
    return next(new ApiError(`Không tìm thấy flash sale với id ${req.params.id}`, 404));
  }
  
  // Validate dates if updating
  if (req.body.startDate && req.body.endDate) {
    if (new Date(req.body.startDate) >= new Date(req.body.endDate)) {
      return next(new ApiError('Ngày kết thúc phải sau ngày bắt đầu', 400));
    }
  } else if (req.body.startDate && !req.body.endDate) {
    if (new Date(req.body.startDate) >= new Date(flashSale.endDate)) {
      return next(new ApiError('Ngày bắt đầu phải trước ngày kết thúc', 400));
    }
  } else if (!req.body.startDate && req.body.endDate) {
    if (new Date(flashSale.startDate) >= new Date(req.body.endDate)) {
      return next(new ApiError('Ngày kết thúc phải sau ngày bắt đầu', 400));
    }
  }
  
  flashSale = await FlashSale.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  return ApiResponse.success(res, flashSale, 'Cập nhật flash sale thành công');
});

// @desc      Delete flash sale
// @route     DELETE /api/flash-sales/:id
// @access    Private (Admin)
exports.deleteFlashSale = asyncHandler(async (req, res, next) => {
  const flashSale = await FlashSale.findById(req.params.id);
  
  if (!flashSale) {
    return next(new ApiError(`Không tìm thấy flash sale với id ${req.params.id}`, 404));
  }
  
  // Soft delete
  flashSale.isDeleted = true;
  await flashSale.save();
  
  // Also mark all items as deleted
  await FlashSaleItem.updateMany(
    { flashSaleId: req.params.id },
    { isActive: false }
  );
  
  return ApiResponse.success(res, null, 'Xóa flash sale thành công');
});

// @desc      Add item to flash sale
// @route     POST /api/flash-sales/:id/items
// @access    Private (Admin)
exports.addFlashSaleItem = asyncHandler(async (req, res, next) => {
  const { productId, variantId, discountPercent, quantity, maxPerCustomer } = req.body;
  
  // Validate required fields
  if (!productId || !discountPercent || !quantity) {
    return next(new ApiError('Vui lòng cung cấp productId, discountPercent và quantity', 400));
  }
  
  // Check if flash sale exists
  const flashSale = await FlashSale.findById(req.params.id);
  if (!flashSale) {
    return next(new ApiError(`Không tìm thấy flash sale với id ${req.params.id}`, 404));
  }
  
  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    return next(new ApiError(`Không tìm thấy sản phẩm với id ${productId}`, 404));
  }
  
  // Check if variant exists if provided
  if (variantId) {
    const variant = await ProductVariant.findById(variantId);
    if (!variant) {
      return next(new ApiError(`Không tìm thấy biến thể sản phẩm với id ${variantId}`, 404));
    }
    
    // Check if variant belongs to product
    if (variant.productId.toString() !== productId) {
      return next(new ApiError(`Biến thể không thuộc về sản phẩm này`, 400));
    }
  }
  
  // Check if item already exists
  const existingItem = await FlashSaleItem.findOne({
    flashSaleId: req.params.id,
    productId,
    variantId: variantId || null
  });
  
  if (existingItem) {
    return next(new ApiError('Sản phẩm này đã có trong flash sale', 400));
  }
  
  // Create flash sale item
  const flashSaleItem = await FlashSaleItem.create({
    flashSaleId: req.params.id,
    productId,
    variantId,
    discountPercent,
    quantity,
    maxPerCustomer: maxPerCustomer || 0
  });
  
  return ApiResponse.created(res, flashSaleItem, 'Thêm sản phẩm vào flash sale thành công');
});

// @desc      Update flash sale item
// @route     PUT /api/flash-sales/items/:itemId
// @access    Private (Admin)
exports.updateFlashSaleItem = asyncHandler(async (req, res, next) => {
  let flashSaleItem = await FlashSaleItem.findById(req.params.itemId);
  
  if (!flashSaleItem) {
    return next(new ApiError(`Không tìm thấy sản phẩm flash sale với id ${req.params.itemId}`, 404));
  }
  
  // Don't allow changing product or variant.
  const updateData = { ...req.body };
  delete updateData.productId;
  delete updateData.variantId;
  
  flashSaleItem = await FlashSaleItem.findByIdAndUpdate(
    req.params.itemId,
    updateData,
    {
      new: true,
      runValidators: true
    }
  );
  
  return ApiResponse.success(res, flashSaleItem, 'Cập nhật sản phẩm flash sale thành công');
});

// @desc      Remove item from flash sale
// @route     DELETE /api/flash-sales/items/:itemId
// @access    Private (Admin)
exports.removeFlashSaleItem = asyncHandler(async (req, res, next) => {
  const flashSaleItem = await FlashSaleItem.findById(req.params.itemId);
  
  if (!flashSaleItem) {
    return next(new ApiError(`Không tìm thấy sản phẩm flash sale với id ${req.params.itemId}`, 404));
  }
  
  await flashSaleItem.remove();
  
  return ApiResponse.success(res, null, 'Xóa sản phẩm khỏi flash sale thành công');
});

// @desc      Get all items in a flash sale
// @route     GET /api/flash-sales/:id/items
// @access    Public
exports.getFlashSaleItems = asyncHandler(async (req, res, next) => {
  const flashSale = await FlashSale.findById(req.params.id);
  
  if (!flashSale) {
    return next(new ApiError(`Không tìm thấy flash sale với id ${req.params.id}`, 404));
  }
  
  const flashSaleItems = await FlashSaleItem.find({ flashSaleId: req.params.id })
    .populate('productId', 'name description images basePrice slug')
    .populate('variantId', 'name color size material priceAdjustment');
  
  return ApiResponse.success(res, {
    items: flashSaleItems,
    count: flashSaleItems.length
  }, 'Danh sách sản phẩm trong flash sale');
});

// @desc      Update flash sale status
// @route     PUT /api/flash-sales/:id/status
// @access    Private (Admin)
exports.updateFlashSaleStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  
  if (!status || !['scheduled', 'active', 'ended', 'cancelled'].includes(status)) {
    return next(new ApiError('Vui lòng cung cấp trạng thái hợp lệ', 400));
  }
  
  const flashSale = await FlashSale.findById(req.params.id);
  
  if (!flashSale) {
    return next(new ApiError(`Không tìm thấy flash sale với id ${req.params.id}`, 404));
  }
  
  flashSale.status = status;
  
  // If cancelling or ending, also update isActive
  if (status === 'cancelled' || status === 'ended') {
    flashSale.isActive = false;
  } else {
    flashSale.isActive = true;
  }
  
  await flashSale.save();
  
  return ApiResponse.success(res, flashSale, 'Cập nhật trạng thái flash sale thành công');
});

// @desc      Get active flash sales
// @route     GET /api/flash-sales/active
// @access    Public
exports.getActiveFlashSales = asyncHandler(async (req, res) => {
  const now = new Date();
  
  const flashSales = await FlashSale.find({
    startDate: { $lte: now },
    endDate: { $gte: now },
    status: 'active',
    isActive: true,
    isDeleted: false
  }).populate({
    path: 'items',
    populate: {
      path: 'productId',
      select: 'name slug images basePrice'
    }
  });
  
  return ApiResponse.success(res, flashSales, 'Danh sách flash sale đang diễn ra');
});