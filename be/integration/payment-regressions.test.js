jest.mock('../models/Payment', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  createPayment: jest.fn(),
  aggregate: jest.fn()
}));
jest.mock('../models/Order', () => ({
  findById: jest.fn()
}));
jest.mock('../models/PaymentWebhookEvent', () => ({
  create: jest.fn(),
  findOne: jest.fn()
}));
jest.mock('../services/idempotency.service', () => ({
  begin: jest.fn(),
  complete: jest.fn(),
  abandon: jest.fn()
}));

const Payment = require('../models/Payment');
const Order = require('../models/Order');
const PaymentWebhookEvent = require('../models/PaymentWebhookEvent');
const idempotencyService = require('../services/idempotency.service');
const paymentGatewayService = require('../services/payment-gateway.service');
const paymentController = require('../controllers/payment.controller');

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis()
});

const invoke = async (handler, req, res) => {
  const next = jest.fn();
  await handler(req, res, next);
  if (next.mock.calls[0]?.[0]) throw next.mock.calls[0][0];
  return next;
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.VNPAY_HASH_SECRET = 'test-secret';
  process.env.FRONTEND_URL = 'http://frontend.test';
  process.env.API_URL = 'http://api.test';
  idempotencyService.begin.mockResolvedValue({ replay: false, record: null });
  idempotencyService.complete.mockResolvedValue();
  idempotencyService.abandon.mockResolvedValue();
});

