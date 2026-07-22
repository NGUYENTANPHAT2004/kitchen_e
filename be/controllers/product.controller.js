// controllers/product.controller.js
const Product = require('../models/Product');
const Category = require('../models/Category');
const FlashSaleItem = require('../models/FlashSaleItem');
const imageService = require('../utils/imageService');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middlewares/async.middleware');
const mongoose = require('mongoose');

/**
 * @desc    Get all products with pagination, filtering, and sorting
 * @route   GET /api/products
 * @access  Public
 */
exports.getProducts = asyncHandler(async (req, res) => {
  // Extract query parameters
  const {
    page = 1,
    limit = 12,
    sort = '-createdAt',
    category,
    search,
    minPrice,
    maxPrice,
    inStock,
    featured,
    variants,
    ...otherFilters
  } = req.query;

  // Build the query
  const query = { isDeleted: false };

  // Category filter - support both ID and slug
  if (category) {
    let categoryObj;

    // Check if category is an ID or slug
    if (mongoose.Types.ObjectId.isValid(category)) {
      categoryObj = await Category.findById(category);
    } else {
      categoryObj = await Category.findOne({ slug: category });
    }

    if (categoryObj) {
      // Get all subcategories
      const subcategories = await Category.find({ parentId: categoryObj._id });
      const categoryIds = [
        categoryObj._id,
        ...subcategories.map(subcat => subcat._id)
      ];

      query.categoryId = { $in: categoryIds };
    }
  }

  // Price range filter
  if (minPrice || maxPrice) {
    query.basePrice = {};
    if (minPrice) query.basePrice.$gte = Number(minPrice);
    if (maxPrice) query.basePrice.$lte = Number(maxPrice);
  }

  // In stock filter
  if (inStock === 'true') {
    query.stockQuantity = { $gt: 0 };
  }

  // Featured filter
  if (featured === 'true') {
    query.featured = true;
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
    sort,
    populate: [
      { path: 'categoryId', select: 'name slug' }
    ]
  };

  // If variants flag is set, also populate variants
  if (variants === 'true') {
    options.populate.push({ path: 'variants' });
  }

  // Execute the query with pagination
  const products = await Product.paginate(query, options);

  // Check for active flash sales on these products
  const productIds = products.docs.map(product => product._id);
  const now = new Date();

  const flashSaleItems = await FlashSaleItem.find({
    productId: { $in: productIds },
    isActive: true
  }).populate({
    path: 'flashSaleId',
    match: {
      startDate: { $lte: now },
      endDate: { $gte: now },
      status: 'active',
      isActive: true
    }
  });

  // Map flash sale data to products
  const productsWithFlashSale = products.docs.map(product => {
    const productObj = product.toObject();

    const flashSaleItem = flashSaleItems.find(
      item => item.productId.toString() === productObj._id.toString() && item.flashSaleId
    );

    if (flashSaleItem) {
      productObj.flashSale = {
        discountPercent: flashSaleItem.discountPercent,
        discountedPrice: flashSaleItem.discountedPrice,
        flashSaleId: flashSaleItem.flashSaleId._id,
        endDate: flashSaleItem.flashSaleId.endDate
      };
    }

    return productObj;
  });

  // Format the response
  return ApiResponse.success(res, {
    products: productsWithFlashSale,
    pagination: {
      currentPage: products.page,
      totalPages: products.totalPages,
      totalItems: products.totalDocs,
      limit: products.limit
    }
  });
});

/**
 * @desc    Get single product
 * @route   GET /api/products/:id
 * @access  Public
 */
exports.getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new ApiError('Product not found', 404);
  }
  return ApiResponse.success(res, { product });
});

/**
 * @desc    Create a new product
 * @route   POST /api/products
 * @access  Private (Admin, Staff)
 */
