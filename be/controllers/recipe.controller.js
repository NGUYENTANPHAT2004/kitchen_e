// controllers/recipe.controller.js
const Recipe = require('../models/Recipe');
const RecipeProductLink = require('../models/RecipeProductLink');
const Product = require('../models/Product');
const imageService = require('../utils/imageService');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middlewares/async.middleware');
const mongoose = require('mongoose');

/**
 * @desc    Get all recipes with pagination, filtering, and sorting
 * @route   GET /api/recipes
 * @access  Public
 */
exports.getRecipes = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    sort = '-createdAt',
    difficulty,
    mealType,
    cuisineType,
    search,
    featured,
    maxPrepTime,
    maxCookTime,
    maxTotalTime,
    ...otherFilters
  } = req.query;

  // Build query
  const query = { 
    isPublished: true,
    isDeleted: false
  };

  // Apply filters
  if (difficulty) {
    query.difficulty = difficulty;
  }

  if (mealType) {
    query.mealType = mealType;
  }

  if (cuisineType) {
    query.cuisineType = cuisineType;
  }

  if (featured === 'true') {
    query.isFeatured = true;
  }

  // Time filters
  if (maxPrepTime) {
    query.preparationTime = { $lte: parseInt(maxPrepTime, 10) };
  }

  if (maxCookTime) {
    query.cookingTime = { $lte: parseInt(maxCookTime, 10) };
  }

  if (maxTotalTime) {
    query.$expr = {
      $lte: [
        { $sum: ['$preparationTime', '$cookingTime'] },
        parseInt(maxTotalTime, 10)
      ]
    };
  }

  // Text search
  if (search) {
    query.$text = { $search: search };
  }

  // Add other filters
  for (const key in otherFilters) {
    query[key] = otherFilters[key];
  }

  // Prepare options for pagination
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: search && query.$text ? { score: { $meta: 'textScore' } } : sort,
    populate: [
      { 
        path: 'authorId', 
        select: 'firstName lastName username avatar' 
      }
    ]
  };

  // Execute paginated query
  const recipes = await Recipe.paginate(query, options);

  return ApiResponse.success(res, {
    recipes: recipes.docs,
    pagination: {
      currentPage: recipes.page,
      totalPages: recipes.totalPages,
      totalItems: recipes.totalDocs,
      limit: recipes.limit
    }
  });
});

/**
 * @desc    Get a single recipe by ID or slug
 * @route   GET /api/recipes/:id
 * @access  Public
 */
exports.getRecipe = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { includeRelatedProducts = 'true' } = req.query;
  
  let recipe;
  
  // Check if id is a valid ObjectId or a slug
  if (mongoose.Types.ObjectId.isValid(id)) {
    recipe = await Recipe.findById(id);
  } else {
    recipe = await Recipe.findOne({ slug: id });
  }
  
  if (!recipe || recipe.isDeleted || (!recipe.isPublished && !req.user?.role === 'admin')) {
    throw new ApiError('Recipe not found', 404);
  }
  
  // Increment view count
  recipe.viewCount += 1;
  await recipe.save({ validateBeforeSave: false });
  
  // Populate author info
  await recipe.populate('authorId', 'firstName lastName username avatar');
  
  // Get related products if requested
  if (includeRelatedProducts === 'true') {
    const relatedProducts = await RecipeProductLink.getProductsForRecipe(recipe._id);
    
    // Convert to plain object for adding related products
    const recipeObj = recipe.toObject();
    recipeObj.relatedProducts = relatedProducts;
    
    // Get similar recipes
    const similarRecipes = await Recipe.find({
      _id: { $ne: recipe._id },
      isPublished: true,
      isDeleted: false,
      $or: [
        { mealType: recipe.mealType },
        { cuisineType: recipe.cuisineType },
        { tags: { $in: recipe.tags } }
      ]
    })
      .select('title slug coverImage difficulty preparationTime cookingTime rating')
      .sort('-rating viewCount')
      .limit(4);
    
    recipeObj.similarRecipes = similarRecipes;
    
    return ApiResponse.success(res, { recipe: recipeObj });
  }
  
  return ApiResponse.success(res, { recipe });
});

