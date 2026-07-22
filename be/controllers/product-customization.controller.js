// controllers/product-customization.controller.js
const Product = require('../models/Product');
const ProductCustomization = require('../models/ProductCustomization');
const imageService = require('../utils/imageService');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middlewares/async.middleware');

/**
 * @desc    Get all customizations for a product
 * @route   GET /api/products/:productId/customizations
 * @access  Public
 */
exports.getProductCustomizations = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  // Validate product exists
  const product = await Product.findById(productId);
  if (!product || product.isDeleted) {
    throw new ApiError('Product not found', 404);
  }

  // Get all customizations for this product
  const customizations = await ProductCustomization.find({
    productId,
    isDeleted: false,
    isActive: true
  }).sort('displayOrder name');

  return ApiResponse.success(res, { customizations });
});

/**
 * @desc    Get a specific customization
 * @route   GET /api/products/:productId/customizations/:id
 * @access  Public
 */
exports.getProductCustomization = asyncHandler(async (req, res) => {
  const { productId, id } = req.params;

  // Find the customization
  const customization = await ProductCustomization.findOne({
    _id: id,
    productId,
    isDeleted: false
  });

  if (!customization) {
    throw new ApiError('Product customization not found', 404);
  }

  return ApiResponse.success(res, { customization });
});

/**
 * @desc    Create a new product customization
 * @route   POST /api/products/:productId/customizations
 * @access  Private (Admin, Staff)
 */
exports.createProductCustomization = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const {
    name,
    customizationType,
    description,
    options,
    isRequired,
    displayOrder,
    ...otherFields
  } = req.body;

  // Validate required fields
  if (!name || !customizationType) {
    throw new ApiError('Please provide name and customization type', 400);
  }

  // Validate product exists
  const product = await Product.findById(productId);
  if (!product || product.isDeleted) {
    throw new ApiError('Product not found', 404);
  }

  // Process options - accept both JSON string or object
  let processedOptions = [];

  if (options) {
    try {
      if (typeof options === 'string') {
        processedOptions = JSON.parse(options);
      } else if (Array.isArray(options)) {
        processedOptions = options;
      } else if (typeof options === 'object') {
        // If it's a single option object, wrap it in an array
        processedOptions = [options];
      }
    } catch (error) {
      throw new ApiError(`Invalid options format: ${error.message}`, 400);
    }
  }

  // Validate each option has required fields
  if (processedOptions.length === 0) {
    throw new ApiError('At least one option is required', 400);
  }

  // Ensure each option has name and value
  processedOptions = processedOptions.map(option => {
    if (!option.name || !option.value) {
      throw new ApiError('Each option must have name and value', 400);
    }

    return {
      name: option.name,
      value: option.value,
      priceAdjustment: option.priceAdjustment ? Number(option.priceAdjustment) : 0,
      image: option.image || null,
      isDefault: option.isDefault === true || option.isDefault === 'true'
    };
  });

  // Create customization object
  const customizationData = {
    productId,
    name,
    customizationType,
    description: description || '',
    options: processedOptions,
    isRequired: isRequired === 'true' || isRequired === true,
    displayOrder: displayOrder ? Number(displayOrder) : 0,
    ...otherFields
  };

  // Handle option images if provided
  if (req.files && req.files.length > 0) {
    const optionImages = {};

    // If option indices are provided in the request
    const optionIndices = req.body.optionIndices
      ? (Array.isArray(req.body.optionIndices)
        ? req.body.optionIndices
        : [req.body.optionIndices])
      : [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      let optionIndex = i;

      // If specific option index is provided for this file
      if (optionIndices[i]) {
        optionIndex = parseInt(optionIndices[i]);
      }

      // Upload the image
      try {
        const result = await imageService.uploadImage(file, 'customizations');
        optionImages[optionIndex] = {
          url: result.url,
          path: result.path
        };
      } catch (error) {
        throw new ApiError(`Image upload failed: ${error.message}`, 500);
      }
    }

    // Update options with images
    customizationData.options = customizationData.options.map((option, index) => {
      if (optionImages[index]) {
        option.image = optionImages[index].url;
        option.imagePath = optionImages[index].path;
      }
      return option;
    });
  }

  // Create the customization
  const customization = await ProductCustomization.create(customizationData);

  // Update product to indicate it has customizations
  if (!product.isCustomizable) {
    product.isCustomizable = true;
    await product.save();
  }

  return ApiResponse.created(res, { customization });
});

/**
 * @desc    Update a product customization
 * @route   PUT /api/products/:productId/customizations/:id
 * @access  Private (Admin, Staff)
 */
