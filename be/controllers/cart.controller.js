// controllers/cart.controller.js
const Cart = require('../models/Cart');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');
const FlashSaleItem = require('../models/FlashSaleItem');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middlewares/async.middleware');
const mongoose = require('mongoose');

/**
 * @desc    Get user's cart
 * @route   GET /api/cart
 * @access  Private
 */
exports.getCart = asyncHandler(async (req, res) => {
  let cart;
  
  // For authenticated users
  if (req.user) {
    cart = await Cart.findOne({ 
      userId: req.user._id,
      status: 'active'
    });
  } 
  // For guest users
  else if (req.body.sessionId) {
    cart = await Cart.findOne({
      sessionId: req.body.sessionId,
      status: 'active'
    });
  }
  
  // If no cart, create a new one
  if (!cart) {
    cart = await Cart.create({
      userId: req.user ? req.user._id : null,
      sessionId: !req.user ? (req.body.sessionId || generateSessionId()) : null,
      status: 'active'
    });
  }
  
  // Get cart items with product details
  await cart.populate([
    {
      path: 'items',
      populate: [
        {
          path: 'productId',
          select: 'name slug images basePrice stockQuantity isDeleted'
        },
        {
          path: 'variantId',
          select: 'name sku color size material priceAdjustment stockQuantity images'
        },
        {
          path: 'flashSaleItemId',
          populate: {
            path: 'flashSaleId',
            select: 'startDate endDate'
          }
        }
      ]
    }
  ]);
  
  // Check if products are still available and recalculate prices if needed
  let needsUpdate = false;
  
  for (const item of cart.items || []) {
    // Check if product exists and is not deleted
    if (!item.productId || item.productId.isDeleted) {
      needsUpdate = true;
      await CartItem.findByIdAndDelete(item._id);
      continue;
    }
    
    // Check variant if exists
    if (item.variantId && !item.variantId._id) {
      needsUpdate = true;
      await CartItem.findByIdAndDelete(item._id);
      continue;
    }
    
    // Check stock availability
    const stockQuantity = item.variantId 
      ? item.variantId.stockQuantity 
      : item.productId.stockQuantity;
    
    if (stockQuantity < item.quantity) {
      needsUpdate = true;
      // Update to available quantity
      await CartItem.findByIdAndUpdate(item._id, {
        quantity: Math.max(1, stockQuantity)
      });
    }
    
    // Check flash sale validity
    if (item.flashSaleItemId && item.flashSaleItemId.flashSaleId) {
      const now = new Date();
      const flashSale = item.flashSaleItemId.flashSaleId;
      
      if (now < flashSale.startDate || now > flashSale.endDate) {
        needsUpdate = true;
        await CartItem.findByIdAndUpdate(item._id, {
          flashSaleItemId: null
        });
      }
    }
  }
  
  // If cart needed updates, fetch it again with updates
  if (needsUpdate) {
    await cart.calculateTotals();
    
    await cart.populate([
      {
        path: 'items',
        populate: [
          {
            path: 'productId',
            select: 'name slug images basePrice stockQuantity'
          },
          {
            path: 'variantId',
            select: 'name sku color size material priceAdjustment stockQuantity images'
          },
          {
            path: 'flashSaleItemId',
            populate: {
              path: 'flashSaleId',
              select: 'startDate endDate'
            }
          }
        ]
      }
    ]);
  }
  
  return ApiResponse.success(res, { 
    cart,
    sessionId: !req.user ? cart.sessionId : undefined
  });
});

/**
 * @desc    Add item to cart
 * @route   POST /api/cart/items
 * @access  Private
 */
