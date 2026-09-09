// controllers/category.controller.js
const Category = require('../models/Category');
const Product = require('../models/Product');
const imageService = require('../utils/imageService');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middlewares/async.middleware');
const mongoose = require('mongoose');

/**
 * @desc    Get all categories
 * @route   GET /api/categories
 * @access  Public
 */
exports.getCategories = asyncHandler(async (req, res) => {
  const { 
    flat = false, 
    featured, 
    parent,
    includeProducts,
    page,
    limit = 20,
    ...otherFilters
  } = req.query;

  // Build query
  const query = { isDeleted: false };

  // Filter by featured
  if (featured === 'true') {
    query.featured = true;
  }

  // Filter by parent category
  if (parent === 'null' || parent === 'root') {
    query.parentId = null;
  } else if (parent) {
    query.parentId = parent;
  }

  // Add other filters
  for (const key in otherFilters) {
    query[key] = otherFilters[key];
  }

  // Check if pagination is requested
  if (page) {
    const options = {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      sort: 'displayOrder name',
      populate: [{
        path: 'productsCount'
      }]
    };

    // Add subcategories if not flat view
    if (flat !== 'true') {
      options.populate.push({
        path: 'subcategories',
        select: 'name slug image',
        populate: {
          path: 'productsCount'
        }
      });
    }

    // Add products count if requested
    if (includeProducts === 'true') {
      options.populate.push('productsCount');
    }

    // Execute paginated query
    const categories = await Category.paginate(query, options);

    return ApiResponse.success(res, {
      categories: categories.docs,
      pagination: {
        currentPage: categories.page,
        totalPages: categories.totalPages,
        totalItems: categories.totalDocs,
        limit: categories.limit
      }
    });
  } else {
    // Execute regular query
    let categories;

    if (flat === 'true') {
      // Flat list - no hierarchy
      categories = await Category.find(query)
        .sort('displayOrder name')
        .populate('productsCount');
    } else {
      // Return hierarchical structure
      categories = await Category.getHierarchy();
    }

    return ApiResponse.success(res, { categories });
  }
});

/**
 * @desc    Get a single category
 * @route   GET /api/categories/:id
 * @access  Public
 */
exports.getCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { includeProducts, productsLimit = 10 } = req.query;
  
  let category;
  
  // Check if id is a valid ObjectId or a slug
  if (mongoose.Types.ObjectId.isValid(id)) {
    category = await Category.findById(id);
  } else {
    category = await Category.findOne({ slug: id });
  }
  
  if (!category || category.isDeleted) {
    throw new ApiError('Category not found', 404);
  }
  
  // Populate subcategories
  await category.populate({
    path: 'subcategories',
    select: 'name slug image',
    populate: {
      path: 'productsCount'
    }
  });
  
  // Populate products count
  await category.populate('productsCount');
  
  // Include products if requested
  if (includeProducts === 'true') {
    const products = await Product.find({
      categoryId: category._id,
      isDeleted: false
    })
      .select('name slug images basePrice averageRating')
      .sort('-createdAt')
      .limit(parseInt(productsLimit, 10));
      
    // Convert to plain object for adding products
    const categoryObj = category.toObject();
    categoryObj.products = products;
    
    return ApiResponse.success(res, { category: categoryObj });
  }
  
  return ApiResponse.success(res, { category });
});

/**
 * @desc    Create a new category
 * @route   POST /api/categories
 * @access  Private (Admin, Staff)
 */
