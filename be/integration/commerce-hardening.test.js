jest.mock('../models/Voucher', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn()
}));
jest.mock('../models/UserVoucher', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn()
}));
jest.mock('../models/IdempotencyKey', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn()
}));

const Voucher = require('../models/Voucher');
const IdempotencyKey = require('../models/IdempotencyKey');
const voucherService = require('../services/voucher.service');
const pricingService = require('../services/pricing.service');
const idempotencyService = require('../services/idempotency.service');
const paymentGatewayService = require('../services/payment-gateway.service');

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.VNPAY_HASH_SECRET;
  delete process.env.MOMO_ACCESS_KEY;
  delete process.env.MOMO_SECRET_KEY;
  delete process.env.ZALOPAY_KEY2;
});

describe('Pricing and promotion boundaries', () => {
  test('recalculates item price from current catalog data', () => {
    const product = { _id: 'p1', basePrice: 100000, categoryId: 'cat-1' };
    const variant = { _id: 'v1', productId: 'p1', priceAdjustment: 5000, stockQuantity: 4 };
    const { subtotal, lines } = pricingService.priceCartItems([{
      productId: product,
      variantId: variant,
      quantity: 2,
      customizations: { engraving: { value: 'gift', priceAdjustment: 10000 } }
    }]);

    expect(lines[0].unitPrice).toBe(115000);
    expect(subtotal).toBe(230000);
  });

  test('applies restricted voucher only to eligible product lines', async () => {
    const voucher = {
      _id: 'v1',
      discountType: 'percentage',
      discountValue: 10,
      minOrderValue: 0,
      maxUsage: 0,
      currentUsage: 0,
      startDate: new Date(Date.now() - 1000),
      endDate: new Date(Date.now() + 60_000),
      isActive: true,
      isDeleted: false,
      isPrivate: false,
      productIds: ['eligible-product'],
      categoryIds: []
    };
    Voucher.findOne.mockResolvedValue(voucher);

    const result = await voucherService.validateVoucher({
      code: 'SAVE10',
      cartTotal: 300000,
      cartItems: [
        { productId: { _id: 'eligible-product', categoryId: 'cat-1' }, lineTotal: 100000 },
        { productId: { _id: 'other-product', categoryId: 'cat-2' }, lineTotal: 200000 }
      ]
    });

    expect(result.eligibleTotal).toBe(100000);
    expect(result.discountAmount).toBe(10000);
  });

  test('rejects restricted voucher when no line is eligible', async () => {
    Voucher.findOne.mockResolvedValue({
      _id: 'v1',
      discountType: 'fixed',
      discountValue: 10000,
      minOrderValue: 0,
      maxUsage: 0,
      currentUsage: 0,
      startDate: new Date(Date.now() - 1000),
      endDate: new Date(Date.now() + 60_000),
      isPrivate: false,
      productIds: ['eligible-product'],
      categoryIds: []
    });

    await expect(voucherService.validateVoucher({
      code: 'SAVE10',
      cartTotal: 100000,
      cartItems: [{ productId: { _id: 'other-product' }, lineTotal: 100000 }]
    })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('Idempotency and gateway verification', () => {
  test('replays a completed request and rejects a changed payload', async () => {
    const record = { _id: 'idem-1', status: 'processing' };
    IdempotencyKey.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      _id: 'idem-1',
      status: 'completed',
      requestHash: idempotencyService.hashPayload({ amount: 100 }),
      statusCode: 201,
      responseBody: { success: true },
      expiresAt: new Date(Date.now() + 60_000)
    });
    IdempotencyKey.create.mockResolvedValue(record);

    const first = await idempotencyService.begin({
      scope: 'test', key: 'key-1', ownerId: 'user-1', payload: { amount: 100 }
    });
    expect(first.replay).toBe(false);
    await idempotencyService.complete({
      record,
      statusCode: 201,
      responseBody: { success: true }
    });

    const replay = await idempotencyService.begin({
      scope: 'test', key: 'key-1', ownerId: 'user-1', payload: { amount: 100 }
    });
    expect(replay.replay).toBe(true);
    expect(replay.statusCode).toBe(201);

    IdempotencyKey.findOne.mockResolvedValueOnce({
      _id: 'idem-1',
      status: 'completed',
      requestHash: idempotencyService.hashPayload({ amount: 100 }),
      expiresAt: new Date(Date.now() + 60_000)
    });
    await expect(idempotencyService.begin({
      scope: 'test', key: 'key-1', ownerId: 'user-1', payload: { amount: 999 }
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  test('verifies VNPay response signature before accepting success', () => {
    process.env.VNPAY_HASH_SECRET = 'test-secret';
    const params = {
      vnp_TxnRef: 'PM-123',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: 'TX-1'
    };
    const signed = {
      ...params,
      vnp_SecureHash: paymentGatewayService.buildVnPaySignature(params, process.env.VNPAY_HASH_SECRET)
    };

    expect(paymentGatewayService.normalizeWebhook(signed).verify()).toBe(true);
    expect(paymentGatewayService.normalizeWebhook({ ...signed, vnp_ResponseCode: '24' }).verify()).toBe(false);
  });

  test('normalizes MoMo event and verifies its HMAC', () => {
    process.env.MOMO_ACCESS_KEY = 'access';
    process.env.MOMO_SECRET_KEY = 'secret';
    const payload = {
      partnerCode: 'partner',
      orderId: 'PM-123',
      requestId: 'REQ-1',
      amount: '1000',
      extraData: '',
      message: 'Successful',
      orderInfo: 'Order',
      orderType: 'momo_wallet',
      payType: 'qr',
      responseTime: '1',
      resultCode: 0,
      transId: 10
    };
    payload.signature = paymentGatewayService.buildMomoSignature(
      payload,
      process.env.MOMO_ACCESS_KEY,
      process.env.MOMO_SECRET_KEY
    );

    const normalized = paymentGatewayService.normalizeWebhook(payload);
    expect(normalized.gateway).toBe('momo');
    expect(normalized.status).toBe('completed');
    expect(normalized.verify()).toBe(true);
  });
});