exports.addToCart = asyncHandler(async (req, res) => {
  const {
    productId,
    variantId,
    quantity = 1,
    flashSaleItemId,
    customizations,
    notes,
    sessionId
  } = req.body;
  
  // Validate required fields
  if (!productId) {
    throw new ApiError('Product ID is required', 400);
  }
  
  // Validate product exists
  const product = await Product.findOne({
    _id: productId,
    isDeleted: false
  });
  
  if (!product) {
    throw new ApiError('Product not found or no longer available', 404);
  }
  
  // Validate variant if provided
  let variant = null;
  if (variantId) {
    variant = await ProductVariant.findOne({
      _id: variantId,
      productId,
      isDeleted: false
    });
    
    if (!variant) {
      throw new ApiError('Product variant not found or no longer available', 404);
    }
  }
  
  // Check stock availability
  const stockQuantity = variant ? variant.stockQuantity : product.stockQuantity;
  if (stockQuantity < quantity) {
    throw new ApiError(`Only ${stockQuantity} units available`, 400);
  }
  
  // Check flash sale if provided
  let flashSale = null;
  if (flashSaleItemId) {
    const fsItem = await FlashSaleItem.findOne({
      _id: flashSaleItemId,
      productId,
      isActive: true
    }).populate({
      path: 'flashSaleId',
      match: { 
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
        status: 'active',
        isActive: true
      }
    });
    
    if (!fsItem || !fsItem.flashSaleId) {
      throw new ApiError('Flash sale not found or no longer active', 404);
    }
    
    if (fsItem.remainingQuantity < quantity) {
      throw new ApiError(`Flash sale only has ${fsItem.remainingQuantity} units left`, 400);
    }
    
    flashSale = fsItem;
  }
  
  // Find or create cart
  let cart;
  if (req.user) {
    cart = await Cart.findOne({ 
      userId: req.user._id,
      status: 'active'
    });
    
    if (!cart) {
      cart = await Cart.create({
        userId: req.user._id,
        status: 'active'
      });
    }
  } else if (sessionId) {
    cart = await Cart.findOne({
      sessionId,
      status: 'active'
    });
    
    if (!cart) {
      cart = await Cart.create({
        sessionId,
        status: 'active'
      });
    }
  } else {
    throw new ApiError('User authentication or session ID is required', 401);
  }
  
  // Calculate price
  let price = variant ? (product.basePrice + variant.priceAdjustment) : product.basePrice;
  
  // Apply flash sale price if available
  if (flashSale) {
    price = flashSale.discountedPrice;
  }
  
  // Check if product is already in cart
  // Chuẩn hóa customizations thành chữ ký "name:value|..." để so sánh dòng giỏ
  const parsedCustomizations = customizations
    ? (typeof customizations === 'string' ? JSON.parse(customizations) : customizations)
    : null;
  const customizationSig = (obj) =>
    obj && Object.keys(obj).length
      ? Object.keys(obj).sort().map(k => `${k}:${obj[k]?.value ?? obj[k]}`).join('|')
      : '';
  const incomingSig = customizationSig(parsedCustomizations);

  const candidateItems = await CartItem.find({
    cartId: cart._id,
    productId,
    variantId: variantId || null
  });
  const existingItem = candidateItems.find(it => customizationSig(it.customizations) === incomingSig);
  
  if (existingItem) {
    // Update existing item
    const updatedQuantity = existingItem.quantity + parseInt(quantity, 10);
    
    // Check stock again with updated quantity
    if (stockQuantity < updatedQuantity) {
      throw new ApiError(`Cannot add ${quantity} more units. Only ${stockQuantity - existingItem.quantity} additional units available.`, 400);
    }
    
    // Update flash sale item if provided
    if (flashSaleItemId && flashSaleItemId !== existingItem.flashSaleItemId?.toString()) {
      existingItem.flashSaleItemId = flashSaleItemId;
      existingItem.price = price;
    }
    
    existingItem.quantity = updatedQuantity;
    
    // Update customizations if provided
    if (customizations) {
      existingItem.customizations = {
        ...existingItem.customizations,
        ...JSON.parse(typeof customizations === 'string' ? customizations : JSON.stringify(customizations))
      };
    }
    
    // Update notes if provided
    if (notes) {
      existingItem.notes = notes;
    }
    
    await existingItem.save();
    
    // Recalculate cart totals
    await cart.calculateTotals();
    
    // Populate for response
    await existingItem.populate([
      {
        path: 'productId',
        select: 'name slug images'
      },
      {
        path: 'variantId',
        select: 'name sku color size images'
      }
    ]);
    
    return ApiResponse.success(res, { 
      cartItem: existingItem,
      cart: {
        _id: cart._id,
        subtotal: cart.subtotal,
        itemCount: await CartItem.countDocuments({ cartId: cart._id })
      }
    }, 'Item quantity updated in cart');
  } else {
    // Create new cart item
    const cartItem = await CartItem.create({
      cartId: cart._id,
      productId,
      variantId: variantId || null,
      quantity: parseInt(quantity, 10),
      price,
      flashSaleItemId: flashSaleItemId || null,
      customizations: customizations 
        ? (typeof customizations === 'string' 
            ? JSON.parse(customizations) 
            : customizations) 
        : {},
      notes: notes || ''
    });
    
    // Recalculate cart totals
    await cart.calculateTotals();
    
    // Populate for response
    await cartItem.populate([
      {
        path: 'productId',
        select: 'name slug images'
      },
      {
        path: 'variantId',
        select: 'name sku color size images'
      }
    ]);
    
    return ApiResponse.created(res, { 
      cartItem,
      cart: {
        _id: cart._id,
        subtotal: cart.subtotal,
        itemCount: await CartItem.countDocuments({ cartId: cart._id })
      },
      sessionId: !req.user ? cart.sessionId : undefined
    }, 'Item added to cart');
  }
});