exports.createCategory = asyncHandler(async (req, res) => {
  console.log('=== CREATE CATEGORY START ===');
  console.log('Request body:', req.body);
  console.log('Uploaded file:', req.file ? {
    fieldname: req.file.fieldname,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    filename: req.file.filename,
    path: req.file.path,
    key: req.file.key,
    location: req.file.location
  } : 'No file uploaded');

  const {
    name,
    description,
    parentId,
    displayOrder,
    featured,
    showInMenu,
    showInHome,
    isActive,
    icon,
    metaTitle,
    metaDescription,
    metaKeywords,
    ...otherFields
  } = req.body;
  
  // Validate required fields
  if (!name || name.trim() === '') {
    throw new ApiError('Category name is required', 400);
  }
  
  // Create category object with proper type conversions
  const categoryData = {
    name: name.trim(),
    description: description ? description.trim() : '',
    parentId: (parentId === 'null' || parentId === '' || !parentId) ? null : parentId,
    displayOrder: displayOrder ? parseInt(displayOrder, 10) : 0,
    featured: featured === 'true' || featured === true,
    showInMenu: showInMenu !== 'false' && showInMenu !== false,
    showInHome: showInHome === 'true' || showInHome === true,
    isActive: isActive !== 'false' && isActive !== false,
    icon: icon ? icon.trim() : null,
    metaTitle: metaTitle ? metaTitle.trim() : name.trim(),
    metaDescription: metaDescription ? metaDescription.trim() : (description ? description.trim() : ''),
    metaKeywords: metaKeywords ? metaKeywords.trim() : '',
    ...otherFields
  };

  console.log('Category data prepared:', categoryData);

  // Handle image upload if provided
  if (req.file) {
    try {
      console.log('Processing category image upload...');
      
      // Use the imageService to process the uploaded file
      const imageResult = await imageService.uploadImage(req.file, 'categories');
      
      categoryData.image = imageResult.url;
      categoryData.imagePath = imageResult.path;
      
      console.log('Category image processed successfully:', {
        url: imageResult.url,
        path: imageResult.path,
        size: imageResult.size
      });
      
    } catch (error) {
      console.error('Category image upload error:', error);
      throw new ApiError(`Image upload failed: ${error.message}`, 400);
    }
  }
  
  try {
    // Create the category
    console.log('Creating category in database...');
    const category = await Category.create(categoryData);
    
    console.log('Category created successfully:', {
      id: category._id,
      name: category.name,
      slug: category.slug,
      image: category.image,
      imagePath: category.imagePath
    });
    
    console.log('=== CREATE CATEGORY SUCCESS ===');
    return ApiResponse.created(res, { category });
    
  } catch (error) {
    console.error('Category creation failed:', error);
    
    // Cleanup uploaded image if category creation fails
    if (req.file && categoryData.imagePath) {
      console.log('Cleaning up uploaded image due to category creation failure...');
      await imageService.deleteImage(categoryData.imagePath);
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
    
    console.log('=== CREATE CATEGORY FAILED ===');
    throw error;
  }
});

/**
 * @desc    Update a category
 * @route   PUT /api/categories/:id
 * @access  Private (Admin, Staff)
 */
exports.updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  console.log('=== UPDATE CATEGORY START ===');
  console.log('Category ID:', id);
  console.log('Request body:', req.body);
  console.log('Uploaded file:', req.file ? {
    fieldname: req.file.fieldname,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    filename: req.file.filename,
    path: req.file.path,
    key: req.file.key,
    location: req.file.location
  } : 'No file uploaded');

  const {
    name,
    description,
    parentId,
    displayOrder,
    featured,
    showInMenu,
    showInHome,
    isActive,
    icon,
    metaTitle,
    metaDescription,
    metaKeywords,
    removeImage,
    ...otherFields
  } = req.body;
  
  // Find the category
  const category = await Category.findById(id);
  if (!category || category.isDeleted) {
    throw new ApiError('Category not found', 404);
  }

  console.log('Found category:', {
    id: category._id,
    name: category.name,
    currentImage: category.image,
    currentImagePath: category.imagePath
  });
  
  // Check for parent-child circular reference
  if (parentId && parentId !== 'null' && parentId !== null && parentId !== '') {
    // Ensure the parent category exists
    const parentCategory = await Category.findById(parentId);
    if (!parentCategory || parentCategory.isDeleted) {
      throw new ApiError('Parent category not found', 404);
    }
    
    // Check that the parent is not itself or its descendant
    if (parentId === id) {
      throw new ApiError('Category cannot be its own parent', 400);
    }
    
    // Check if the parent is a descendant of this category
    const isDescendant = await isDescendantOf(parentId, id);
    if (isDescendant) {
      throw new ApiError('Parent category cannot be a descendant of this category', 400);
    }
  }
  
  // Create update object
  const updateData = {};
  
  // Update fields if provided with proper type conversions
  if (name !== undefined) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description ? description.trim() : '';
  
  // Handle parentId properly
  if (parentId === 'null' || parentId === '' || parentId === null) {
    updateData.parentId = null;
  } else if (parentId !== undefined) {
    updateData.parentId = parentId;
  }
  
  if (displayOrder !== undefined) updateData.displayOrder = parseInt(displayOrder, 10);
  if (featured !== undefined) updateData.featured = featured === 'true' || featured === true;
  if (showInMenu !== undefined) updateData.showInMenu = showInMenu === 'true' || showInMenu === true;
  if (showInHome !== undefined) updateData.showInHome = showInHome === 'true' || showInHome === true;
  if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;
  if (icon !== undefined) updateData.icon = icon ? icon.trim() : null;
  if (metaTitle !== undefined) updateData.metaTitle = metaTitle ? metaTitle.trim() : '';
  if (metaDescription !== undefined) updateData.metaDescription = metaDescription ? metaDescription.trim() : '';
  if (metaKeywords !== undefined) updateData.metaKeywords = metaKeywords ? metaKeywords.trim() : '';
  
  // Add other fields
  Object.assign(updateData, otherFields);

  console.log('Update data prepared:', updateData);
  
  // Store old image info for cleanup
  const oldImagePath = category.imagePath || category.image;
  let imagesToCleanup = [];
  
  // Handle image removal if specified
  if (removeImage === 'true' && oldImagePath) {
    console.log('Image removal requested for:', oldImagePath);
    updateData.image = null;
    updateData.imagePath = null;
    imagesToCleanup.push(oldImagePath);
  }
  
  // Handle new image upload
  if (req.file) {
    try {
      console.log('Processing new category image upload...');
      
      // Use the imageService to process the uploaded file
      const imageResult = await imageService.uploadImage(req.file, 'categories');
      
      updateData.image = imageResult.url;
      updateData.imagePath = imageResult.path;
      
      console.log('New category image processed successfully:', {
        url: imageResult.url,
        path: imageResult.path,
        size: imageResult.size
      });
      
      // Add old image to cleanup list if we're replacing it (and not explicitly removing)
      if (oldImagePath && removeImage !== 'true') {
        imagesToCleanup.push(oldImagePath);
      }
      
    } catch (error) {
      console.error('New category image upload error:', error);
      throw new ApiError(`Image upload failed: ${error.message}`, 400);
    }
  }
  
  try {
    // Update the category
    console.log('Updating category in database...');
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    // Cleanup old images after successful update
    if (imagesToCleanup.length > 0) {
      console.log(`Cleaning up ${imagesToCleanup.length} old images...`);
      for (const imagePath of imagesToCleanup) {
        try {
          await imageService.deleteImage(imagePath);
          console.log('Successfully cleaned up old image:', imagePath);
        } catch (cleanupError) {
          console.error('Failed to cleanup old image:', imagePath, cleanupError.message);
          // Continue with other cleanups even if one fails
        }
      }
    }
    
    console.log('Category updated successfully:', {
      id: updatedCategory._id,
      name: updatedCategory.name,
      slug: updatedCategory.slug,
      image: updatedCategory.image,
      imagePath: updatedCategory.imagePath
    });
    
    console.log('=== UPDATE CATEGORY SUCCESS ===');
    return ApiResponse.success(res, { category: updatedCategory });
    
  } catch (error) {
    console.error('Category update failed:', error);
    
    // Cleanup newly uploaded image if update fails
    if (req.file && updateData.imagePath) {
      console.log('Cleaning up newly uploaded image due to update failure...');
      await imageService.deleteImage(updateData.imagePath);
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
    
    console.log('=== UPDATE CATEGORY FAILED ===');
    throw error;
  }
});

