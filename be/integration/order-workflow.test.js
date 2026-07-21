jest.mock('../models/Order', () => ({
  findOneAndUpdate: jest.fn()
}));
jest.mock('../models/OrderItem', () => ({
  find: jest.fn()
}));
jest.mock('../models/Payment', () => ({
  findOneAndUpdate: jest.fn()
}));
jest.mock('../services/inventory.service', () => ({
  releaseProductStock: jest.fn().mockResolvedValue({}),
  releaseFlashSaleStock: jest.fn().mockResolvedValue({})
}));

const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Payment = require('../models/Payment');
const inventoryService = require('../services/inventory.service');
const { cancelOrder } = require('../services/order-cancellation.service');

beforeEach(() => {
  jest.clearAllMocks();
});

const queryWithSession = (value) => {
  const query = {
    session: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    then: (resolve) => Promise.resolve(value).then(resolve)
  };
  return query;
};

test('claims order cancellation before restoring inventory', async () => {
  const session = { id: 'session-1' };
  const order = { _id: 'order-1' };
  const item = {
    quantity: 2,
    productId: { _id: 'product-1' },
    variantId: null,
    flashSaleItemId: null
  };
  Order.findOneAndUpdate.mockResolvedValue(order);
  OrderItem.find.mockReturnValue(queryWithSession([item]));
  Payment.findOneAndUpdate.mockResolvedValue({});

  const result = await cancelOrder({
    orderId: 'order-1',
    reason: 'customer request',
    session
  });

  expect(result).toBe(order);
  expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
    {
      _id: 'order-1',
      status: { $nin: ['shipped', 'delivered', 'cancelled', 'refunded'] },
      isPaid: { $ne: true }
    },
    {
      $set: expect.objectContaining({
        status: 'cancelled',
        cancelReason: 'customer request'
      })
    },
    expect.objectContaining({ session })
  );
  expect(inventoryService.releaseProductStock).toHaveBeenCalledWith({
    productId: 'product-1',
    variantId: null,
    quantity: 2,
    session
  });
  expect(Payment.findOneAndUpdate).toHaveBeenCalledWith(
    { orderId: 'order-1', status: 'pending' },
    { $set: { status: 'cancelled' } },
    { new: true, session }
  );
});

test('does not cancel a paid order without the refund workflow', async () => {
  Order.findOneAndUpdate.mockResolvedValue(null);

  await expect(cancelOrder({
    orderId: 'order-paid',
    reason: 'customer request',
    session: { id: 'session-1' }
  })).rejects.toMatchObject({ statusCode: 409 });

  expect(OrderItem.find).not.toHaveBeenCalled();
  expect(inventoryService.releaseProductStock).not.toHaveBeenCalled();
});