/**
 * @desc    Create a new recipe
 * @route   POST /api/recipes
 * @access  Private (Admin, Staff, Verified Users)
 */
exports.createRecipe = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    preparationTime,
    cookingTime,
    servings,
    difficulty,
    ingredients,
    instructions,
    nutritionInfo,
    cuisineType,
    mealType,
    tags,
    source,
    sourceUrl,
    isPublished,
    videoDemonstration,
    ...otherFields
  } = req.body;
  
  // Validate required fields
  if (!title || !description) {
    throw new ApiError('Title and description are required', 400);
  }
  
  // Process ingredients if provided as string
  let processedIngredients = [];
  if (ingredients) {
    try {
      if (typeof ingredients === 'string') {
        processedIngredients = JSON.parse(ingredients);
      } else if (Array.isArray(ingredients)) {
        processedIngredients = ingredients;
      }
    } catch (error) {
      throw new ApiError('Invalid ingredients format', 400);
    }
  }
  
  // Process instructions if provided as string
  let processedInstructions = [];
  if (instructions) {
    try {
      if (typeof instructions === 'string') {
        processedInstructions = JSON.parse(instructions);
      } else if (Array.isArray(instructions)) {
        processedInstructions = instructions;
      }
    } catch (error) {
      throw new ApiError('Invalid instructions format', 400);
    }
  }
  
  // Process nutrition info if provided as string
  let processedNutritionInfo = {};
  if (nutritionInfo) {
    try {
      if (typeof nutritionInfo === 'string') {
        processedNutritionInfo = JSON.parse(nutritionInfo);
      } else if (typeof nutritionInfo === 'object') {
        processedNutritionInfo = nutritionInfo;
      }
    } catch (error) {
      throw new ApiError('Invalid nutrition info format', 400);
    }
  }
  
  // Process tags if provided as string
  let processedTags = [];
  if (tags) {
    if (typeof tags === 'string') {
      processedTags = tags.split(',').map(tag => tag.trim());
    } else if (Array.isArray(tags)) {
      processedTags = tags;
    }
  }
  
  // Create recipe object
  const recipeData = {
    title,
    description,
    preparationTime: preparationTime ? parseInt(preparationTime, 10) : 0,
    cookingTime: cookingTime ? parseInt(cookingTime, 10) : 0,
    servings: servings ? parseInt(servings, 10) : 1,
    difficulty: difficulty || 'medium',
    ingredients: processedIngredients,
    instructions: processedInstructions,
    nutritionInfo: processedNutritionInfo,
    cuisineType: cuisineType || '',
    mealType: mealType || 'other',
    tags: processedTags,
    authorId: req.user._id,
    authorName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.username,
    source: source || null,
    sourceUrl: sourceUrl || null,
    isPublished: isPublished === undefined ? true : (isPublished === 'true' || isPublished === true),
    videoDemonstration: videoDemonstration || null,
    ...otherFields
  };
  
  // Handle cover image
  if (req.files?.coverImage) {
    try {
      const result = await imageService.uploadImage(req.files.coverImage[0], 'recipes');
      recipeData.coverImage = result.url;
      recipeData.coverImagePath = result.path;
    } catch (error) {
      throw new ApiError(`Cover image upload failed: ${error.message}`, 500);
    }
  }
  
  // Handle step images
  if (req.files?.stepImages && Array.isArray(req.files.stepImages)) {
    const stepImagesMap = {};
    
    // Get step indices
    const stepIndices = req.body.stepIndices 
      ? Array.isArray(req.body.stepIndices) 
        ? req.body.stepIndices 
        : [req.body.stepIndices]
      : [];
    
    for (let i = 0; i < req.files.stepImages.length; i++) {
      const file = req.files.stepImages[i];
      const stepIndex = parseInt(stepIndices[i] || i, 10);
      
      try {
        const result = await imageService.uploadImage(file, 'recipes/steps');
        stepImagesMap[stepIndex] = {
          url: result.url,
          path: result.path
        };
      } catch (error) {
        console.error(`Step image upload failed: ${error.message}`);
        // Continue with other images
      }
    }
    
    // Update step images in instructions
    if (recipeData.instructions && recipeData.instructions.length > 0) {
      recipeData.instructions = recipeData.instructions.map((instruction, index) => {
        if (stepImagesMap[index]) {
          return {
            ...instruction,
            image: stepImagesMap[index].url,
            imagePath: stepImagesMap[index].path
          };
        }
        return instruction;
      });
    }
  }
  
  // Create the recipe
  const recipe = await Recipe.create(recipeData);
  
  return ApiResponse.created(res, { recipe });
});