exports.createProduct = asyncHandler(async (req, res) => {
  console.log('=== CREATE PRODUCT START ===');
  console.log('Request body:', req.body);
  console.log('Uploaded files:', req.files ? req.files.map(f => ({
    fieldname: f.fieldname,
    originalname: f.originalname,
    mimetype: f.mimetype,
    size: f.size,
    filename: f.filename,
    path: f.path,
    key: f.key,
    location: f.location
  })) : 'No files uploaded');

  const {
    name,
    description,
    categoryId,
    basePrice,
    sku,
    stockQuantity,
    isCustomizable,
    tags,
    featured,
    dimensions,
    weight,
    ...otherFields
  } = req.body;

  // Validate required fields
  if (!name || name.trim() === '') {
    throw new ApiError('Product name is required', 400);
  }
  if (!description || description.trim() === '') {
    throw new ApiError('Product description is required', 400);
  }
  if (!categoryId) {
    throw new ApiError('Category is required', 400);
  }
  if (!basePrice || isNaN(parseFloat(basePrice))) {
    throw new ApiError('Valid base price is required', 400);
  }
  if (!sku || sku.trim() === '') {
    throw new ApiError('SKU is required', 400);
  }

  // Validate category exists
  const category = await Category.findById(categoryId);
  if (!category || category.isDeleted) {
    throw new ApiError('Category not found', 404);
  }

  // Check if SKU is unique
  const existingSku = await Product.findOne({ sku: sku.trim(), isDeleted: false });
  if (existingSku) {
    throw new ApiError('SKU already exists', 400);
  }

  // Process tags if provided as a string
  let processedTags = tags;
  if (typeof tags === 'string') {
    processedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  } else if (!Array.isArray(tags)) {
    processedTags = [];
  }

  // Create product object with proper type conversions
  const productData = {
    name: name.trim(),
    description: description.trim(),
    categoryId,
    basePrice: parseFloat(basePrice),
    sku: sku.trim(),
    stockQuantity: stockQuantity ? parseInt(stockQuantity, 10) : 0,
    isCustomizable: isCustomizable === 'true' || isCustomizable === true,
    tags: processedTags || [],
    featured: featured === 'true' || featured === true,
    ...otherFields
  };

  // Add dimensions if provided
  if (dimensions) {
    try {
      productData.dimensions = typeof dimensions === 'string'
        ? JSON.parse(dimensions)
        : dimensions;
    } catch (error) {
      throw new ApiError('Invalid dimensions format. Must be valid JSON.', 400);
    }
  }

  // Add weight if provided
  if (weight) {
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum)) {
      throw new ApiError('Invalid weight format. Must be a number.', 400);
    }
    productData.weight = weightNum;
  }

  console.log('Product data prepared:', productData);

  // Handle multiple image uploads
  if (req.files && req.files.length > 0) {
    try {
      console.log(`Processing ${req.files.length} product images...`);

      // Use imageService to process multiple images
      const imageResults = await imageService.uploadMultipleImages(req.files, 'products');

      // Transform results to match the expected format
      productData.images = imageResults.map((result, index) => ({
        url: result.url,
        path: result.path,
        altText: name.trim(),
        isDefault: index === 0, // First image is default
        sortOrder: index
      }));

      console.log(`All ${productData.images.length} product images processed successfully`);

    } catch (error) {
      console.error('Product images upload error:', error);
      throw new ApiError(`Image upload failed: ${error.message}`, 400);
    }
  }

  try {
    // Create the product
    console.log('Creating product in database...');
    const product = await Product.create(productData);

    console.log('Product created successfully:', {
      id: product._id,
      name: product.name,
      sku: product.sku,
      imagesCount: product.images?.length || 0
    });

    console.log('=== CREATE PRODUCT SUCCESS ===');
    return ApiResponse.created(res, { product });

  } catch (error) {
    console.error('Product creation failed:', error);

    // Cleanup uploaded images if product creation fails
    if (productData.images && productData.images.length > 0) {
      console.log('Cleaning up uploaded images due to product creation failure...');
      const imagePaths = productData.images.map(img => img.path);
      await imageService.cleanupImages(imagePaths);
    }

    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      throw new ApiError(`Validation failed: ${validationErrors.join(', ')}`, 400);
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      throw new ApiError(`${field} already exists`, 400);
    }

    console.log('=== CREATE PRODUCT FAILED ===');
    throw error;
  }
});

/**
 * @desc    Update a product
 * @route   PUT /api/products/:id
 * @access  Private (Admin, Staff)
 */