/**
 * @desc    Update cart item
 * @route   PUT /api/cart/items/:id
 * @access  Private
 */
exports.updateCartItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    quantity,
    customizations,
    notes,
    sessionId
  } = req.body;
  
  // Find the cart item
  const cartItem = await CartItem.findById(id);
  if (!cartItem) {
    throw new ApiError('Cart item not found', 404);
  }
  
  // Check if cart belongs to the user
  const cart = await Cart.findById(cartItem.cartId);
  if (!cart) {
    throw new ApiError('Cart not found', 404);
  }
  
  // Verify authorization
  if (
    (req.user && cart.userId && cart.userId.toString() !== req.user._id.toString()) ||
    (!req.user && cart.sessionId !== sessionId)
  ) {
    throw new ApiError('Not authorized to update this cart', 403);
  }
  
  // Check product and variant
  const product = await Product.findOne({
    _id: cartItem.productId,
    isDeleted: false
  });
  
  if (!product) {
    throw new ApiError('Product is no longer available', 404);
  }
  
  let variant = null;
  if (cartItem.variantId) {
    variant = await ProductVariant.findOne({
      _id: cartItem.variantId,
      isDeleted: false
    });
    
    if (!variant) {
      throw new ApiError('Product variant is no longer available', 404);
    }
  }
  
  // Update fields
  if (quantity !== undefined) {
    const newQuantity = parseInt(quantity, 10);
    
    // Validate quantity
    if (newQuantity < 1) {
      throw new ApiError('Quantity must be at least 1', 400);
    }
    
    // Check stock
    const stockQuantity = variant ? variant.stockQuantity : product.stockQuantity;
    if (stockQuantity < newQuantity) {
      throw new ApiError(`Only ${stockQuantity} units available`, 400);
    }
    
    cartItem.quantity = newQuantity;
  }
  
  // Update customizations if provided
  if (customizations) {
    cartItem.customizations = typeof customizations === 'string' 
      ? JSON.parse(customizations) 
      : customizations;
  }
  
  // Update notes if provided
  if (notes !== undefined) {
    cartItem.notes = notes;
  }
  
  // Save changes
  await cartItem.save();
  
  // Recalculate cart totals
  await cart.calculateTotals();
  
  // Populate for response
  await cartItem.populate([
    {
      path: 'productId',
      select: 'name slug images basePrice'
    },
    {
      path: 'variantId',
      select: 'name sku color size material priceAdjustment'
    }
  ]);
  
  return ApiResponse.success(res, { 
    cartItem,
    cart: {
      _id: cart._id,
      subtotal: cart.subtotal,
      itemCount: await CartItem.countDocuments({ cartId: cart._id })
    }
  }, 'Cart item updated');
});

