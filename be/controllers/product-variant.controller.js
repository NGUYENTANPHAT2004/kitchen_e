// controllers/product-variant.controller.js
const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');
const imageService = require('../utils/imageService');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middlewares/async.middleware');

/**
 * @desc    Get all variants for a product
 * @route   GET /api/products/:productId/variants
 * @access  Public
 */
exports.getProductVariants = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  // Validate product exists
  const product = await Product.findById(productId);
  if (!product || product.isDeleted) {
    throw new ApiError('Product not found', 404);
  }

  // Get all variants for this product
  const variants = await ProductVariant.find({ 
    productId, 
    isDeleted: false 
  }).sort('sortOrder name');

  return ApiResponse.success(res, { variants });
});

/**
 * @desc    Get a specific variant
 * @route   GET /api/products/:productId/variants/:id
 * @access  Public
 */
exports.getProductVariant = asyncHandler(async (req, res) => {
  const { productId, id } = req.params;

  // Find the variant
  const variant = await ProductVariant.findOne({ 
    _id: id, 
    productId,
    isDeleted: false 
  });

  if (!variant) {
    throw new ApiError('Product variant not found', 404);
  }

  // Get the product for basic info
  const product = await Product.findById(productId, 'name basePrice');

  return ApiResponse.success(res, { 
    variant,
    product: {
      _id: product._id,
      name: product.name,
      basePrice: product.basePrice
    }
  });
});


/**
 * @desc    Create a new product variant
 * @route   POST /api/products/:productId/variants
 * @access  Private (Admin, Staff)
 */
exports.createProductVariant = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  
  console.log('=== CREATE PRODUCT VARIANT START ===');
  console.log('Product ID:', productId);
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
    sku,
    color,
    size,
    material,
    priceAdjustment,
    stockQuantity,
    sortOrder,
    isActive,
    ...otherFields
  } = req.body;

  // Validate required fields
  if (!name || name.trim() === '') {
    throw new ApiError('Variant name is required', 400);
  }
  if (!sku || sku.trim() === '') {
    throw new ApiError('SKU is required', 400);
  }

  // Validate product exists
  const product = await Product.findById(productId);
  if (!product || product.isDeleted) {
    throw new ApiError('Product not found', 404);
  }

  console.log('Found parent product:', {
    id: product._id,
    name: product.name,
    sku: product.sku
  });

  // Check if SKU is unique
  const existingSku = await ProductVariant.findOne({ 
    sku: sku.trim(),
    isDeleted: false 
  });
  if (existingSku) {
    throw new ApiError('SKU already exists', 400);
  }

  // Create variant object with proper type conversions
  const variantData = {
    productId,
    name: name.trim(),
    sku: sku.trim(),
    color: color ? color.trim() : null,
    size: size ? size.trim() : null,
    material: material ? material.trim() : null,
    priceAdjustment: priceAdjustment ? parseFloat(priceAdjustment) : 0,
    stockQuantity: stockQuantity ? parseInt(stockQuantity, 10) : 0,
    sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
    isActive: isActive !== 'false' && isActive !== false,
    ...otherFields
  };

  console.log('Variant data prepared:', variantData);

  // Handle multiple image uploads
  if (req.files && req.files.length > 0) {
    try {
      console.log(`Processing ${req.files.length} variant images...`);
      
      // Use imageService to process multiple images
      const imageResults = await imageService.uploadMultipleImages(req.files, 'variants');
      
      // Transform results to match the expected format
      variantData.images = imageResults.map((result, index) => ({
        url: result.url,
        path: result.path,
        altText: `${product.name} - ${name.trim()}`,
        isDefault: index === 0, // First image is default
        sortOrder: index
      }));
      
      console.log(`All ${variantData.images.length} variant images processed successfully`);
      
    } catch (error) {
      console.error('Variant images upload error:', error);
      throw new ApiError(`Image upload failed: ${error.message}`, 400);
    }
  }

  try {
    // Create the variant
    console.log('Creating variant in database...');
    const variant = await ProductVariant.create(variantData);
    
    console.log('Product variant created successfully:', {
      id: variant._id,
      name: variant.name,
      sku: variant.sku,
      productId: variant.productId,
      imagesCount: variant.images?.length || 0
    });

    console.log('=== CREATE PRODUCT VARIANT SUCCESS ===');
    return ApiResponse.created(res, { variant });
    
  } catch (error) {
    console.error('Variant creation failed:', error);
    
    // Cleanup uploaded images if variant creation fails
    if (variantData.images && variantData.images.length > 0) {
      console.log('Cleaning up uploaded variant images due to creation failure...');
      const imagePaths = variantData.images.map(img => img.path);
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
    
    console.log('=== CREATE PRODUCT VARIANT FAILED ===');
    throw error;
  }
});

/**
 * @desc    Update a product variant
 * @route   PUT /api/products/:productId/variants/:id
 * @access  Private (Admin, Staff)
 */
