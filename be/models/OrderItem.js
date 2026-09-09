// models/OrderItem.js
const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order ID is required"],
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      default: null,
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
    },
    flashSaleItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FlashSaleItem",
      default: null,
    },
    customizations: {
      type: Object,
      default: {},
      description: "Customization options selected by the user",
    },
    productSnapshot: {
      name: String,
      sku: String,
      image: String,
      description: String,
    },
    variantSnapshot: {
      name: String,
      sku: String,
      color: String,
      size: String,
      material: String,
    },
    refundStatus: {
      type: String,
      enum: ["none", "requested", "approved", "rejected", "completed"],
      default: "none",
    },
    refundReason: {
      type: String,
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for calculating total item price
OrderItemSchema.virtual("totalPrice").get(function () {
  return this.price * this.quantity - this.discount;
});

// Set product snapshot before saving
OrderItemSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      // Get product details
      const Product = mongoose.model("Product");
      const product = await Product.findById(this.productId).session(
        this.$session()
      );

      if (product) {
        this.productSnapshot = {
          name: product.name,
          sku: product.sku,
          image:
            product.images && product.images.length > 0
              ? product.images[0].url
              : null,
          description: product.description,
        };
      }

      // Get variant details if specified
      if (this.variantId) {
        const ProductVariant = mongoose.model("ProductVariant");
        const variant = await ProductVariant.findById(this.variantId).session(
          this.$session()
        );

        if (variant) {
          this.variantSnapshot = {
            name: variant.name,
            sku: variant.sku,
            color: variant.color,
            size: variant.size,
            material: variant.material,
          };
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Update order totals after save
OrderItemSchema.post("save", async function () {
  if (this.$session()) return;
  try {
    const Order = mongoose.model("Order");
    const order = await Order.findById(this.orderId);
    if (order) {
      await order.calculateTotals();
    }
  } catch (error) {
    console.error("Failed to update order totals:", error);
  }
});

// Update order totals after update
OrderItemSchema.post("findOneAndUpdate", async function (doc) {
  try {
    if (doc) {
      const Order = mongoose.model("Order");
      const order = await Order.findById(doc.orderId);
      if (order) {
        await order.calculateTotals();
      }
    }
  } catch (error) {
    console.error("Failed to update order totals after update:", error);
  }
});

// Update order totals after delete
OrderItemSchema.post("remove", async function () {
  try {
    const Order = mongoose.model("Order");
    const order = await Order.findById(this.orderId);
    if (order) {
      await order.calculateTotals();
    }
  } catch (error) {
    console.error("Failed to update order totals after delete:", error);
  }
});

// Method to request refund
OrderItemSchema.methods.requestRefund = async function (reason, amount) {
  if (this.refundStatus !== "none") {
    throw new Error(`Refund already ${this.refundStatus}`);
  }

  // Set refund details
  this.refundStatus = "requested";
  this.refundReason = reason;
  this.refundAmount = amount || this.price * this.quantity;

  return this.save();
};

// Method to process refund
OrderItemSchema.methods.processRefund = async function (status, amount) {
  if (this.refundStatus !== "requested") {
    throw new Error("No refund request to process");
  }

  if (status === "approved" || status === "completed") {
    this.refundStatus = status;
    this.refundAmount = amount || this.refundAmount;
  } else if (status === "rejected") {
    this.refundStatus = "rejected";
  } else {
    throw new Error("Invalid refund status");
  }

  return this.save();
};

// Indexes for faster lookups
OrderItemSchema.index({ orderId: 1 });
OrderItemSchema.index({ productId: 1 });
OrderItemSchema.index({ refundStatus: 1 });

module.exports = mongoose.model("OrderItem", OrderItemSchema);
