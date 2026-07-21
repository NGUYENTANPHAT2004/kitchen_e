const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');
const FlashSaleItem = require('../models/FlashSaleItem');
const ApiError = require('../utils/apiError');

const withSession = (session) => (session ? { session } : {});

const reserveProductStock = async ({ productId, variantId, quantity, session }) => {
  const Model = variantId ? ProductVariant : Product;
  const id = variantId || productId;
  const updated = await Model.findOneAndUpdate(
    { _id: id, stockQuantity: { $gte: quantity } },
    { $inc: { stockQuantity: -quantity } },
    { ...withSession(session), new: true }
  );

  if (!updated) {
    throw new ApiError('Product stock changed. Please review your cart and try again.', 409);
  }

  return updated;
};

const releaseProductStock = async ({ productId, variantId, quantity, session }) => {
  const Model = variantId ? ProductVariant : Product;
  const id = variantId || productId;
  const updated = await Model.findOneAndUpdate(
    { _id: id },
    { $inc: { stockQuantity: quantity } },
    { ...withSession(session), new: true }
  );

  if (!updated) {
    throw new ApiError('Unable to restore product stock.', 409);
  }

  return updated;
};

const reserveFlashSaleStock = async ({ flashSaleItemId, quantity, session }) => {
  const updated = await FlashSaleItem.findOneAndUpdate(
    {
      _id: flashSaleItemId,
      isActive: true,
      $expr: {
        $lte: ['$quantitySold', { $subtract: ['$quantity', quantity] }]
      }
    },
    { $inc: { quantitySold: quantity } },
    { ...withSession(session), new: true }
  );

  if (!updated) {
    throw new ApiError('Flash-sale stock changed. Please review your cart and try again.', 409);
  }

  return updated;
};

const releaseFlashSaleStock = async ({ flashSaleItemId, quantity, session }) => {
  const updated = await FlashSaleItem.findOneAndUpdate(
    {
      _id: flashSaleItemId,
      quantitySold: { $gte: quantity }
    },
    { $inc: { quantitySold: -quantity } },
    { ...withSession(session), new: true }
  );

  if (!updated) {
    throw new ApiError('Unable to restore flash-sale stock.', 409);
  }

  return updated;
};

module.exports = {
  reserveProductStock,
  releaseProductStock,
  reserveFlashSaleStock,
  releaseFlashSaleStock
};
