const ApiError = require('../utils/apiError');

const getDocumentId = (value) => {
  if (!value) return null;
  if (value._id) return value._id.toString();
  return value.toString();
};

const getCustomizationAdjustment = (customizations = {}) => Object.values(customizations)
  .reduce((total, selection) => total + Number(selection?.priceAdjustment || 0), 0);

const priceCartItem = (item) => {
  const product = item.productId;
  if (!product || product.isDeleted) {
    throw new ApiError('A product in your cart is no longer available.', 409);
  }

  const variant = item.variantId || null;
  if (variant && (
    variant.isDeleted ||
    variant.isActive === false ||
    getDocumentId(variant.productId) !== getDocumentId(product)
  )) {
    throw new ApiError('A product variant in your cart is no longer available.', 409);
  }

  let unitPrice = Number(product.basePrice || 0) + Number(variant?.priceAdjustment || 0);

  if (item.flashSaleItemId) {
    const flashSaleItem = item.flashSaleItemId;
    const flashSale = flashSaleItem.flashSaleId;
    const now = new Date();
    const matchesProduct = getDocumentId(flashSaleItem.productId) === getDocumentId(product);
    const matchesVariant = !flashSaleItem.variantId ||
      getDocumentId(flashSaleItem.variantId) === getDocumentId(variant);
    const isActive = flashSaleItem.isActive !== false &&
      flashSale &&
      flashSale.isActive !== false &&
      flashSale.status === 'active' &&
      now >= new Date(flashSale.startDate) &&
      now <= new Date(flashSale.endDate);

    if (!matchesProduct || !matchesVariant || !isActive) {
      throw new ApiError('A flash sale in your cart is no longer active.', 409);
    }

    unitPrice = Number(flashSaleItem.discountedPrice || 0);
  }

  unitPrice += getCustomizationAdjustment(item.customizations);

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new ApiError('Unable to calculate a valid item price.', 409);
  }

  return {
    item,
    unitPrice,
    lineTotal: unitPrice * item.quantity
  };
};

const priceCartItems = (cartItems) => {
  const lines = cartItems.map(priceCartItem);
  return {
    lines,
    subtotal: lines.reduce((total, line) => total + line.lineTotal, 0)
  };
};

module.exports = {
  getDocumentId,
  priceCartItem,
  priceCartItems
};