/**
 * @desc    Delete a category (soft delete)
 * @route   DELETE /api/categories/:id
 * @access  Private (Admin)
 */
exports.deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  console.log('=== DELETE CATEGORY START ===');
  console.log('Category ID:', id);
  
  // Find the category
  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError('Category not found', 404);
  }
  
  console.log('Found category for deletion:', {
    id: category._id,
    name: category.name,
    hasSubcategories: category.subcategories?.length > 0
  });
  
  // Check if this category has subcategories
  const subcategories = await Category.countDocuments({ parentId: id, isDeleted: false });
  if (subcategories > 0) {
    throw new ApiError('Cannot delete category with subcategories. Delete or reassign subcategories first.', 400);
  }
  
  // Check if this category has products
  const products = await Product.countDocuments({ categoryId: id, isDeleted: false });
  if (products > 0) {
    throw new ApiError('Cannot delete category with products. Reassign products to another category first.', 400);
  }
  
  // Soft delete
  category.isDeleted = true;
  await category.save();
  
  console.log('Category soft deleted successfully');
  console.log('=== DELETE CATEGORY SUCCESS ===');
  
  return ApiResponse.success(res, null, 'Category deleted successfully');
});

/**
 * @desc    Restore a deleted category
 * @route   PUT /api/categories/:id/restore
 * @access  Private (Admin)
 */