/**
 * @desc    Update a recipe
 * @route   PUT /api/recipes/:id
 * @access  Private (Admin, Staff, Author)
 */
exports.updateRecipe = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    preparationTime,
    cookingTime,
    servings,
    difficulty,
    ingredients,
    instructions,
    nutritionInfo,
    cuisineType,
    mealType,
    tags,
    source,
    sourceUrl,
    isPublished,
    videoDemonstration,
    removeCoverImage,
    removeStepImages,
    ...otherFields
  } = req.body;
  
  // Find the recipe
  const recipe = await Recipe.findById(id);
  if (!recipe || recipe.isDeleted) {
    throw new ApiError('Recipe not found', 404);
  }
  
  // Check if user is authorized to update this recipe
  if (
    req.user.role !== 'admin' && 
    req.user.role !== 'staff' && 
    recipe.authorId.toString() !== req.user._id.toString()
  ) {
    throw new ApiError('Not authorized to update this recipe', 403);
  }
  
  // Create update object
  const updateData = {};
  
  // Update basic fields if provided
  if (title) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (preparationTime !== undefined) updateData.preparationTime = parseInt(preparationTime, 10);
  if (cookingTime !== undefined) updateData.cookingTime = parseInt(cookingTime, 10);
  if (servings !== undefined) updateData.servings = parseInt(servings, 10);
  if (difficulty) updateData.difficulty = difficulty;
  if (cuisineType !== undefined) updateData.cuisineType = cuisineType;
  if (mealType) updateData.mealType = mealType;
  if (source !== undefined) updateData.source = source;
  if (sourceUrl !== undefined) updateData.sourceUrl = sourceUrl;
  if (isPublished !== undefined) {
    updateData.isPublished = isPublished === 'true' || isPublished === true;
  }
  if (videoDemonstration !== undefined) updateData.videoDemonstration = videoDemonstration;
  
  // Process ingredients if provided
  if (ingredients) {
    try {
      if (typeof ingredients === 'string') {
        updateData.ingredients = JSON.parse(ingredients);
      } else if (Array.isArray(ingredients)) {
        updateData.ingredients = ingredients;
      }
    } catch (error) {
      throw new ApiError('Invalid ingredients format', 400);
    }
  }
  
  // Process instructions if provided
  if (instructions) {
    try {
      if (typeof instructions === 'string') {
        updateData.instructions = JSON.parse(instructions);
      } else if (Array.isArray(instructions)) {
        updateData.instructions = instructions;
      }
    } catch (error) {
      throw new ApiError('Invalid instructions format', 400);
    }
  }
  
  // Process nutrition info if provided
  if (nutritionInfo) {
    try {
      if (typeof nutritionInfo === 'string') {
        updateData.nutritionInfo = JSON.parse(nutritionInfo);
      } else if (typeof nutritionInfo === 'object') {
        updateData.nutritionInfo = nutritionInfo;
      }
    } catch (error) {
      throw new ApiError('Invalid nutrition info format', 400);
    }
  }
  
  // Process tags if provided
  if (tags) {
    if (typeof tags === 'string') {
      updateData.tags = tags.split(',').map(tag => tag.trim());
    } else if (Array.isArray(tags)) {
      updateData.tags = tags;
    }
  }
  
  // Add other fields
  Object.assign(updateData, otherFields);
  
  // Handle cover image removal
  if (removeCoverImage === 'true' && recipe.coverImage) {
    try {
      await imageService.deleteImage(recipe.coverImagePath || recipe.coverImage);
      updateData.coverImage = null;
      updateData.coverImagePath = null;
    } catch (error) {
      console.error(`Failed to delete cover image: ${error.message}`);
      // Continue even if image deletion fails
    }
  }
  
  // Handle step images removal
  if (removeStepImages && Array.isArray(updateData.instructions)) {
    let stepImagesToRemove = [];
    
    if (typeof removeStepImages === 'string') {
      try {
        stepImagesToRemove = JSON.parse(removeStepImages);
      } catch (error) {
        stepImagesToRemove = [removeStepImages];
      }
    } else if (Array.isArray(removeStepImages)) {
      stepImagesToRemove = removeStepImages;
    } else if (typeof removeStepImages === 'object') {
      stepImagesToRemove = Object.values(removeStepImages);
    }
    
    // Delete step images from storage
    for (const stepImageInfo of stepImagesToRemove) {
      try {
        let stepIndex;
        
        if (typeof stepImageInfo === 'object') {
          stepIndex = stepImageInfo.stepIndex;
        } else {
          // Handle string format "stepIndex:imageUrl".
          const [idx] = stepImageInfo.split(':');
          stepIndex = parseInt(idx, 10);
        }
        
        // Find the instruction by step index
        const instruction = recipe.instructions[stepIndex];
        if (instruction && instruction.image) {
          await imageService.deleteImage(instruction.imagePath || instruction.image);
          
          // Update the instruction in updateData
          if (updateData.instructions && updateData.instructions[stepIndex]) {
            updateData.instructions[stepIndex].image = null;
            updateData.instructions[stepIndex].imagePath = null;
          }
        }
      } catch (error) {
        console.error(`Failed to delete step image: ${error.message}`);
        // Continue with other images
      }
    }
  }
  
  // Handle new cover image
  if (req.files?.coverImage) {
    try {
      // Delete old cover image if exists
      if (recipe.coverImage) {
        await imageService.deleteImage(recipe.coverImagePath || recipe.coverImage);
      }
      
      // Upload new cover image
      const result = await imageService.uploadImage(req.files.coverImage[0], 'recipes');
      updateData.coverImage = result.url;
      updateData.coverImagePath = result.path;
    } catch (error) {
      throw new ApiError(`Cover image upload failed: ${error.message}`, 500);
    }
  }
  
  // Handle new step images
  if (req.files?.stepImages && Array.isArray(req.files.stepImages)) {
    const stepImagesMap = {};
    
    // Get step indices
    const stepIndices = req.body.stepIndices 
      ? Array.isArray(req.body.stepIndices) 
        ? req.body.stepIndices 
        : [req.body.stepIndices]
      : [];
    
    for (let i = 0; i < req.files.stepImages.length; i++) {
      const file = req.files.stepImages[i];
      const stepIndex = parseInt(stepIndices[i] || i, 10);
      
      try {
        const result = await imageService.uploadImage(file, 'recipes/steps');
        stepImagesMap[stepIndex] = {
          url: result.url,
          path: result.path
        };
      } catch (error) {
        console.error(`Step image upload failed: ${error.message}`);
        // Continue with other images
      }
    }
    
    // Update step images in instructions
    const instructions = updateData.instructions || recipe.instructions;
    
    if (instructions && instructions.length > 0) {
      updateData.instructions = instructions.map((instruction, index) => {
        if (stepImagesMap[index]) {
          // Delete old image if exists
          if (instruction.image) {
            imageService.deleteImage(instruction.imagePath || instruction.image)
              .catch(err => console.error(`Failed to delete old step image: ${err.message}`));
          }
          
          return {
            ...instruction,
            image: stepImagesMap[index].url,
            imagePath: stepImagesMap[index].path
          };
        }
        return instruction;
      });
    }
  }
  
  // Update the recipe
  const updatedRecipe = await Recipe.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  );
  
  return ApiResponse.success(res, { recipe: updatedRecipe });
});

