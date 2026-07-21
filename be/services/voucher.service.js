const Voucher = require('../models/Voucher');
const UserVoucher = require('../models/UserVoucher');
const ApiError = require('../utils/apiError');

const attachSession = (query, session) => (session ? query.session(session) : query);

const getDocumentId = (value) => {
  if (!value) return null;
  if (value._id) return value._id.toString();
  return value.toString();
};

const calculateDiscount = (voucher, eligibleTotal) => {
  const rawDiscount = voucher.discountType === 'percentage'
    ? (eligibleTotal * voucher.discountValue) / 100
    : voucher.discountValue;
  return Math.max(0, Math.min(rawDiscount, eligibleTotal));
};

const getEligibleTotal = (voucher, cartTotal, cartItems = []) => {
  const productIds = (voucher.productIds || []).map(getDocumentId).filter(Boolean);
  const categoryIds = (voucher.categoryIds || []).map(getDocumentId).filter(Boolean);

  if (productIds.length === 0 && categoryIds.length === 0) {
    return cartTotal;
  }

  const eligibleTotal = cartItems.reduce((total, item) => {
    const product = item.productId || item.product;
    const productId = getDocumentId(product);
    const categoryId = getDocumentId(product?.categoryId || item.categoryId);
    const eligible = productIds.includes(productId) || categoryIds.includes(categoryId);
    const lineTotal = Number(item.lineTotal ?? (item.price * item.quantity));
    return eligible ? total + (Number.isFinite(lineTotal) ? lineTotal : 0) : total;
  }, 0);

  if (eligibleTotal <= 0) {
    throw new ApiError('This voucher does not apply to the items in your cart.', 400);
  }

  return Math.min(cartTotal, eligibleTotal);
};

const validateVoucher = async ({ voucherId, code, userId, cartTotal, cartItems = [], session }) => {
  if (!voucherId && !code) {
    return null;
  }

  let query = Voucher.findOne({
    ...(voucherId ? { _id: voucherId } : { code: code.toUpperCase() }),
    isActive: true,
    isDeleted: false
  });
  const voucher = await attachSession(query, session);

  if (!voucher) {
    throw new ApiError('Voucher is invalid or unavailable.', 400);
  }

  const now = new Date();
  if (now < voucher.startDate || now > voucher.endDate) {
    throw new ApiError('Voucher is not active for the current date.', 400);
  }
  if (voucher.maxUsage > 0 && voucher.currentUsage >= voucher.maxUsage) {
    throw new ApiError('Voucher usage limit has been reached.', 409);
  }
  if (cartTotal < voucher.minOrderValue) {
    throw new ApiError(
      `Minimum order value is ${voucher.minOrderValue}.`,
      400
    );
  }

  if (voucher.isPrivate) {
    query = UserVoucher.findOne({
      userId,
      voucherId: voucher._id,
      isUsed: false,
      isDeleted: false
    });
    const userVoucher = await attachSession(query, session);
    if (!userVoucher) {
      throw new ApiError('Voucher is not assigned to this account or was already used.', 400);
    }
  }

  const eligibleTotal = getEligibleTotal(voucher, cartTotal, cartItems);
  return {
    voucher,
    eligibleTotal,
    discountAmount: calculateDiscount(voucher, eligibleTotal)
  };
};

const consumeVoucher = async ({ voucher, userId, orderId, session }) => {
  if (!voucher) return;

  const usageQuery = {
    _id: voucher._id,
    $or: [
      { maxUsage: 0 },
      { $expr: { $lt: ['$currentUsage', '$maxUsage'] } }
    ]
  };
  const updatedVoucher = await Voucher.findOneAndUpdate(
    usageQuery,
    { $inc: { currentUsage: 1 } },
    { new: true, ...(session ? { session } : {}) }
  );
  if (!updatedVoucher) {
    throw new ApiError('Voucher usage limit was reached during checkout.', 409);
  }

  if (voucher.isPrivate) {
    const updatedAssignment = await UserVoucher.findOneAndUpdate(
      {
        userId,
        voucherId: voucher._id,
        isUsed: false,
        isDeleted: false
      },
      {
        $set: {
          isUsed: true,
          usedAt: new Date(),
          orderId
        }
      },
      { new: true, ...(session ? { session } : {}) }
    );
    if (!updatedAssignment) {
      throw new ApiError('Voucher assignment was already consumed.', 409);
    }
  }
};

module.exports = {
  calculateDiscount,
  getEligibleTotal,
  validateVoucher,
  consumeVoucher
};
