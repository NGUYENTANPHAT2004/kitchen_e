const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Payment = require('../models/Payment');
const ApiError = require('../utils/apiError');
const inventoryService = require('./inventory.service');

const NON_CANCELLABLE_STATUSES = ['shipped', 'delivered', 'cancelled', 'refunded'];

const cancelOrder = async ({ orderId, reason, session }) => {
  const cancelledAt = new Date();
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      status: { $nin: NON_CANCELLABLE_STATUSES },
      isPaid: { $ne: true }
    },
    {
      $set: {
        status: 'cancelled',
        cancelReason: reason,
        cancelledAt
      }
    },
    {
      new: true,
      runValidators: true,
      session
    }
  );

  if (!order) {
    throw new ApiError('Paid or finalized orders require the refund workflow.', 409);
  }

  const orderItems = await OrderItem.find({ orderId: order._id })
    .session(session)
    .populate('productId')
    .populate('variantId')
    .populate('flashSaleItemId');

  for (const item of orderItems) {
    if (item.variantId) {
      await inventoryService.releaseProductStock({
        productId: item.productId?._id || null,
        variantId: item.variantId._id,
        quantity: item.quantity,
        session
      });
    } else if (item.productId) {
      await inventoryService.releaseProductStock({
        productId: item.productId._id,
        variantId: null,
        quantity: item.quantity,
        session
      });
    }

    if (item.flashSaleItemId) {
      await inventoryService.releaseFlashSaleStock({
        flashSaleItemId: item.flashSaleItemId._id,
        quantity: item.quantity,
        session
      });
    }
  }

  await Payment.findOneAndUpdate(
    { orderId: order._id, status: 'pending' },
    { $set: { status: 'cancelled' } },
    { new: true, session }
  );

  return order;
};

module.exports = {
  NON_CANCELLABLE_STATUSES,
  cancelOrder
};
