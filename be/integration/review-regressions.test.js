jest.mock('../models/Review', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn()
}));

jest.mock('../models/Product', () => ({ findById: jest.fn() }));
jest.mock('../models/ProductVariant', () => ({ findById: jest.fn() }));
jest.mock('../models/Order', () => ({ find: jest.fn() }));
jest.mock('../models/OrderItem', () => ({ findOne: jest.fn() }));

const Review = require('../models/Review');
const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const reviewController = require('../controllers/review.controller');

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis()
});

describe('Review regressions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('verifies a variant purchase through delivered OrderItem records', async () => {
    Product.findById.mockResolvedValue({ _id: 'product-1' });
    ProductVariant.findById.mockResolvedValue({
      _id: 'variant-1',
      productId: { toString: () => 'product-1' }
    });
    Review.findOne.mockResolvedValue(null);

    const selectDeliveredOrders = jest.fn().mockResolvedValue([{ _id: 'order-1' }]);
    Order.find.mockReturnValue({ select: selectDeliveredOrders });

    const selectPurchasedItem = jest.fn().mockResolvedValue({ orderId: 'order-1' });
    OrderItem.findOne.mockReturnValue({ select: selectPurchasedItem });
    Review.create.mockImplementation(async (data) => ({ _id: 'review-1', ...data }));

    const req = {
      user: { id: 'user-1', role: 'user' },
      body: {
        productId: 'product-1',
        productVariantId: 'variant-1',
        rating: 5,
        comment: 'Great product'
      }
    };
    const res = createResponse();
    const next = jest.fn();

    await reviewController.createReview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(Order.find).toHaveBeenCalledWith({
      userId: 'user-1',
      status: 'delivered'
    });
    expect(OrderItem.findOne).toHaveBeenCalledWith({
      orderId: { $in: ['order-1'] },
      productId: 'product-1',
      variantId: 'variant-1'
    });
    expect(Review.create).toHaveBeenCalledWith(expect.objectContaining({
      isVerifiedPurchase: true,
      orderId: 'order-1'
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('does not allow review owners to update protected commerce fields', async () => {
    Review.findById.mockResolvedValue({
      userId: { toString: () => 'user-1' }
    });
    Review.findByIdAndUpdate.mockResolvedValue({ _id: 'review-1', rating: 4 });

    const req = {
      params: { id: 'review-1' },
      user: { id: 'user-1', role: 'user' },
      body: {
        rating: 4,
        comment: 'Updated',
        userId: 'other-user',
        productId: 'other-product',
        productVariantId: 'other-variant',
        orderId: 'other-order',
        isVerifiedPurchase: true,
        isApproved: true,
        isRejected: true,
        rejectionReason: 'tampered'
      }
    };
    const res = createResponse();
    const next = jest.fn();

    await reviewController.updateReview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(Review.findByIdAndUpdate).toHaveBeenCalledWith(
      'review-1',
      { rating: 4, comment: 'Updated' },
      { new: true, runValidators: true }
    );
  });
});