/**
 * @desc    Delete a recipe (soft delete)
 * @route   DELETE /api/recipes/:id
 * @access  Private (Admin, Author)
 */
exports.deleteRecipe = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Find the recipe
  const recipe = await Recipe.findById(id);
  if (!recipe) {
    throw new ApiError('Recipe not found', 404);
  }
  
  // Check if user is authorized to delete this recipe
  if (
    req.user.role !== 'admin' && 
    recipe.authorId.toString() !== req.user._id.toString()
  ) {
    throw new ApiError('Not authorized to delete this recipe', 403);
  }
  
  // Soft delete
  recipe.isDeleted = true;
  await recipe.save();
  
  return ApiResponse.success(res, null, 'Recipe deleted successfully');
});

/**
 * @desc    Restore a deleted recipe
 * @route   PUT /api/recipes/:id/restore
 * @access  Private (Admin)
 */
exports.restoreRecipe = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Find the deleted recipe
  const recipe = await Recipe.findOne({ _id: id, isDeleted: true });
  if (!recipe) {
    throw new ApiError('Deleted recipe not found', 404);
  }
  
  // Restore recipe
  recipe.isDeleted = false;
  await recipe.save();
  
  return ApiResponse.success(res, { recipe }, 'Recipe restored successfully');
});

/**
 * @desc    Rate a recipe
 * @route   POST /api/recipes/:id/rate
 * @access  Private
 */