exports.updateProductVariant = asyncHandler(async (req, res) => {
  const { productId, id } = req.params;
  
  console.log('=== UPDATE PRODUCT VARIANT START ===');
  console.log('Product ID:', productId);
  console.log('Variant ID:', id);
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
    sku,
    color,
    size,
    material,
    priceAdjustment,
    stockQuantity,
    sortOrder,
    isActive,
    removeImages,
    ...otherFields
  } = req.body;

  // Find the variant
  const variant = await ProductVariant.findOne({ 
    _id: id, 
    productId,
    isDeleted: false 
  });

  if (!variant) {
    throw new ApiError('Product variant not found', 404);
  }

  console.log('Found variant:', {
    id: variant._id,
    name: variant.name,
    sku: variant.sku,
    currentImagesCount: variant.images?.length || 0
  });

  // Get product for reference
  const product = await Product.findById(productId, 'name');
  if (!product) {
    throw new ApiError('Parent product not found', 404);
  }

  // Check SKU uniqueness if changed
  if (sku && sku.trim() !== variant.sku) {
    const existingSku = await ProductVariant.findOne({ 
      sku: sku.trim(), 
      _id: { $ne: id },
      isDeleted: false
    });
    
    if (existingSku) {
      throw new ApiError('SKU already exists', 400);
    }
  }

  // Create update object
  const updateData = {};
  
  // Update fields if provided with proper type conversions
  if (name !== undefined) updateData.name = name.trim();
  if (sku !== undefined) updateData.sku = sku.trim();
  if (color !== undefined) updateData.color = color ? color.trim() : null;
  if (size !== undefined) updateData.size = size ? size.trim() : null;
  if (material !== undefined) updateData.material = material ? material.trim() : null;
  if (priceAdjustment !== undefined) updateData.priceAdjustment = parseFloat(priceAdjustment) || 0;
  if (stockQuantity !== undefined) updateData.stockQuantity = parseInt(stockQuantity, 10) || 0;
  if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder, 10) || 0;
  if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;
  
  // Add other fields
  Object.assign(updateData, otherFields);

  console.log('Update data prepared:', updateData);

  // Store current images for potential cleanup
  const currentImages = variant.images || [];
  let imagesToDelete = [];

  // Handle image removal if specified
  if (removeImages) {
    const imagesToRemove = Array.isArray(removeImages) 
      ? removeImages 
      : [removeImages];
    
    console.log('Variant images to remove:', imagesToRemove);
    
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
      console.log(`Processing ${req.files.length} new variant images...`);
      
      // Use imageService to process multiple images
      const imageResults = await imageService.uploadMultipleImages(req.files, 'variants');
      
      const existingImagesCount = updateData.images ? updateData.images.length : currentImages.length;
      
      // Transform results to match the expected format
      const newImages = imageResults.map((result, index) => ({
        url: result.url,
        path: result.path,
        altText: `${product.name} - ${name || variant.name}`,
        isDefault: existingImagesCount === 0 && index === 0, // First image is default if no existing images
        sortOrder: existingImagesCount + index
      }));
      
      // Add new images to existing ones (or to the filtered list if removing images)
      if (updateData.images) {
        updateData.images = [...updateData.images, ...newImages];
      } else {
        updateData.images = [...currentImages, ...newImages];
      }
      
      console.log(`All ${newImages.length} new variant images processed successfully`);
      
    } catch (error) {
      console.error('New variant images upload error:', error);
      throw new ApiError(`Image upload failed: ${error.message}`, 400);
    }
  }

  try {
    // Update the variant
    console.log('Updating variant in database...');
    const updatedVariant = await ProductVariant.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    // Delete removed images after successful update
    if (imagesToDelete.length > 0) {
      console.log(`Deleting ${imagesToDelete.length} removed variant images...`);
      const imagePathsToDelete = imagesToDelete.map(img => img.path || img.url);
      const cleanupResult = await imageService.cleanupImages(imagePathsToDelete);
      console.log('Variant image cleanup result:', cleanupResult);
    }

    console.log('Product variant updated successfully:', {
      id: updatedVariant._id,
      name: updatedVariant.name,
      sku: updatedVariant.sku,
      imagesCount: updatedVariant.images?.length || 0
    });

    console.log('=== UPDATE PRODUCT VARIANT SUCCESS ===');
    return ApiResponse.success(res, { variant: updatedVariant });
    
  } catch (error) {
    console.error('Variant update failed:', error);
    
    // Cleanup newly uploaded images if update fails
    if (req.files && req.files.length > 0) {
      console.log('Cleaning up newly uploaded variant images due to update failure...');
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
    
    console.log('=== UPDATE PRODUCT VARIANT FAILED ===');
    throw error;
  }
});

/**
 * @desc    Delete a product variant (soft delete)
 * @route   DELETE /api/products/:productId/variants/:id
 * @access  Private (Admin)
 */
exports.deleteProductVariant = asyncHandler(async (req, res) => {
  const { productId, id } = req.params;

  // Find the variant
  const variant = await ProductVariant.findOne({ 
    _id: id, 
    productId 
  });

  if (!variant) {
    throw new ApiError('Product variant not found', 404);
  }

  // Soft delete
  variant.isDeleted = true;
  await variant.save();

  return ApiResponse.success(res, null, 'Product variant deleted successfully');
});

/**
 * @desc    Restore a deleted product variant
 * @route   PUT /api/products/:productId/variants/:id/restore
 * @access  Private (Admin)
 */
exports.restoreProductVariant = asyncHandler(async (req, res) => {
  const { productId, id } = req.params;

  // Find the variant with includeDeleted option
  const variant = await ProductVariant.findOne({ 
    _id: id, 
    productId,
    isDeleted: true 
  });
  
  if (!variant) {
    throw new ApiError('Deleted product variant not found', 404);
  }

  // Restore the variant
  variant.isDeleted = false;
  await variant.save();

  return ApiResponse.success(res, { variant }, 'Product variant restored successfully');
});