// controllers/bundle-item.controller.js
const Bundle = require('../models/Bundle');
const BundleItem = require('../models/BundleItem');
const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middlewares/async.middleware');

/**
 * @desc    Get all items in a bundle
 * @route   GET /api/bundles/:bundleId/items
 * @access  Public
 */
exports.getBundleItems = asyncHandler(async (req, res) => {
  const { bundleId } = req.params;
  
  // Validate bundle exists
  const bundle = await Bundle.findById(bundleId);
  if (!bundle || bundle.isDeleted) {
    throw new ApiError('Bundle not found', 404);
  }
  
  // Get bundle items with product and variant info
  const items = await BundleItem.find({ bundleId })
    .sort('sortOrder')
    .populate('productId', 'name slug images basePrice description')
    .populate('variantId', 'name sku color size material priceAdjustment images');
  
  return ApiResponse.success(res, { items });
});

/**
 * @desc    Get a specific bundle item
 * @route   GET /api/bundles/:bundleId/items/:id
 * @access  Public
 */
exports.getBundleItem = asyncHandler(async (req, res) => {
  const { bundleId, id } = req.params;
  
  // Find the item
  const item = await BundleItem.findOne({ 
    _id: id, 
    bundleId 
  })
    .populate('productId', 'name slug images basePrice description stockQuantity')
    .populate('variantId', 'name sku color size material priceAdjustment images stockQuantity')
    .populate('alternativeIds', 'name slug images basePrice');
  
  if (!item) {
    throw new ApiError('Bundle item not found', 404);
  }
  
  return ApiResponse.success(res, { item });
});

/**
 * @desc    Add item to bundle
 * @route   POST /api/bundles/:bundleId/items
 * @access  Private (Admin, Staff)
 */
exports.addBundleItem = asyncHandler(async (req, res) => {
  const { bundleId } = req.params;
  const { 
    productId, 
    variantId, 
    quantity, 
    isRequired, 
    sortOrder,
    customPrice,
    alternativeIds
  } = req.body;
  
  // Validate required fields
  if (!productId) {
    throw new ApiError('Product ID is required', 400);
  }
  
  // Validate bundle exists
  const bundle = await Bundle.findById(bundleId);
  if (!bundle || bundle.isDeleted) {
    throw new ApiError('Bundle not found', 404);
  }
  
  // Validate product exists
  const product = await Product.findById(productId);
  if (!product || product.isDeleted) {
    throw new ApiError('Product not found', 404);
  }
  
  // Validate variant if provided
  if (variantId) {
    const variant = await ProductVariant.findOne({ 
      _id: variantId, 
      productId,
      isDeleted: false
    });
    
    if (!variant) {
      throw new ApiError('Product variant not found or does not belong to the product', 404);
    }
  }
  
  // Check if item already exists in bundle
  const existingItem = await BundleItem.findOne({
    bundleId,
    productId,
    variantId: variantId || null
  });
  
  if (existingItem) {
    throw new ApiError('This product variant is already in the bundle', 400);
  }
  
  // Process alternative products if provided
  let processedAlternatives = alternativeIds;
  if (typeof alternativeIds === 'string') {
    processedAlternatives = alternativeIds.split(',').map(id => id.trim());
  }
  
  // Create bundle item
  const bundleItem = await BundleItem.create({
    bundleId,
    productId,
    variantId: variantId || null,
    quantity: quantity || 1,
    isRequired: isRequired === undefined ? true : (isRequired === 'true' || isRequired === true),
    sortOrder: sortOrder || 0,
    customPrice: customPrice ? Number(customPrice) : undefined,
    alternativeIds: processedAlternatives || []
  });
  
  // Recalculate bundle prices
  await bundle.calculatePrices();
  
  return ApiResponse.created(res, { item: bundleItem });
});

/**
 * @desc    Update bundle item
 * @route   PUT /api/bundles/:bundleId/items/:id
 * @access  Private (Admin, Staff)
 */
