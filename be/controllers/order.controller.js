// controllers/order.controller.js
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Cart = require('../models/Cart');
const CartItem = require('../models/CartItem');
const Payment = require('../models/Payment');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middlewares/async.middleware');
const mongoose = require('mongoose');
const inventoryService = require('../services/inventory.service');
const voucherService = require('../services/voucher.service');
const pricingService = require('../services/pricing.service');
const idempotencyService = require('../services/idempotency.service');
const orderCancellationService = require('../services/order-cancellation.service');

/**
 * @desc    Create a new order
 * @route   POST /api/orders
 * @access  Private
 */
exports.createOrder = asyncHandler(async (req, res) => {
  const {
    shippingAddress,
    billingAddress,
    paymentMethod,
    cartId,
    voucherId,
    voucherCode,
    notes,
    shippingMethod = 'standard'
  } = req.body;

  if (!shippingAddress || !paymentMethod) {
    throw new ApiError('Shipping address and payment method are required', 400);
  }

  if (
    !shippingAddress.fullName ||
    !shippingAddress.phone ||
    !shippingAddress.address ||
    !shippingAddress.city
  ) {
    throw new ApiError('Incomplete shipping address', 400);
  }

  if (!['standard', 'express'].includes(shippingMethod)) {
    throw new ApiError('Invalid shipping method', 400);
  }

  const idempotency = await idempotencyService.begin({
    scope: 'create-order',
    key: req.get('Idempotency-Key') || req.body.idempotencyKey,
    ownerId: req.user._id,
    payload: req.body
  });
  if (idempotency.replay) {
    return res.status(idempotency.statusCode).json(idempotency.responseBody);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  let transactionCommitted = false;

  try {
    const cart = cartId
      ? await Cart.findById(cartId).session(session)
      : await Cart.findOne({ userId: req.user._id, status: 'active' }).session(session);

    if (!cart || cart.userId.toString() !== req.user._id.toString()) {
      throw new ApiError('Cart not found or does not belong to you', 404);
    }

    const cartItems = await CartItem.find({ cartId: cart._id })
      .session(session)
      .populate('productId')
      .populate('variantId')
      .populate({
        path: 'flashSaleItemId',
        populate: 'flashSaleId'
      });

    if (cartItems.length === 0) {
      throw new ApiError('Cart is empty', 400);
    }

    for (const item of cartItems) {
      if (!item.productId || item.productId.isDeleted) {
        throw new ApiError(
          `Product ${item.productId ? item.productId.name : 'unknown'} is no longer available`,
          409
        );
      }

      const stockQuantity = item.variantId
        ? item.variantId.stockQuantity
        : item.productId.stockQuantity;
      if (stockQuantity < item.quantity) {
        throw new ApiError(
          `Only ${stockQuantity} units of ${item.productId.name} available`,
          409
        );
      }

      if (item.flashSaleItemId) {
        const now = new Date();
        const flashSale = item.flashSaleItemId.flashSaleId;
        if (
          !flashSale ||
          flashSale.status !== 'active' ||
          flashSale.isActive === false ||
          now < flashSale.startDate ||
          now > flashSale.endDate ||
          item.flashSaleItemId.remainingQuantity < item.quantity
        ) {
          throw new ApiError('A flash sale item is no longer available.', 409);
        }
      }
    }

    const pricedCart = pricingService.priceCartItems(cartItems);
    const voucherItems = pricedCart.lines.map(({ item, lineTotal }) => ({
      ...(typeof item.toObject === 'function' ? item.toObject() : item),
      lineTotal
    }));
    const subtotal = pricedCart.subtotal;
    let shippingCost = shippingMethod === 'express' ? 50000 : 30000;
    const tax = 0;
    if (subtotal >= 500000) shippingCost = 0;

    const voucherValidation = await voucherService.validateVoucher({
      voucherId,
      code: voucherCode,
      userId: req.user._id,
      cartTotal: subtotal,
      cartItems: voucherItems,
      session
    });
    const discount = voucherValidation?.discountAmount || 0;

    const [createdOrder] = await Order.create([{
      userId: req.user._id,
      status: 'pending',
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      paymentMethod,
      subtotal,
      shippingCost,
      tax,
      discount,
      totalAmount: subtotal + shippingCost + tax - discount,
      isPaid: false,
      voucherId: voucherValidation?.voucher._id || null,
      notes: notes || '',
      shippingMethod
    }], { session });

    for (let index = 0; index < cartItems.length; index += 1) {
      const item = cartItems[index];
      const line = pricedCart.lines[index];

      await inventoryService.reserveProductStock({
        productId: item.productId._id,
        variantId: item.variantId ? item.variantId._id : null,
        quantity: item.quantity,
        session
      });

      if (item.flashSaleItemId) {
        await inventoryService.reserveFlashSaleStock({
          flashSaleItemId: item.flashSaleItemId._id,
          quantity: item.quantity,
          session
        });
      }

      await OrderItem.create([{
        orderId: createdOrder._id,
        productId: item.productId._id,
        variantId: item.variantId ? item.variantId._id : null,
        quantity: item.quantity,
        price: line.unitPrice,
        discount: 0,
        flashSaleItemId: item.flashSaleItemId ? item.flashSaleItemId._id : null,
        customizations: item.customizations || {},
        notes: item.notes || ''
      }], { session });

      await CartItem.findByIdAndDelete(item._id, { session });
    }

    await createdOrder.calculateTotals(session);

    if (voucherValidation) {
      await voucherService.consumeVoucher({
        voucher: voucherValidation.voucher,
        userId: req.user._id,
        orderId: createdOrder._id,
        session
      });
    }

    let payment = null;
    if (paymentMethod !== 'cod') {
      [payment] = await Payment.create([{
        orderId: createdOrder._id,
        userId: req.user._id,
        paymentMethod,
        amount: createdOrder.totalAmount,
        status: 'pending',
        returnUrl: `${process.env.FRONTEND_URL}/checkout/complete?orderId=${createdOrder._id}`,
        notifyUrl: `${process.env.API_URL}/api/payments/webhook`
      }], { session });
    }

    cart.status = 'converted';
    await cart.save({ session });
    await session.commitTransaction();
    transactionCommitted = true;

    try {
      await createdOrder.populate([
      {
        path: 'orderItems',
        options: { sort: { createdAt: 1 } },
        populate: [
          { path: 'productId', select: 'name slug images' },
          { path: 'variantId', select: 'name sku color size material' }
        ]
      }
    ]);
    } catch (populateError) {
      console.error('Order created but response population failed:', populateError);
    }

    const responseBody = {
      success: true,
      message: 'Order created successfully',
      data: { order: createdOrder, payment }
    };
    try {
      await idempotencyService.complete({
        record: idempotency.record,
        statusCode: 201,
        responseBody
      });
    } catch (idempotencyError) {
      console.error('Order created but idempotency response could not be stored:', idempotencyError);
    }
    return res.status(201).json(responseBody);
  } catch (error) {
    if (!transactionCommitted) {
      await session.abortTransaction();
      await idempotencyService.abandon(idempotency.record);
    }
    throw error;
  } finally {
    await session.endSession();
  }
});
/**
 * @desc    Get all user orders
 * @route   GET /api/orders
 * @access  Private
 */
exports.getUserOrders = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    status,
    sort = '-createdAt'
  } = req.query;
  
  // Build query
  const query = { 
    userId: req.user._id
  };
  
  if (status) {
    query.status = status;
  }
  
  // Count total orders matching query
  const total = await Order.countDocuments(query);
  
  // Pagination options
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const totalPages = Math.ceil(total / parseInt(limit));
  
  // Get orders
  const orders = await Order.find(query)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .populate({
      path: 'orderItems',
      options: { sort: { createdAt: 1 } },
      populate: [
        {
          path: 'productId',
          select: 'name slug images'
        },
        {
          path: 'variantId',
          select: 'name sku color size material'
        }
      ]
    });
  
  return ApiResponse.success(res, {
    orders,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalItems: total,
      limit: parseInt(limit)
    }
  });
});