exports.rateRecipe = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;
  
  // Validate rating
  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError('Rating must be between 1 and 5', 400);
  }
  
  // Find the recipe
  const recipe = await Recipe.findOne({ 
    _id: id, 
    isPublished: true,
    isDeleted: false
  });
  
  if (!recipe) {
    throw new ApiError('Recipe not found', 404);
  }
  
  // Add or update rating
  await recipe.addRating(req.user._id, parseFloat(rating), comment || '');
  
  return ApiResponse.success(res, { 
    rating: recipe.rating,
    ratingCount: recipe.ratingCount
  }, 'Rating added successfully');
});

/**
 * @desc    Add/remove product to/from recipe
 * @route   POST /api/recipes/:id/products
 * @access  Private (Admin, Staff, Author)
 */
exports.manageRecipeProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    productId,
    action = 'add',
    relevance,
    isEssential,
    isRecommended,
    comment,
    ingredientMapping,
    variantIds
  } = req.body;
  
  // Validate required fields
  if (!productId) {
    throw new ApiError('Product ID is required', 400);
  }
  
  // Find the recipe
  const recipe = await Recipe.findById(id);
  if (!recipe || recipe.isDeleted) {
    throw new ApiError('Recipe not found', 404);
  }
  
  // Check if user is authorized
  if (
    req.user.role !== 'admin' && 
    req.user.role !== 'staff' && 
    recipe.authorId.toString() !== req.user._id.toString()
  ) {
    throw new ApiError('Not authorized to manage recipe products', 403);
  }
  
  // Validate product exists
  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) {
    throw new ApiError('Product not found', 404);
  }
  
  // Process ingredient mapping if provided as string
  let processedMapping = [];
  if (ingredientMapping) {
    if (typeof ingredientMapping === 'string') {
      try {
        processedMapping = JSON.parse(ingredientMapping);
      } catch (error) {
        // If can't parse as JSON, treat as comma-separated list
        processedMapping = ingredientMapping.split(',').map(item => item.trim());
      }
    } else if (Array.isArray(ingredientMapping)) {
      processedMapping = ingredientMapping;
    }
  }
  
  // Process variant IDs if provided as string
  let processedVariantIds = [];
  if (variantIds) {
    if (typeof variantIds === 'string') {
      try {
        processedVariantIds = JSON.parse(variantIds);
      } catch (error) {
        // If can't parse as JSON, treat as comma-separated list
        processedVariantIds = variantIds.split(',').map(item => item.trim());
      }
    } else if (Array.isArray(variantIds)) {
      processedVariantIds = variantIds;
    }
  }
  
  if (action === 'remove') {
    // Remove product from recipe
    const link = await RecipeProductLink.findOneAndDelete({
      recipeId: id,
      productId
    });
    
    if (!link) {
      throw new ApiError('Product link not found', 404);
    }
    
    return ApiResponse.success(res, null, 'Product removed from recipe successfully');
  } else {
    // Add or update product link
    const linkData = {
      relevance: relevance ? parseFloat(relevance) : 1,
      isEssential: isEssential === 'true' || isEssential === true,
      isRecommended: isRecommended !== 'false' && isRecommended !== false,
      comment: comment || '',
      ingredientMapping: processedMapping,
      variantIds: processedVariantIds
    };
    
    // Check if the link already exists
    const existingLink = await RecipeProductLink.findOne({
      recipeId: id,
      productId
    });
    
    if (existingLink) {
      // Update existing link
      const updatedLink = await RecipeProductLink.findByIdAndUpdate(
        existingLink._id,
        linkData,
        { new: true, runValidators: true }
      );
      
      return ApiResponse.success(res, { productLink: updatedLink }, 'Product link updated successfully');
    } else {
      // Create new link
      const newLink = await RecipeProductLink.create({
        recipeId: id,
        productId,
        ...linkData
      });
      
      return ApiResponse.created(res, { productLink: newLink }, 'Product added to recipe successfully');
    }
  }
});