exports.updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  console.log('=== UPDATE PRODUCT START ===');
  console.log('Product ID:', id);
  console.log('Request body:', req.body);
  console.log('Uploaded files:', req.files ? req.files.map(f => ({
    fieldname: f.fieldname,
    originalname: f.originalname,
    mimetype: f.mimetype,
    size: f.size,
    filename: f.filename,
    path: f.path,
    key: f.key,
    location: f.location
  })) : 'No files uploaded');

  const {
    name,
    description,
    categoryId,
    basePrice,
    sku,
    stockQuantity,
    isCustomizable,
    tags,
    featured,
    dimensions,
    weight,
    removeImages,
    ...otherFields
  } = req.body;

  // Find the product
  const product = await Product.findById(id);
  if (!product || product.isDeleted) {
    throw new ApiError('Product not found', 404);
  }

  console.log('Found product:', {
    id: product._id,
    name: product.name,
    sku: product.sku,
    currentImagesCount: product.images?.length || 0
  });

  // Validate category if provided
  if (categoryId) {
    const category = await Category.findById(categoryId);
    if (!category || category.isDeleted) {
      throw new ApiError('Category not found', 404);
    }
  }

  // Check SKU uniqueness if changed
  if (sku && sku.trim() !== product.sku) {
    const existingSku = await Product.findOne({
      sku: sku.trim(),
      _id: { $ne: id },
      isDeleted: false
    });
    if (existingSku) {
      throw new ApiError('SKU already exists', 400);
    }
  }

  // Process tags if provided
  let processedTags = tags;
  if (typeof tags === 'string') {
    processedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  }

  // Create update object
  const updateData = {};

  // Update fields if provided with proper type conversions
  if (name !== undefined) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description.trim();
  if (categoryId !== undefined) updateData.categoryId = categoryId;
  if (basePrice !== undefined) {
    const price = parseFloat(basePrice);
    if (isNaN(price)) {
      throw new ApiError('Invalid base price format', 400);
    }
    updateData.basePrice = price;
  }
  if (sku !== undefined) updateData.sku = sku.trim();
  if (stockQuantity !== undefined) updateData.stockQuantity = parseInt(stockQuantity, 10);
  if (isCustomizable !== undefined) {
    updateData.isCustomizable = isCustomizable === 'true' || isCustomizable === true;
  }
  if (processedTags !== undefined) updateData.tags = processedTags;
  if (featured !== undefined) {
    updateData.featured = featured === 'true' || featured === true;
  }

  // Add other fields
  Object.assign(updateData, otherFields);

  // Handle dimensions if provided
  if (dimensions !== undefined) {
    try {
      updateData.dimensions = typeof dimensions === 'string'
        ? JSON.parse(dimensions)
        : dimensions;
    } catch (error) {
      throw new ApiError('Invalid dimensions format. Must be valid JSON.', 400);
    }
  }

  // Handle weight if provided
  if (weight !== undefined) {
    if (weight === '' || weight === null) {
      updateData.weight = null;
    } else {
      const weightNum = parseFloat(weight);
      if (isNaN(weightNum)) {
        throw new ApiError('Invalid weight format. Must be a number.', 400);
      }
      updateData.weight = weightNum;
    }
  }

  console.log('Update data prepared:', updateData);

  // Store current images for potential cleanup
  const currentImages = product.images || [];
  let imagesToDelete = [];

  // Handle image removal if specified
  if (removeImages) {
    const imagesToRemove = Array.isArray(removeImages)
      ? removeImages
      : [removeImages];

    console.log('Images to remove:', imagesToRemove);

    // Find images to delete
    imagesToDelete = currentImages.filter(image =>
      imagesToRemove.includes(image.url) ||
      imagesToRemove.includes(image.path) ||
      imagesToRemove.includes(image._id?.toString())
    );

    // Update the images array (remove specified images)
    updateData.images = currentImages.filter(image =>
      !imagesToRemove.includes(image.url) &&
      !imagesToRemove.includes(image.path) &&
      !imagesToRemove.includes(image._id?.toString())
    );
  }

  // Handle new image uploads
  if (req.files && req.files.length > 0) {
    try {
      console.log(`Processing ${req.files.length} new product images...`);

      // Use imageService to process multiple images
      const imageResults = await imageService.uploadMultipleImages(req.files, 'products');

      const existingImagesCount = updateData.images ? updateData.images.length : currentImages.length;

      // Transform results to match the expected format
      const newImages = imageResults.map((result, index) => ({
        url: result.url,
        path: result.path,
        altText: name || product.name,
        isDefault: existingImagesCount === 0 && index === 0, // First image is default if no existing images
        sortOrder: existingImagesCount + index
      }));

      // Add new images to existing ones (or to the filtered list if removing images)
      if (updateData.images) {
        updateData.images = [...updateData.images, ...newImages];
      } else {
        updateData.images = [...currentImages, ...newImages];
      }

      console.log(`All ${newImages.length} new product images processed successfully`);

    } catch (error) {
      console.error('New product images upload error:', error);
      throw new ApiError(`Image upload failed: ${error.message}`, 400);
    }
  }

  try {
    // Update the product
    console.log('Updating product in database...');
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // Delete removed images after successful update
    if (imagesToDelete.length > 0) {
      console.log(`Deleting ${imagesToDelete.length} removed images...`);
      const imagePathsToDelete = imagesToDelete.map(img => img.path || img.url);
      const cleanupResult = await imageService.cleanupImages(imagePathsToDelete);
      console.log('Image cleanup result:', cleanupResult);
    }

    console.log('Product updated successfully:', {
      id: updatedProduct._id,
      name: updatedProduct.name,
      sku: updatedProduct.sku,
      imagesCount: updatedProduct.images?.length || 0
    });

    console.log('=== UPDATE PRODUCT SUCCESS ===');
    return ApiResponse.success(res, { product: updatedProduct });

  } catch (error) {
    console.error('Product update failed:', error);

    // Cleanup newly uploaded images if update fails
    if (req.files && req.files.length > 0) {
      console.log('Cleaning up newly uploaded images due to update failure...');
      const newImageCount = req.files.length;

      if (updateData.images && updateData.images.length >= newImageCount) {
        const newImagePaths = updateData.images
          .slice(-newImageCount)
          .map(img => img.path);

        await imageService.cleanupImages(newImagePaths);
      }
    }

    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      throw new ApiError(`Validation failed: ${validationErrors.join(', ')}`, 400);
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      throw new ApiError(`${field} already exists`, 400);
    }

    console.log('=== UPDATE PRODUCT FAILED ===');
    throw error;
  }
});