exports.updateBundleItem = asyncHandler(async (req, res) => {
  const { bundleId, id } = req.params;
  const { 
    quantity, 
    isRequired, 
    sortOrder,
    customPrice,
    alternativeIds
  } = req.body;
  
  // Find the item
  const item = await BundleItem.findOne({ _id: id, bundleId });
  if (!item) {
    throw new ApiError('Bundle item not found', 404);
  }
  
  // Create update object
  const updateData = {};
  
  if (quantity !== undefined) updateData.quantity = parseInt(quantity);
  if (isRequired !== undefined) {
    updateData.isRequired = isRequired === 'true' || isRequired === true;
  }
  if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder);
  if (customPrice !== undefined) {
    updateData.customPrice = customPrice === '' ? null : Number(customPrice);
  }
  
  // Process alternative products if provided
  if (alternativeIds !== undefined) {
    if (typeof alternativeIds === 'string') {
      updateData.alternativeIds = alternativeIds.split(',').map(id => id.trim());
    } else {
      updateData.alternativeIds = alternativeIds || [];
    }
  }
  
  // Update the item
  const updatedItem = await BundleItem.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  )
    .populate('productId', 'name slug images basePrice')
    .populate('variantId', 'name sku color size material priceAdjustment')
    .populate('alternativeIds', 'name slug images');
  
  // Recalculate bundle prices
  const bundle = await Bundle.findById(bundleId);
  await bundle.calculatePrices();
  
  return ApiResponse.success(res, { item: updatedItem });
});

/**
 * @desc    Remove item from bundle
 * @route   DELETE /api/bundles/:bundleId/items/:id
 * @access  Private (Admin, Staff)
 */
exports.removeBundleItem = asyncHandler(async (req, res) => {
  const { bundleId, id } = req.params;
  
  // Find and delete the item
  const item = await BundleItem.findOneAndDelete({ _id: id, bundleId });
  
  if (!item) {
    throw new ApiError('Bundle item not found', 404);
  }
  
  // Recalculate bundle prices
  const bundle = await Bundle.findById(bundleId);
  await bundle.calculatePrices();
  
  return ApiResponse.success(res, null, 'Item removed from bundle successfully');
});

/**
 * @desc    Get alternative product options for an item
 * @route   GET /api/bundles/:bundleId/items/:id/alternatives
 * @access  Public
 */
exports.getItemAlternatives = asyncHandler(async (req, res) => {
  const { bundleId, id } = req.params;
  
  // Find the item
  const item = await BundleItem.findOne({ _id: id, bundleId });
  if (!item) {
    throw new ApiError('Bundle item not found', 404);
  }
  
  // Get alternatives
  const alternatives = await Product.find({
    _id: { $in: item.alternativeIds },
    isDeleted: false
  })
    .select('name slug images basePrice description');
  
  return ApiResponse.success(res, { alternatives });
});

/**
 * @desc    Reorder bundle items
 * @route   PUT /api/bundles/:bundleId/items/reorder
 * @access  Private (Admin, Staff)
 */
exports.reorderBundleItems = asyncHandler(async (req, res) => {
  const { bundleId } = req.params;
  const { items } = req.body;
  
  if (!items || !Array.isArray(items)) {
    throw new ApiError('Items array is required', 400);
  }
  
  // Validate bundle exists
  const bundle = await Bundle.findById(bundleId);
  if (!bundle || bundle.isDeleted) {
    throw new ApiError('Bundle not found', 404);
  }
  
  // Update sort order for each item
  for (const item of items) {
    if (!item.id || item.sortOrder === undefined) {
      throw new ApiError('Each item must have id and sortOrder', 400);
    }
    
    await BundleItem.findOneAndUpdate(
      { _id: item.id, bundleId },
      { sortOrder: item.sortOrder }
    );
  }
  
  // Get updated items
  const updatedItems = await BundleItem.find({ bundleId })
    .sort('sortOrder')
    .populate('productId', 'name slug images');
  
  return ApiResponse.success(res, { 
    items: updatedItems,
    message: 'Items reordered successfully' 
  });
});