/**
 * @desc    Get order by ID
 * @route   GET /api/orders/:id
 * @access  Private
 */
exports.getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Find order
  const order = await Order.findById(id);
  
  if (!order) {
    throw new ApiError('Order not found', 404);
  }
  
  // Check if order belongs to user (unless admin)
  if (
    order.userId.toString() !== req.user._id.toString() && 
    req.user.role !== 'admin' &&
    req.user.role !== 'staff'
  ) {
    throw new ApiError('Not authorized to access this order', 403);
  }
  
  // Populate order details
  await order.populate([
    {
      path: 'orderItems',
      options: { sort: { createdAt: 1 } },
      populate: [
        {
          path: 'productId',
          select: 'name slug images'
        },
        {
          path: 'variantId',
          select: 'name sku color size material'
        }
      ]
    },
    {
      path: 'payments'
    }
  ]);
  
  return ApiResponse.success(res, { order });
});

/**
 * @desc    Update order status
 * @route   PUT /api/orders/:id/status
 * @access  Private (Admin/Staff)
 */
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, trackingNumber, notes } = req.body;
  
  // Validate status
  if (!status) {
    throw new ApiError('Status is required', 400);
  }
  
  // Check if status is valid
  const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
  if (!validStatuses.includes(status)) {
    throw new ApiError('Invalid status', 400);
  }
  
  // Find order
  const order = await Order.findById(id);
  
  if (!order) {
    throw new ApiError('Order not found', 404);
  }
  
  // Create update object
  const updateData = { status };
  
  // Add tracking number if provided
  if (trackingNumber) {
    updateData.trackingNumber = trackingNumber;
  }
  
  // Add notes if provided
  if (notes) {
    updateData.notes = notes;
  }
  
  // Special handling for cancelled status
  if (status === 'cancelled' && order.status !== 'cancelled') {
    if (['shipped', 'delivered'].includes(order.status)) {
      throw new ApiError(`Cannot cancel an order that is already ${order.status}`, 400);
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const updatedOrder = await orderCancellationService.cancelOrder({
        orderId: id,
        reason: req.body.cancelReason || 'Cancelled by staff',
        session
      });
      await session.commitTransaction();

      await updatedOrder.populate([
        {
          path: 'orderItems',
          options: { sort: { createdAt: 1 } },
          populate: [
            { path: 'productId', select: 'name slug images' },
            { path: 'variantId', select: 'name sku color size material' }
          ]
        }
      ]);

      return ApiResponse.success(
        res,
        { order: updatedOrder },
        'Order status updated successfully'
      );
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }  // Handle other status updates
  else {
    // Update order
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    // Populate for response
    await updatedOrder.populate([
      {
        path: 'orderItems',
        options: { sort: { createdAt: 1 } },
        populate: [
          {
            path: 'productId',
            select: 'name slug images'
          },
          {
            path: 'variantId',
            select: 'name sku color size material'
          }
        ]
      }
    ]);
    
    return ApiResponse.success(res, { order: updatedOrder }, 'Order status updated successfully');
  }
});