/**
 * @desc    Get products related to a recipe
 * @route   GET /api/recipes/:id/products
 * @access  Public
 */
exports.getRecipeProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Find the recipe
  const recipe = await Recipe.findOne({ 
    _id: id, 
    isPublished: true,
    isDeleted: false
  });
  
  if (!recipe) {
    throw new ApiError('Recipe not found', 404);
  }
  
  // Get related products
  const relatedProducts = await RecipeProductLink.getProductsForRecipe(id);
  
  return ApiResponse.success(res, { 
    recipe: {
      _id: recipe._id,
      title: recipe.title,
      slug: recipe.slug
    },
    products: relatedProducts
  });
});

/**
 * @desc    Get featured recipes
 * @route   GET /api/recipes/featured
 * @access  Public
 */
exports.getFeaturedRecipes = asyncHandler(async (req, res) => {
  const { limit = 5 } = req.query;
  
  // Use the static method from the model
  const recipes = await Recipe.getFeaturedRecipes(parseInt(limit, 10));
  
  return ApiResponse.success(res, {
    recipes,
    count: recipes.length
  });
});

/**
 * @desc    Get popular recipes
 * @route   GET /api/recipes/popular
 * @access  Public
 */
exports.getPopularRecipes = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  
  // Use the static method from the model
  const recipes = await Recipe.getPopularRecipes(parseInt(limit, 10));
  
  return ApiResponse.success(res, {
    recipes,
    count: recipes.length
  });
});

/**
 * @desc    Search recipes
 * @route   GET /api/recipes/search
 * @access  Public
 */
exports.searchRecipes = asyncHandler(async (req, res) => {
  const { 
    query, 
    difficulty, 
    mealType, 
    cuisineType, 
    maxTime,
    limit = 20 
  } = req.query;
  
  // Create filters object
  const filters = {};
  if (difficulty) filters.difficulty = difficulty;
  if (mealType) filters.mealType = mealType;
  if (cuisineType) filters.cuisineType = cuisineType;
  if (maxTime) filters.maxTime = parseInt(maxTime, 10);
  
  // Use the static method from the model
  const recipes = await Recipe.searchRecipes(
    query,
    filters,
    parseInt(limit, 10)
  );
  
  return ApiResponse.success(res, {
    recipes,
    count: recipes.length,
    query
  });
});

/**
 * @desc    Toggle recipe as featured
 * @route   PUT /api/recipes/:id/feature
 * @access  Private (Admin)
 */
exports.toggleFeatureRecipe = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Find the recipe
  const recipe = await Recipe.findOne({ _id: id, isDeleted: false });
  if (!recipe) {
    throw new ApiError('Recipe not found', 404);
  }
  
  // Toggle featured status
  recipe.isFeatured = !recipe.isFeatured;
  await recipe.save();
  
  return ApiResponse.success(res, { 
    recipe: {
      _id: recipe._id,
      title: recipe.title,
      isFeatured: recipe.isFeatured
    }
  }, `Recipe ${recipe.isFeatured ? 'featured' : 'unfeatured'} successfully`);
});

/**
 * @desc    Verify a recipe (mark as verified)
 * @route   PUT /api/recipes/:id/verify
 * @access  Private (Admin, Staff)
 */
exports.verifyRecipe = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Find the recipe
  const recipe = await Recipe.findOne({ _id: id, isDeleted: false });
  if (!recipe) {
    throw new ApiError('Recipe not found', 404);
  }
  
  // Toggle verified status
  recipe.isVerified = !recipe.isVerified;
  await recipe.save();
  
  return ApiResponse.success(res, { 
    recipe: {
      _id: recipe._id,
      title: recipe.title,
      isVerified: recipe.isVerified
    }
  }, `Recipe ${recipe.isVerified ? 'verified' : 'unverified'} successfully`);
});