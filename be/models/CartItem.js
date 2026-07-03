// models/CartItem.js
const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema(
  {
    cartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cart',
      required: [true, 'Cart ID is required']
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required']
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductVariant',
      default: null
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1']
    },
    price: {
      type: Number,
      description: 'Cached price at the time of adding to cart'
    },
    flashSaleItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FlashSaleItem',
      default: null
    },
    customizations: {
      type: Object,
      default: {},
      description: 'Customization options selected by the user'
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for calculating total item price
CartItemSchema.virtual('totalPrice').get(function() {
  return this.price * this.quantity;
});

// Middleware to update cart totals after save/update/delete
async function updateCartTotals(cartId) {
  try {
    const Cart = mongoose.model('Cart');
    const cart = await Cart.findById(cartId);
    if (cart) {
      await cart.calculateTotals();
    }
  } catch (error) {
    console.error('Failed to update cart totals:', error);
  }
}

CartItemSchema.post('save', function() {
  updateCartTotals(this.cartId);
});

CartItemSchema.post('remove', function() {
  updateCartTotals(this.cartId);
});

CartItemSchema.post('findOneAndUpdate', async function(doc) {
  if (doc) {
    await updateCartTotals(doc.cartId);
  }
});

// Middleware to ensure product is available and set price
CartItemSchema.pre('save', async function(next) {
  try {
    // Only run if the cartItem is new or quantity is modified
    if (this.isNew || this.isModified('quantity') || this.isModified('productId') || this.isModified('variantId') || this.isModified('customizations')) {
      // Get product details
      const Product = mongoose.model('Product');
      const product = await Product.findById(this.productId);
      
      if (!product) {
        return next(new Error('Product not found'));
      }
      
      if (product.isDeleted) {
        return next(new Error('Product is no longer available'));
      }
      
      // Check variant if specified
      let variant = null;
      if (this.variantId) {
        const ProductVariant = mongoose.model('ProductVariant');
        variant = await ProductVariant.findById(this.variantId);
        
        if (!variant) {
          return next(new Error('Product variant not found'));
        }
        
        if (variant.isDeleted) {
          return next(new Error('Product variant is no longer available'));
        }
        
        // Check stock
        if (variant.stockQuantity < this.quantity) {
          return next(new Error(`Only ${variant.stockQuantity} units available`));
        }
      } else if (product.stockQuantity < this.quantity) {
        // Check product stock if no variant
        return next(new Error(`Only ${product.stockQuantity} units available`));
      }
      
      // Check for flash sale
      let finalPrice = variant ? (product.basePrice + variant.priceAdjustment) : product.basePrice;
      
      if (this.flashSaleItemId) {
        const FlashSaleItem = mongoose.model('FlashSaleItem');
        const flashSaleItem = await FlashSaleItem.findById(this.flashSaleItemId).populate({
          path: 'flashSaleId',
          match: { 
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
            status: 'active',
            isActive: true
          }
        });
        
        if (flashSaleItem && flashSaleItem.flashSaleId) {
          // Check if there's enough flash sale quantity
          if (flashSaleItem.remainingQuantity < this.quantity) {
            return next(new Error(`Flash sale only has ${flashSaleItem.remainingQuantity} units left`));
          }

          finalPrice = flashSaleItem.discountedPrice;
        } else {
          // Reset flash sale reference if flash sale is no longer valid
          this.flashSaleItemId = null;
        }
      }

      // Cộng phụ giá customization — tra từ DB để giá luôn chuẩn (không tin client gửi)
      if (this.customizations && Object.keys(this.customizations).length > 0) {
        const ProductCustomization = mongoose.model('ProductCustomization');
        const defs = await ProductCustomization.find({
          productId: this.productId,
          isActive: true
        });

        let customizationExtra = 0;
        const verified = {};
        for (const [name, selected] of Object.entries(this.customizations)) {
          const value = selected && selected.value;
          if (!value) continue;
          const def = defs.find(d => d.name === name);
          const option = def && def.options.find(o => o.value === value);
          if (!option) continue; // bỏ lựa chọn không hợp lệ
          customizationExtra += option.priceAdjustment || 0;
          verified[name] = { value, priceAdjustment: option.priceAdjustment || 0 };
        }
        // Ghi đè bằng dữ liệu đã xác thực từ DB
        this.customizations = verified;
        finalPrice += customizationExtra;
      }

      // Update price
      this.price = finalPrice;
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Index for faster lookups
CartItemSchema.index({ cartId: 1 });
CartItemSchema.index({ productId: 1, variantId: 1 });

module.exports = mongoose.model('CartItem', CartItemSchema);