/**
 * @desc    Remove item from cart
 * @route   DELETE /api/cart/items/:id
 * @access  Private
 */
exports.removeCartItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sessionId } = req.query;
  
  // Find the cart item
  const cartItem = await CartItem.findById(id);
  if (!cartItem) {
    throw new ApiError('Cart item not found', 404);
  }
  
  // Check if cart belongs to the user
  const cart = await Cart.findById(cartItem.cartId);
  if (!cart) {
    throw new ApiError('Cart not found', 404);
  }
  
  // Verify authorization
  if (
    (req.user && cart.userId && cart.userId.toString() !== req.user._id.toString()) ||
    (!req.user && cart.sessionId !== sessionId)
  ) {
    throw new ApiError('Not authorized to modify this cart', 403);
  }
  
  // Delete the item
  await CartItem.findByIdAndDelete(id);
  
  // Recalculate cart totals
  await cart.calculateTotals();
  
  return ApiResponse.success(res, { 
    cart: {
      _id: cart._id,
      subtotal: cart.subtotal,
      itemCount: await CartItem.countDocuments({ cartId: cart._id })
    }
  }, 'Item removed from cart');
});

/**
 * @desc    Clear cart
 * @route   DELETE /api/cart
 * @access  Private
 */
exports.clearCart = asyncHandler(async (req, res) => {
  const { sessionId } = req.query;
  
  let cart;
  
  // For authenticated users
  if (req.user) {
    cart = await Cart.findOne({ 
      userId: req.user._id,
      status: 'active'
    });
  } 
  // For guest users
  else if (sessionId) {
    cart = await Cart.findOne({
      sessionId,
      status: 'active'
    });
  }
  
  if (!cart) {
    throw new ApiError('Cart not found', 404);
  }
  
  // Delete all cart items
  await CartItem.deleteMany({ cartId: cart._id });
  
  // Reset cart totals
  cart.subtotal = 0;
  await cart.save();
  
  return ApiResponse.success(res, null, 'Cart cleared successfully');
});

/**
 * @desc    Merge guest cart with user cart after login
 * @route   POST /api/cart/merge
 * @access  Private
 */
exports.mergeCart = asyncHandler(async (req, res) => {
  // FE gửi giỏ khách vãng lai (localStorage) dạng { items: [{ productId, variantId, quantity }] }
  const { items = [] } = req.body;

  // Tìm hoặc tạo giỏ active của user
  let userCart = await Cart.findOne({ userId: req.user._id, status: 'active' });
  if (!userCart) {
    userCart = await Cart.create({ userId: req.user._id, status: 'active' });
  }

  // Gộp từng item vào giỏ user
  const sig = (obj) =>
    obj && Object.keys(obj).length
      ? Object.keys(obj).sort().map(k => `${k}:${obj[k]?.value ?? obj[k]}`).join('|')
      : '';

  for (const raw of Array.isArray(items) ? items : []) {
    const productId = raw.productId;
    const variantId = raw.variantId || null;
    const quantity = parseInt(raw.quantity, 10) || 1;
    const customizations = raw.customizations || null;

    if (!productId) continue;

    // Bỏ qua sản phẩm không còn tồn tại (giỏ localStorage có thể đã cũ)
    const product = await Product.findOne({ _id: productId, isDeleted: false });
    if (!product) continue;

    let variant = null;
    if (variantId) {
      variant = await ProductVariant.findOne({ _id: variantId, productId, isDeleted: false });
      if (!variant) continue;
    }

    // Nếu sản phẩm+variant+customization đã có trong giỏ user thì cộng dồn số lượng
    const incomingSig = sig(customizations);
    const candidates = await CartItem.find({ cartId: userCart._id, productId, variantId });
    const existingItem = candidates.find(it => sig(it.customizations) === incomingSig);
    if (existingItem) {
      existingItem.quantity += quantity;
      await existingItem.save();
    } else {
      // price/customizations được pre-save hook của CartItem xác thực & tính lại từ DB
      await CartItem.create({
        cartId: userCart._id,
        productId,
        variantId,
        quantity,
        customizations: customizations || {},
      });
    }
  }

  // Tính lại tổng tiền giỏ
  await userCart.calculateTotals();

  // Populate chi tiết cho response
  await userCart.populate([
    {
      path: 'items',
      populate: [
        {
          path: 'productId',
          select: 'name slug images basePrice'
        },
        {
          path: 'variantId',
          select: 'name sku color size material priceAdjustment'
        }
      ]
    }
  ]);

  return ApiResponse.success(res, { cart: userCart }, 'Carts merged successfully');
});