/**
 * @desc    Delete a product (soft delete)
 * @route   DELETE /api/products/:id
 * @access  Private (Admin)
 */
exports.deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find the product
  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError('Product not found', 404);
  }

  // Soft delete
  product.isDeleted = true;
  await product.save();

  return ApiResponse.success(res, null, 'Product deleted successfully');
});

/**
 * @desc    Restore a deleted product
 * @route   PUT /api/products/:id/restore
 * @access  Private (Admin)
 */
exports.restoreProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find the product with includeDeleted option
  const product = await Product.findOne({ _id: id, isDeleted: true });

  if (!product) {
    throw new ApiError('Deleted product not found', 404);
  }

  // Restore the product
  product.isDeleted = false;
  await product.save();

  return ApiResponse.success(res, { product }, 'Product restored successfully');
});

/**
 * @desc    Search products
 * @route   GET /api/products/search
 * @access  Public
 */
exports.searchProducts = asyncHandler(async (req, res) => {
  const { query, limit = 10 } = req.query;

  if (!query) {
    throw new ApiError('Search query is required', 400);
  }

  // Search products using text index
  const products = await Product.find(
    {
      $text: { $search: query },
      isDeleted: false
    },
    { score: { $meta: 'textScore' } }
  )
    .select('name slug images basePrice averageRating')
    .sort({ score: { $meta: 'textScore' } })
    .limit(parseInt(limit));

  return ApiResponse.success(res, {
    products,
    count: products.length,
    query
  });
});

/**
 * @desc    Get featured products
 * @route   GET /api/products/featured
 * @access  Public
 */
exports.getFeaturedProducts = asyncHandler(async (req, res) => {
  const { limit = 8 } = req.query;

  const products = await Product.find({
    featured: true,
    isDeleted: false,
    stockQuantity: { $gt: 0 }
  })
    .select('name slug images basePrice averageRating')
    .sort('-createdAt')
    .limit(parseInt(limit));

  return ApiResponse.success(res, {
    products,
    count: products.length
  });
});

/**
 * @desc    Get best selling products
 * @route   GET /api/products/best-selling
 * @access  Public
 */
exports.getBestSellingProducts = asyncHandler(async (req, res) => {
  const { limit = 8 } = req.query;

  // In a real implementation, this would be based on OrderItem aggregation
  // For simplicity, we'll use a popularity field for now
  const products = await Product.find({
    isDeleted: false,
    stockQuantity: { $gt: 0 }
  })
    .select('name slug images basePrice averageRating popularity')
    .sort('-popularity -averageRating')
    .limit(parseInt(limit));

  return ApiResponse.success(res, {
    products,
    count: products.length
  });
});