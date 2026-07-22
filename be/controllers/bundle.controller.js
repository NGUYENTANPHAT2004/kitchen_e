// controllers/bundle.controller.js
const Bundle = require('../models/Bundle');
const imageService = require('../utils/imageService');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middlewares/async.middleware');
const mongoose = require('mongoose');
const slugify = require('slugify');

/**
 * @desc    Get all bundles with pagination, filtering, and sorting
 * @route   GET /api/bundles
 * @access  Public
 */
exports.getBundles = asyncHandler(async (req, res) => {
  // Extract query parameters
  const {
    page = 1,
    limit = 12,
    sort = '-createdAt',
    active,
    featured,
    customizable,
    search,
    ...otherFilters
  } = req.query;

  // Build the query
  const query = { isDeleted: false };

  // Active/current filter
  if (active === 'true') {
    const now = new Date();
    query.isActive = true;
    query.startDate = { $lte: now };
    query.$or = [
      { endDate: { $gte: now } },
      { endDate: null }
    ];
  }

  // Featured filter
  if (featured === 'true') {
    query.isFeatured = true;
  }

  // Customizable filter
  if (customizable === 'true') {
    query.isCustomizable = true;
  }

  // Text search
  if (search) {
    query.$text = { $search: search };
  }

  // Add other filters dynamically
  for (const key in otherFilters) {
    query[key] = otherFilters[key];
  }

  // Prepare the options for pagination
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: sort || '-createdAt',
    populate: [
      { 
        path: 'items',
        populate: {
          path: 'productId',
          select: 'name slug images basePrice'
        }
      }
    ]
  };

  // Execute the query with pagination
  const bundles = await Bundle.paginate(query, options);

  // Format the response
  return ApiResponse.success(res, {
    bundles: bundles.docs,
    pagination: {
      currentPage: bundles.page,
      totalPages: bundles.totalPages,
      totalItems: bundles.totalDocs,
      limit: bundles.limit
    }
  });
});

/**
 * @desc    Get a single bundle by ID or slug
 * @route   GET /api/bundles/:id
 * @access  Public
 */
exports.getBundle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let bundle;

  // Check if id is a valid ObjectId or a slug
  if (mongoose.Types.ObjectId.isValid(id)) {
    bundle = await Bundle.findById(id);
  } else {
    bundle = await Bundle.findOne({ slug: id });
  }

  if (!bundle || bundle.isDeleted) {
    throw new ApiError('Bundle not found', 404);
  }

  // Populate bundle items with product info
  await bundle.populate([
    {
      path: 'items',
      populate: [
        {
          path: 'productId',
          select: 'name slug images basePrice description stockQuantity'
        },
        {
          path: 'variantId',
          select: 'name sku color size material priceAdjustment images'
        }
      ]
    }
  ]);

  // Check if bundle is current (active and within date range)
  const isCurrent = bundle.isCurrent;

  // Convert to plain object for modifications
  const bundleObj = bundle.toObject();
  bundleObj.isCurrent = isCurrent;

  return ApiResponse.success(res, { bundle: bundleObj });
});

/**
 * @desc    Create a new bundle
 * @route   POST /api/bundles
 * @access  Private (Admin, Staff)
 */
exports.createBundle = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    discountType,
    discountValue,
    isCustomizable,
    startDate,
    endDate,
    featuredOrder,
    isFeatured,
    minItems,
    maxItems,
    tags,
    ...otherFields
  } = req.body;

  // Validate required fields
  if (!name || !description || !discountValue) {
    throw new ApiError('Please provide all required fields', 400);
  }

  // Process tags if provided as a string
  let processedTags = tags;
  if (typeof tags === 'string') {
    processedTags = tags.split(',').map(tag => tag.trim());
  }

  // Generate slug
  const slug = slugify(name, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });

  // Create bundle object
  const bundleData = {
    name,
    slug,
    description,
    discountType: discountType || 'percentage',
    discountValue: Number(discountValue),
    isCustomizable: isCustomizable === 'true' || isCustomizable === true,
    startDate: startDate ? new Date(startDate) : new Date(),
    endDate: endDate ? new Date(endDate) : null,
    featuredOrder: featuredOrder ? Number(featuredOrder) : 0,
    isFeatured: isFeatured === 'true' || isFeatured === true,
    minItems: minItems ? Number(minItems) : 1,
    maxItems: maxItems ? Number(maxItems) : null,
    tags: processedTags || [],
    ...otherFields
  };

  // Upload bundle image if provided
  if (req.file) {
    try {
      const result = await imageService.uploadImage(req.file, 'bundles');
      bundleData.image = result.url;
      bundleData.imagePath = result.path;
    } catch (error) {
      throw new ApiError(`Image upload failed: ${error.message}`, 500);
    }
  }

  // Create the bundle
  const bundle = await Bundle.create(bundleData);

  return ApiResponse.created(res, { bundle });
});

/**
 * @desc    Update a bundle
 * @route   PUT /api/bundles/:id
 * @access  Private (Admin, Staff)
 */