/**
 * @desc    Get cart summary (for checkout)
 * @route   GET /api/cart/summary
 * @access  Private
 */
exports.getCartSummary = asyncHandler(async (req, res) => {
  const { sessionId } = req.query;
  
  let cart;
  
  // For authenticated users
  if (req.user) {
    cart = await Cart.findOne({ 
      userId: req.user._id,
      status: 'active'
    });
  } 
  // For guest users
  else if (sessionId) {
    cart = await Cart.findOne({
      sessionId,
      status: 'active'
    });
  }
  
  if (!cart) {
    throw new ApiError('Cart not found', 404);
  }
  
  // Get cart items with product details
  await cart.populate([
    {
      path: 'items',
      populate: [
        {
          path: 'productId',
          select: 'name slug images basePrice stockQuantity'
        },
        {
          path: 'variantId',
          select: 'name sku color size material priceAdjustment stockQuantity'
        },
        {
          path: 'flashSaleItemId',
          populate: 'flashSaleId'
        }
      ]
    }
  ]);
  
  // Verify all items are still available
  const unavailableItems = [];
  const availableItems = [];
  
  for (const item of cart.items || []) {
    // Check if product exists and not deleted
    if (!item.productId || item.productId.isDeleted) {
      unavailableItems.push({
        _id: item._id,
        message: 'Product is no longer available'
      });
      continue;
    }
    
    // Check variant if exists
    if (item.variantId && !item.variantId._id) {
      unavailableItems.push({
        _id: item._id,
        message: 'Product variant is no longer available'
      });
      continue;
    }
    
    // Check stock availability
    const stockQuantity = item.variantId 
      ? item.variantId.stockQuantity 
      : item.productId.stockQuantity;
    
    if (stockQuantity < item.quantity) {
      unavailableItems.push({
        _id: item._id,
        product: {
          _id: item.productId._id,
          name: item.productId.name
        },
        variant: item.variantId ? {
          _id: item.variantId._id,
          name: item.variantId.name
        } : null,
        requestedQuantity: item.quantity,
        availableQuantity: stockQuantity,
        message: `Only ${stockQuantity} units available`
      });
      continue;
    }
    
    // Check flash sale validity
    if (item.flashSaleItemId && item.flashSaleItemId.flashSaleId) {
      const now = new Date();
      const flashSale = item.flashSaleItemId.flashSaleId;
      
      if (now < flashSale.startDate || now > flashSale.endDate) {
        unavailableItems.push({
          _id: item._id,
          message: 'Flash sale has ended or not started yet'
        });
        continue;
      }
      
      // Check flash sale quantity
      if (item.flashSaleItemId.remainingQuantity < item.quantity) {
        unavailableItems.push({
          _id: item._id,
          message: `Flash sale only has ${item.flashSaleItemId.remainingQuantity} units left`
        });
        continue;
      }
    }
    
    // Item is available
    availableItems.push(item);
  }
  
  // Calculate summary
  const summary = {
    subtotal: cart.subtotal,
    itemCount: availableItems.length,
    totalQuantity: availableItems.reduce((sum, item) => sum + item.quantity, 0),
    estimatedTax: 0, // To be calculated based on location
    estimatedShipping: 0, // To be calculated based on location and delivery options
    total: cart.subtotal,
    unavailableItems
  };
  
  return ApiResponse.success(res, { 
    cart: {
      _id: cart._id,
      items: availableItems,
      subtotal: cart.subtotal
    },
    summary
  });
});

/**
 * Helper function to generate a session ID
 */
const generateSessionId = () => {
  return `cart_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};