/**
 * @desc    Cancel order (by customer)
 * @route   PUT /api/orders/:id/cancel
 * @access  Private
 */
exports.cancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const order = await Order.findById(id);
  if (!order) {
    throw new ApiError('Order not found', 404);
  }

  if (order.userId.toString() !== req.user._id.toString()) {
    throw new ApiError('Not authorized to cancel this order', 403);
  }

  if (['shipped', 'delivered', 'cancelled', 'refunded'].includes(order.status)) {
    throw new ApiError(`Cannot cancel an order that is already ${order.status}`, 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const updatedOrder = await orderCancellationService.cancelOrder({
      orderId: id,
      reason: reason || 'Cancelled by customer',
      session
    });
    await session.commitTransaction();

    await updatedOrder.populate([
      {
        path: 'orderItems',
        options: { sort: { createdAt: 1 } },
        populate: [
          { path: 'productId', select: 'name slug images' },
          { path: 'variantId', select: 'name sku color size material' }
        ]
      }
    ]);

    return ApiResponse.success(res, { order: updatedOrder }, 'Order cancelled successfully');
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
});
/**
 * @desc    Get order tracking info
 * @route   GET /api/orders/:id/tracking
 * @access  Private
 */
exports.getOrderTracking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Find order
  const order = await Order.findById(id);
  
  if (!order) {
    throw new ApiError('Order not found', 404);
  }
  
  // Check if order belongs to user (unless admin)
  if (
    order.userId.toString() !== req.user._id.toString() && 
    req.user.role !== 'admin' &&
    req.user.role !== 'staff'
  ) {
    throw new ApiError('Not authorized to access this order', 403);
  }
  
  // Get tracking info
  const trackingInfo = {
    orderNumber: order.orderNumber,
    status: order.status,
    trackingNumber: order.trackingNumber,
    shippingMethod: order.shippingMethod,
    timeline: [
      {
        status: 'pending',
        date: order.createdAt,
        description: 'Order placed'
      }
    ]
  };
  
  // Add processing status if applicable
  if (['processing', 'shipped', 'delivered'].includes(order.status)) {
    trackingInfo.timeline.push({
      status: 'processing',
      date: order.updatedAt,
      description: 'Order processing'
    });
  }
  
  // Add shipped status if applicable
  if (['shipped', 'delivered'].includes(order.status)) {
    trackingInfo.timeline.push({
      status: 'shipped',
      date: order.shippedAt,
      description: 'Order shipped'
    });
  }
  
  // Add delivered status if applicable
  if (order.status === 'delivered') {
    trackingInfo.timeline.push({
      status: 'delivered',
      date: order.deliveredAt,
      description: 'Order delivered'
    });
  }
  
  // Add cancelled status if applicable
  if (order.status === 'cancelled') {
    trackingInfo.timeline.push({
      status: 'cancelled',
      date: order.cancelledAt,
      description: `Order cancelled${order.cancelReason ? `: ${order.cancelReason}` : ''}`
    });
  }
  
  return ApiResponse.success(res, { tracking: trackingInfo });
});

/**
 * @desc    Request refund for order item
 * @route   POST /api/orders/:orderId/items/:itemId/refund
 * @access  Private
 */