exports.updateBundle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    discountType,
    discountValue,
    isCustomizable,
    startDate,
    endDate,
    featuredOrder,
    isFeatured,
    isActive,
    minItems,
    maxItems,
    tags,
    removeImage,
    ...otherFields
  } = req.body;

  // Find the bundle
  const bundle = await Bundle.findById(id);
  if (!bundle || bundle.isDeleted) {
    throw new ApiError('Bundle not found', 404);
  }

  // Create update object
  const updateData = {};

  // Add fields if provided
  if (name) {
    updateData.name = name;
    updateData.slug = slugify(name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
  }
  
  if (description) updateData.description = description;
  if (discountType) updateData.discountType = discountType;
  if (discountValue !== undefined) updateData.discountValue = Number(discountValue);
  if (isCustomizable !== undefined) {
    updateData.isCustomizable = isCustomizable === 'true' || isCustomizable === true;
  }
  if (startDate) updateData.startDate = new Date(startDate);
  if (endDate) updateData.endDate = new Date(endDate);
  if (featuredOrder !== undefined) updateData.featuredOrder = Number(featuredOrder);
  if (isFeatured !== undefined) {
    updateData.isFeatured = isFeatured === 'true' || isFeatured === true;
  }
  if (isActive !== undefined) {
    updateData.isActive = isActive === 'true' || isActive === true;
  }
  if (minItems !== undefined) updateData.minItems = Number(minItems);
  if (maxItems !== undefined) updateData.maxItems = maxItems ? Number(maxItems) : null;

  // Process tags if provided
  if (tags) {
    if (typeof tags === 'string') {
      updateData.tags = tags.split(',').map(tag => tag.trim());
    } else {
      updateData.tags = tags;
    }
  }

  // Add other fields
  Object.assign(updateData, otherFields);

  // Handle image removal if specified
  if (removeImage === 'true' && bundle.image) {
    try {
      await imageService.deleteImage(bundle.imagePath || bundle.image);
      updateData.image = null;
      updateData.imagePath = null;
    } catch (error) {
      console.error(`Failed to delete image: ${error.message}`);
      // Continue even if image deletion fails
    }
  }

  // Handle new image upload
  if (req.file) {
    try {
      // Delete old image if exists
      if (bundle.image) {
        await imageService.deleteImage(bundle.imagePath || bundle.image);
      }
      
      // Upload new image
      const result = await imageService.uploadImage(req.file, 'bundles');
      updateData.image = result.url;
      updateData.imagePath = result.path;
    } catch (error) {
      throw new ApiError(`Image upload failed: ${error.message}`, 500);
    }
  }

  // Update the bundle
  const updatedBundle = await Bundle.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  );

  // Recalculate prices if necessary
  if (discountType !== undefined || discountValue !== undefined) {
    await updatedBundle.calculatePrices();
  }

  return ApiResponse.success(res, { bundle: updatedBundle });
});

/**
 * @desc    Delete a bundle (soft delete)
 * @route   DELETE /api/bundles/:id
 * @access  Private (Admin)
 */
exports.deleteBundle = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find the bundle
  const bundle = await Bundle.findById(id);
  if (!bundle) {
    throw new ApiError('Bundle not found', 404);
  }

  // Soft delete
  bundle.isDeleted = true;
  await bundle.save();

  return ApiResponse.success(res, null, 'Bundle deleted successfully');
});

/**
 * @desc    Restore a deleted bundle
 * @route   PUT /api/bundles/:id/restore
 * @access  Private (Admin)
 */
exports.restoreBundle = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find the deleted bundle
  const bundle = await Bundle.findOne({ _id: id, isDeleted: true });
  if (!bundle) {
    throw new ApiError('Deleted bundle not found', 404);
  }

  // Restore bundle
  bundle.isDeleted = false;
  await bundle.save();

  return ApiResponse.success(res, { bundle }, 'Bundle restored successfully');
});

/**
 * @desc    Get featured bundles
 * @route   GET /api/bundles/featured
 * @access  Public
 */
exports.getFeaturedBundles = asyncHandler(async (req, res) => {
  const { limit = 5 } = req.query;
  
  // Use the static method from the model
  const bundles = await Bundle.getFeaturedBundles(parseInt(limit));
  
  return ApiResponse.success(res, { 
    bundles,
    count: bundles.length
  });
});

/**
 * @desc    Get current active bundles
 * @route   GET /api/bundles/active
 * @access  Public
 */
exports.getActiveBundles = asyncHandler(async (req, res) => {
  const { includeItems = 'true' } = req.query;
  
  // Use the static method from the model
  const bundles = await Bundle.getActiveBundles(
    includeItems === 'true'
  );
  
  return ApiResponse.success(res, { 
    bundles,
    count: bundles.length
  });
});

/**
 * @desc    Calculate bundle prices
 * @route   POST /api/bundles/:id/calculate
 * @access  Private (Admin, Staff)
 */
exports.calculateBundlePrices = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Find the bundle
  const bundle = await Bundle.findById(id);
  if (!bundle || bundle.isDeleted) {
    throw new ApiError('Bundle not found', 404);
  }
  
  // Calculate prices
  await bundle.calculatePrices();
  
  return ApiResponse.success(res, { 
    bundle,
    totalPrice: bundle.totalPrice,
    finalPrice: bundle.finalPrice
  });
});