exports.restoreCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  console.log('=== RESTORE CATEGORY START ===');
  console.log('Category ID:', id);
  
  // Find the deleted category
  const category = await Category.findOne({ _id: id, isDeleted: true });
  if (!category) {
    throw new ApiError('Deleted category not found', 404);
  }
  
  console.log('Found deleted category for restoration:', {
    id: category._id,
    name: category.name,
    parentId: category.parentId
  });
  
  // Check if parent is deleted
  if (category.parentId) {
    const parent = await Category.findById(category.parentId);
    if (parent && parent.isDeleted) {
      throw new ApiError('Cannot restore category with deleted parent. Restore parent category first.', 400);
    }
  }
  
  // Restore category
  category.isDeleted = false;
  await category.save();
  
  console.log('Category restored successfully');
  console.log('=== RESTORE CATEGORY SUCCESS ===');
  
  return ApiResponse.success(res, { category }, 'Category restored successfully');
});

/**
 * @desc    Get products by category
 * @route   GET /api/categories/:id/products
 * @access  Public
 */
exports.getCategoryProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    page = 1, 
    limit = 12, 
    sort = '-createdAt',
    includeSubcategories = 'true',
    ...filters
  } = req.query;
  
  // Find the category
  let category;
  if (mongoose.Types.ObjectId.isValid(id)) {
    category = await Category.findById(id);
  } else {
    category = await Category.findOne({ slug: id });
  }
  
  if (!category || category.isDeleted) {
    throw new ApiError('Category not found', 404);
  }
  
  // Build query
  const query = {
    isDeleted: false
  };
  
  if (includeSubcategories === 'true') {
    // Get all subcategory IDs
    const subcategories = await Category.find({ parentId: category._id, isDeleted: false });
    const categoryIds = [
      category._id,
      ...subcategories.map(subcat => subcat._id)
    ];
    
    query.categoryId = { $in: categoryIds };
  } else {
    query.categoryId = category._id;
  }
  
  // Add other filters
  for (const key in filters) {
    query[key] = filters[key];
  }
  
  // Execute paginated query
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort,
    populate: [
      { path: 'categoryId', select: 'name slug' }
    ]
  };
  
  const products = await Product.paginate(query, options);
  
  return ApiResponse.success(res, {
    category: {
      _id: category._id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      image: category.image
    },
    products: products.docs,
    pagination: {
      currentPage: products.page,
      totalPages: products.totalPages,
      totalItems: products.totalDocs,
      limit: products.limit
    }
  });
});

/**
 * @desc    Get featured categories
 * @route   GET /api/categories/featured
 * @access  Public
 */
exports.getFeaturedCategories = asyncHandler(async (req, res) => {
  const { limit = 5 } = req.query;
  
  // Use the static method from the model
  const categories = await Category.getFeaturedCategories(parseInt(limit, 10));
  
  return ApiResponse.success(res, {
    categories,
    count: categories.length
  });
});

/**
 * @desc    Reorder categories
 * @route   PUT /api/categories/reorder
 * @access  Private (Admin, Staff)
 */
exports.reorderCategories = asyncHandler(async (req, res) => {
  const { categories } = req.body;
  
  if (!categories || !Array.isArray(categories)) {
    throw new ApiError('Categories array is required', 400);
  }
  
  console.log('=== REORDER CATEGORIES START ===');
  console.log('Categories to reorder:', categories.length);
  
  // Update displayOrder for each category
  for (const item of categories) {
    if (!item.id || item.displayOrder === undefined) {
      throw new ApiError('Each item must have id and displayOrder', 400);
    }
    
    await Category.findByIdAndUpdate(
      item.id,
      { displayOrder: item.displayOrder }
    );
  }
  
  // Get updated categories
  const updatedCategories = await Category.find({ 
    _id: { $in: categories.map(item => item.id) }
  })
    .sort('displayOrder name')
    .select('name slug displayOrder');
  
  console.log('Categories reordered successfully');
  console.log('=== REORDER CATEGORIES SUCCESS ===');
  
  return ApiResponse.success(res, {
    categories: updatedCategories,
    message: 'Categories reordered successfully'
  });
});

/**
 * Helper function to check if a category is a descendant of another
 * @param {String} categoryId - Category to check
 * @param {String} possibleParentId - Possible parent category
 * @returns {Promise<Boolean>} - True if categoryId is a descendant of possibleParentId
 */
async function isDescendantOf(categoryId, possibleParentId) {
  try {
    let current = await Category.findById(categoryId);
    
    if (!current || !current.parentId) {
      return false;
    }
    
    if (current.parentId.toString() === possibleParentId) {
      return true;
    }
    
    return isDescendantOf(current.parentId, possibleParentId);
  } catch (error) {
    console.error('Error checking category descendant relationship:', error);
    return false;
  }
}