exports.requestItemRefund = asyncHandler(async (req, res) => {
  const { orderId, itemId } = req.params;
  const { reason, amount } = req.body;
  
  // Validate required fields
  if (!reason) {
    throw new ApiError('Refund reason is required', 400);
  }
  
  // Find order
  const order = await Order.findById(orderId);
  
  if (!order) {
    throw new ApiError('Order not found', 404);
  }
  
  // Check if order belongs to user
  if (order.userId.toString() !== req.user._id.toString()) {
    throw new ApiError('Not authorized to request refund for this order', 403);
  }
  
  // Check if order is eligible for refund
  if (!['delivered', 'shipped'].includes(order.status)) {
    throw new ApiError(`Cannot request refund for an order with status: ${order.status}`, 400);
  }
  
  // Find order item
  const orderItem = await OrderItem.findOne({
    _id: itemId,
    orderId
  });
  
  if (!orderItem) {
    throw new ApiError('Order item not found', 404);
  }
  
  // Check if item is already refunded or has a pending refund
  if (orderItem.refundStatus !== 'none') {
    throw new ApiError(`Item already has a refund ${orderItem.refundStatus}`, 400);
  }
  
  // Request refund
  await orderItem.requestRefund(reason, amount);
  
  return ApiResponse.success(res, { orderItem }, 'Refund requested successfully');
});

/**
 * @desc    Process refund request (admin/staff)
 * @route   PUT /api/orders/:orderId/items/:itemId/refund
 * @access  Private (Admin/Staff)
 */
exports.processRefundRequest = asyncHandler(async (req, res) => {
  const { orderId, itemId } = req.params;
  const { status, amount } = req.body;
  
  // Validate required fields
  if (!status) {
    throw new ApiError('Refund status is required', 400);
  }
  
  // Check if status is valid
  const validStatuses = ['approved', 'rejected', 'completed'];
  if (!validStatuses.includes(status)) {
    throw new ApiError('Invalid refund status', 400);
  }
  
  // Find order item
  const orderItem = await OrderItem.findOne({
    _id: itemId,
    orderId
  });
  
  if (!orderItem) {
    throw new ApiError('Order item not found', 404);
  }
  
  // Check if item has a pending refund
  if (orderItem.refundStatus !== 'requested') {
    throw new ApiError('No refund request to process', 400);
  }
  
  // Process refund
  await orderItem.processRefund(status, amount);
  
  // If refund is approved or completed, process payment refund
  if (status === 'approved' || status === 'completed') {
    const order = await Order.findById(orderId);
    const payment = await Payment.findOne({ orderId });
    
    if (payment && payment.status === 'completed') {
      try {
        await payment.refund(
          orderItem.refundAmount,
          `Refund for item: ${orderItem.productSnapshot.name}`
        );
      } catch (error) {
        console.error('Payment refund failed:', error);
        // Continue anyway, admin can handle payment refund manually
      }
    }
    
    // Check if all items are refunded and update order status if needed
    const allItemsRefunded = await OrderItem.countDocuments({
      orderId,
      refundStatus: { $nin: ['approved', 'completed'] }
    }) === 0;
    
    if (allItemsRefunded) {
      order.status = 'refunded';
      await order.save();
    }
  }
  
  return ApiResponse.success(res, { orderItem }, 'Refund processed successfully');
});

/**
 * @desc    Get order statistics (admin/staff)
 * @route   GET /api/orders/stats
 * @access  Private (Admin/Staff)
 */
exports.getOrderStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  // Get overall stats
  const overallStats = await Order.getSalesStats(startDate, endDate);
  
  // Get stats by date
  const dailyStats = await Order.getSalesByDate(startDate, endDate, 'day');
  
  // Get stats by status
  const statusStats = await Order.aggregate([
    {
      $match: {
        ...(startDate && { createdAt: { $gte: new Date(startDate) } }),
        ...(endDate && { createdAt: { $lte: new Date(endDate) } })
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' }
      }
    }
  ]);
  
  // Get top products
  const topProducts = await OrderItem.aggregate([
    {
      $match: {
        ...(startDate && { createdAt: { $gte: new Date(startDate) } }),
        ...(endDate && { createdAt: { $lte: new Date(endDate) } })
      }
    },
    {
      $group: {
        _id: '$productId',
        totalQuantity: { $sum: '$quantity' },
        totalSales: { $sum: { $multiply: ['$price', '$quantity'] } },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { totalSales: -1 }
    },
    {
      $limit: 10
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    {
      $unwind: '$product'
    },
    {
      $project: {
        _id: 1,
        productName: '$product.name',
        productSlug: '$product.slug',
        productImage: { $arrayElemAt: ['$product.images', 0] },
        totalQuantity: 1,
        totalSales: 1,
        count: 1
      }
    }
  ]);
  
  return ApiResponse.success(res, {
    overall: overallStats,
    daily: dailyStats,
    byStatus: statusStats,
    topProducts
  });
});