describe('Payment controller regressions', () => {
  test('reuses a pending payment but still creates a gateway redirect URL', async () => {
    const payment = {
      status: 'pending',
      paymentMethod: 'vnpay',
      paymentId: 'PM-123',
      amount: 100000,
      returnUrl: 'http://frontend.test/complete',
      save: jest.fn().mockResolvedValue()
    };
    Order.findById.mockResolvedValue({
      _id: 'order-1',
      userId: { toString: () => 'user-1' },
      totalAmount: 100000,
      orderNumber: 'DH-1',
      status: 'pending',
      isPaid: false
    });
    Payment.findOne.mockResolvedValue(payment);

    const req = {
      body: { orderId: 'order-1', paymentMethod: 'vnpay' },
      user: { _id: { toString: () => 'user-1' } },
      get: jest.fn()
    };
    const res = createResponse();
    await invoke(paymentController.initiatePayment, req, res);

    expect(Payment.createPayment).not.toHaveBeenCalled();
    expect(payment.save).toHaveBeenCalledTimes(1);
    expect(res.json.mock.calls[0][0].data.redirectUrl).toContain('vnpayment.vn');
  });

  test('does not trust a generic status=success return parameter', async () => {
    const payment = {
      status: 'pending',
      paymentMethod: 'bank_transfer',
      orderId: 'order-1',
      save: jest.fn()
    };
    Payment.findOne.mockResolvedValue(payment);
    Order.findById.mockResolvedValue({
      _id: 'order-1', orderNumber: 'DH-1', status: 'pending', isPaid: false
    });

    const req = { query: { orderId: 'order-1', status: 'success' } };
    const res = createResponse();
    await invoke(paymentController.completePayment, req, res);

    expect(payment.status).toBe('pending');
    expect(payment.save).not.toHaveBeenCalled();
  });

  test('rejects an unsigned VNPay return response', async () => {
    const payment = {
      status: 'pending',
      paymentMethod: 'vnpay',
      orderId: 'order-1',
      save: jest.fn()
    };
    Payment.findOne.mockResolvedValue(payment);
    const req = {
      query: {
        orderId: 'order-1',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00'
      }
    };
    const res = createResponse();
    const next = jest.fn();

    await paymentController.completePayment(req, res, next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
    expect(payment.save).not.toHaveBeenCalled();
  });

  test('finds VNPay return payment by vnp_TxnRef', async () => {
    const query = {
      vnp_TxnRef: 'PM-123',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: 'TX-1'
    };
    query.vnp_SecureHash = paymentGatewayService.buildVnPaySignature(
      query,
      process.env.VNPAY_HASH_SECRET
    );
    const payment = {
      status: 'pending',
      paymentMethod: 'vnpay',
      orderId: 'order-1',
      save: jest.fn().mockResolvedValue()
    };
    Payment.findOne.mockResolvedValue(payment);
    Order.findById.mockResolvedValue({
      _id: 'order-1', orderNumber: 'DH-1', status: 'processing', isPaid: true
    });

    const res = createResponse();
    await invoke(paymentController.completePayment, { query }, res);

    expect(Payment.findOne).toHaveBeenCalledWith({ paymentId: 'PM-123' });
    expect(payment.status).toBe('completed');
  });
  test('synchronizes a successful webhook to the order state', async () => {
    const payload = {
      vnp_TxnRef: 'PM-123',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: 'TX-1'
    };
    payload.vnp_SecureHash = paymentGatewayService.buildVnPaySignature(
      payload,
      process.env.VNPAY_HASH_SECRET
    );
    const event = { status: 'received', save: jest.fn().mockResolvedValue() };
    const payment = {
      status: 'pending',
      paymentMethod: 'vnpay',
      orderId: 'order-1',
      save: jest.fn().mockResolvedValue()
    };
    const order = {
      status: 'pending',
      isPaid: false,
      save: jest.fn().mockResolvedValue()
    };
    PaymentWebhookEvent.create.mockResolvedValue(event);
    Payment.findOne.mockResolvedValue(payment);
    Order.findById.mockResolvedValue(order);

    const res = createResponse();
    await invoke(paymentController.paymentWebhook, { body: payload }, res);

    expect(order.isPaid).toBe(true);
    expect(order.status).toBe('processing');
    expect(order.save).toHaveBeenCalledTimes(1);
  });

  test('retries an event that was recorded before processing completed', async () => {
    const payload = {
      vnp_TxnRef: 'PM-123',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: 'TX-1'
    };
    payload.vnp_SecureHash = paymentGatewayService.buildVnPaySignature(
      payload,
      process.env.VNPAY_HASH_SECRET
    );
    const payment = {
      status: 'pending',
      paymentMethod: 'vnpay',
      orderId: 'order-1',
      save: jest.fn().mockResolvedValue()
    };
    PaymentWebhookEvent.create.mockRejectedValue({ code: 11000 });
    PaymentWebhookEvent.findOne.mockResolvedValue({
      status: 'received',
      payloadHash: paymentGatewayService.hashPayload(payload),
      save: jest.fn().mockResolvedValue()
    });
    Payment.findOne.mockResolvedValue(payment);
    Order.findById.mockResolvedValue({
      status: 'processing',
      isPaid: true,
      save: jest.fn().mockResolvedValue()
    });

    const res = createResponse();
    await invoke(paymentController.paymentWebhook, { body: payload }, res);

    expect(Payment.findOne).toHaveBeenCalledWith({ paymentId: 'PM-123' });
    expect(payment.status).toBe('completed');
    expect(res.send).toHaveBeenCalledWith('OK');
  });

  test('does not downgrade a completed payment on a later failed webhook', async () => {
    const payload = {
      vnp_TxnRef: 'PM-123',
      vnp_ResponseCode: '24',
      vnp_TransactionStatus: '02',
      vnp_TransactionNo: 'TX-1'
    };
    payload.vnp_SecureHash = paymentGatewayService.buildVnPaySignature(
      payload,
      process.env.VNPAY_HASH_SECRET
    );
    const event = { status: 'received', save: jest.fn().mockResolvedValue() };
    const payment = {
      status: 'completed',
      paymentMethod: 'vnpay',
      save: jest.fn().mockResolvedValue()
    };
    PaymentWebhookEvent.create.mockResolvedValue(event);
    Payment.findOne.mockResolvedValue(payment);

    const req = { body: payload };
    const res = createResponse();
    await invoke(paymentController.paymentWebhook, req, res);

    expect(payment.status).toBe('completed');
    expect(event.status).toBe('processed');
    expect(res.send).toHaveBeenCalledWith('OK');
  });
});
