// Unit test cho POST /api/cart/merge (controller-level, mock model — không cần DB).
// Mô tả hợp đồng đúng: FE gửi { items: [...] } từ giỏ localStorage của khách,
// backend gộp vào giỏ của user đã đăng nhập. KHÔNG được đòi sessionId.

jest.mock('../models/Cart', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../models/CartItem', () => ({ find: jest.fn(), findOne: jest.fn(), create: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../models/Product', () => ({ findOne: jest.fn() }));
jest.mock('../models/ProductVariant', () => ({ findOne: jest.fn() }));
jest.mock('../models/FlashSaleItem', () => ({ findOne: jest.fn() }));

const Cart = require('../models/Cart');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const cartController = require('../controllers/cart.controller');

function mockRes() {
  const res = { statusCode: 200 };
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((body) => { res.body = body; return res; });
  return res;
}

function makeUserCart() {
  return {
    _id: 'cart-user-1',
    userId: 'user-1',
    status: 'active',
    calculateTotals: jest.fn().mockResolvedValue(undefined),
    populate: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/cart/merge — cartController.mergeCart', () => {
  test('gộp items khách vãng lai vào giỏ user, không đòi sessionId', async () => {
    const userCart = makeUserCart();
    Cart.findOne.mockResolvedValue(userCart);          // user đã có giỏ active
    Product.findOne.mockResolvedValue({ _id: 'p1', basePrice: 100000 });
    CartItem.find.mockResolvedValue([]);               // giỏ user chưa có item nào
    CartItem.create.mockResolvedValue({ _id: 'ci1' });
    CartItem.countDocuments.mockResolvedValue(1);

    const req = { body: { items: [{ productId: 'p1', quantity: 2 }] }, user: { _id: 'user-1' } };
    const res = mockRes();
    const next = jest.fn();

    await cartController.mergeCart(req, res, next);

    expect(next).not.toHaveBeenCalled();               // KHÔNG được ném lỗi 400
    expect(res.statusCode).toBe(200);
    expect(CartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ cartId: 'cart-user-1', productId: 'p1', quantity: 2 })
    );
    expect(res.body?.success).toBe(true);
  });

  test('cộng dồn số lượng khi sản phẩm đã có trong giỏ user', async () => {
    const userCart = makeUserCart();
    Cart.findOne.mockResolvedValue(userCart);
    Product.findOne.mockResolvedValue({ _id: 'p1', basePrice: 100000 });
    const existing = { _id: 'ci1', quantity: 1, save: jest.fn().mockResolvedValue(undefined) };
    CartItem.find.mockResolvedValue([existing]);       // sản phẩm đã có trong giỏ user (không customization)
    CartItem.countDocuments.mockResolvedValue(1);

    const req = { body: { items: [{ productId: 'p1', quantity: 3 }] }, user: { _id: 'user-1' } };
    const res = mockRes();
    const next = jest.fn();

    await cartController.mergeCart(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(existing.quantity).toBe(4);                 // 1 + 3
    expect(existing.save).toHaveBeenCalled();
  });

  test('body rỗng (không có items) vẫn trả giỏ user, không lỗi', async () => {
    const userCart = makeUserCart();
    Cart.findOne.mockResolvedValue(userCart);
    CartItem.countDocuments.mockResolvedValue(0);

    const req = { body: {}, user: { _id: 'user-1' } };
    const res = mockRes();
    const next = jest.fn();

    await cartController.mergeCart(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  test('cùng sản phẩm nhưng customization khác nhau → tạo dòng giỏ riêng', async () => {
    const userCart = makeUserCart();
    Cart.findOne.mockResolvedValue(userCart);
    Product.findOne.mockResolvedValue({ _id: 'p1', basePrice: 100000 });
    // Giỏ user đã có item màu đỏ; item mới là màu xanh → không được gộp
    const redItem = { _id: 'ci1', quantity: 1, customizations: { color: { value: 'red' } }, save: jest.fn() };
    CartItem.find.mockResolvedValue([redItem]);
    CartItem.create.mockResolvedValue({ _id: 'ci2' });
    CartItem.countDocuments.mockResolvedValue(2);

    const req = {
      body: { items: [{ productId: 'p1', quantity: 1, customizations: { color: { value: 'blue' } } }] },
      user: { _id: 'user-1' },
    };
    const res = mockRes();
    const next = jest.fn();

    await cartController.mergeCart(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(redItem.save).not.toHaveBeenCalled();       // KHÔNG gộp vào item màu đỏ
    expect(CartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'p1', customizations: { color: { value: 'blue' } } })
    );
  });
});