exports.updateProductCustomization = asyncHandler(async (req, res) => {
  const { productId, id } = req.params;
  const {
    name,
    customizationType,
    description,
    options,
    isRequired,
    displayOrder,
    isActive,
    removeOptionImages,
    ...otherFields
  } = req.body;

  // Find the customization
  const customization = await ProductCustomization.findOne({
    _id: id,
    productId,
    isDeleted: false
  });

  if (!customization) {
    throw new ApiError('Product customization not found', 404);
  }

  // Create update object
  const updateData = {
    ...(name && { name }),
    ...(customizationType && { customizationType }),
    ...(description !== undefined && { description }),
    ...(isRequired !== undefined && {
      isRequired: isRequired === 'true' || isRequired === true
    }),
    ...(displayOrder !== undefined && {
      displayOrder: Number(displayOrder)
    }),
    ...(isActive !== undefined && {
      isActive: isActive === 'true' || isActive === true
    }),
    ...otherFields
  };

  // Process options if provided
  if (options) {
    let processedOptions = [];

    try {
      if (typeof options === 'string') {
        processedOptions = JSON.parse(options);
      } else if (Array.isArray(options)) {
        processedOptions = options;
      } else if (typeof options === 'object') {
        processedOptions = [options];
      }
    } catch (error) {
      throw new ApiError(`Invalid options format: ${error.message}`, 400);
    }

    // Validate and process each option
    if (processedOptions.length > 0) {
      processedOptions = processedOptions.map(option => {
        if (!option.name || !option.value) {
          throw new ApiError('Each option must have name and value', 400);
        }

        return {
          name: option.name,
          value: option.value,
          priceAdjustment: option.priceAdjustment ? Number(option.priceAdjustment) : 0,
          image: option.image || null,
          isDefault: option.isDefault === true || option.isDefault === 'true'
        };
      });

      updateData.options = processedOptions;
    }
  }

  // Handle option image removal if specified
  if (removeOptionImages) {
    const imagesToRemove = Array.isArray(removeOptionImages)
      ? removeOptionImages
      : [removeOptionImages];

    // Delete images from storage
    for (const option of customization.options) {
      if (option.image && imagesToRemove.includes(option.image)) {
        try {
          await imageService.deleteImage(option.imagePath || option.image);
        } catch (error) {
          console.error(`Failed to delete image ${option.image}: ${error.message}`);
        }
      }
    }

    // Update the options array by removing the specified images
    if (!updateData.options) {
      // If options were not provided in this update, use existing ones
      updateData.options = customization.options.map(option => {
        if (option.image && imagesToRemove.includes(option.image)) {
          return { ...option, image: null, imagePath: null };
        }
        return option;
      });
    } else {
      // If options were provided, remove images from them
      updateData.options = updateData.options.map(option => {
        if (option.image && imagesToRemove.includes(option.image)) {
          return { ...option, image: null, imagePath: null };
        }
        return option;
      });
    }
  }

  // Handle new option images
  if (req.files && req.files.length > 0) {
    // Get current options for update
    const currentOptions = updateData.options || customization.options;

    // Process option indices if provided
    const optionIndices = req.body.optionIndices
      ? (Array.isArray(req.body.optionIndices)
        ? req.body.optionIndices.map(i => parseInt(i))
        : [parseInt(req.body.optionIndices)])
      : [];

    // Upload each image
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const optionIndex = optionIndices[i] !== undefined ? optionIndices[i] : i;

      // Check if the option index is valid
      if (optionIndex >= currentOptions.length) {
        throw new ApiError(`Invalid option index: ${optionIndex}`, 400);
      }

      // Upload the image
      try {
        const result = await imageService.uploadImage(file, 'customizations');

        // Update the option with the new image
        currentOptions[optionIndex].image = result.url;
        currentOptions[optionIndex].imagePath = result.path;
      } catch (error) {
        throw new ApiError(`Image upload failed: ${error.message}`, 500);
      }
    }

    // Update the options in the update data
    updateData.options = currentOptions;
  }

  // Update the customization
  const updatedCustomization = await ProductCustomization.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  );

  return ApiResponse.success(res, { customization: updatedCustomization });
});

/**
 * @desc    Delete a product customization (soft delete)
 * @route   DELETE /api/products/:productId/customizations/:id
 * @access  Private (Admin)
 */
exports.deleteProductCustomization = asyncHandler(async (req, res) => {
  const { productId, id } = req.params;

  // Find the customization
  const customization = await ProductCustomization.findOne({
    _id: id,
    productId
  });

  if (!customization) {
    throw new ApiError('Product customization not found', 404);
  }

  // Soft delete
  customization.isDeleted = true;
  await customization.save();

  // Check if product still has active customizations
  const remainingCustomizations = await ProductCustomization.countDocuments({
    productId,
    isDeleted: false,
    isActive: true
  });

  if (remainingCustomizations === 0) {
    // Update product to indicate it no longer has customizations
    await Product.findByIdAndUpdate(productId, { isCustomizable: false });
  }

  return ApiResponse.success(res, null, 'Product customization deleted successfully');
});