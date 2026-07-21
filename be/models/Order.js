// models/Order.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      description: 'Human-readable order number'
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'pending'
    },
    shippingAddress: {
      fullName: {
        type: String,
        required: [true, 'Full name is required']
      },
      phone: {
        type: String,
        required: [true, 'Phone number is required']
      },
      address: {
        type: String,
        required: [true, 'Address is required']
      },
      city: {
        type: String,
        required: [true, 'City is required']
      },
      state: {
        type: String
      },
      postalCode: {
        type: String
      },
      country: {
        type: String,
        default: 'Vietnam'
      },
      notes: {
        type: String
      }
    },
    billingAddress: {
      fullName: String,
      phone: String,
      address: String,
      city: String,
      state: String,
      postalCode: String,
      country: String
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'vnpay', 'momo', 'zalopay', 'bank_transfer', 'credit_card'],
      required: [true, 'Payment method is required']
    },
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal must be a positive number']
    },
    shippingCost: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount must be a positive number']
    },
    isPaid: {
      type: Boolean,
      default: false
    },
    paidAt: {
      type: Date
    },
    isShipped: {
      type: Boolean,
      default: false
    },
    shippedAt: {
      type: Date
    },
    deliveredAt: {
      type: Date
    },
    cancelledAt: {
      type: Date
    },
    cancelReason: {
      type: String
    },
    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Voucher',
      default: null
    },
    notes: {
      type: String
    },
    meta: {
      type: Map,
      of: String
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    trackingNumber: {
      type: String
    },
    shippingMethod: {
      type: String,
      default: 'standard'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for order items
OrderSchema.virtual('orderItems', {
  ref: 'OrderItem',
  localField: '_id',
  foreignField: 'orderId'
});

// Virtual for payments
OrderSchema.virtual('payments', {
  ref: 'Payment',
  localField: '_id',
  foreignField: 'orderId'
});

// Generate unique order number before saving
OrderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    // Format: DH-{YYYYMMDD}-{Random 6 chars}
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = uuidv4().substring(0, 6).toUpperCase();
    this.orderNumber = `DH-${datePart}-${randomPart}`;
  }
  next();
});

// Update timestamps when status changes
OrderSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    const now = new Date();
    
    switch (this.status) {
      case 'shipped':
        this.isShipped = true;
        this.shippedAt = now;
        break;
      case 'delivered':
        this.deliveredAt = now;
        break;
      case 'cancelled':
        this.cancelledAt = now;
        break;
    }
  }
  
  if (this.isModified('isPaid') && this.isPaid && !this.paidAt) {
    this.paidAt = new Date();
  }
  
  next();
});

// Middleware for soft delete
OrderSchema.pre(/^find/, function(next) {
  if (!this.getOptions().includeDeleted) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

// Method to calculate order totals
OrderSchema.methods.calculateTotals = async function(session) {
  try {
    const OrderItem = mongoose.model('OrderItem');
    let orderItemsQuery = OrderItem.find({ orderId: this._id });
    if (session) orderItemsQuery = orderItemsQuery.session(session);
    const orderItems = await orderItemsQuery;
    
    let subtotal = 0;
    
    // Calculate subtotal from order items
    for (const item of orderItems) {
      subtotal += item.price * item.quantity;
    }
    
    // Calculate other amounts
    this.subtotal = subtotal;
    this.totalAmount = subtotal + this.shippingCost + this.tax - this.discount;
    
    return this.save(session ? { session } : undefined);
  } catch (error) {
    throw new Error(`Failed to calculate order totals: ${error.message}`);
  }
};

// Static method to get sales statistics
OrderSchema.statics.getSalesStats = async function(startDate, endDate) {
  const match = {
    status: { $nin: ['cancelled', 'refunded'] }
  };
  
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }
  
  const stats = await this.aggregate([
    { $match: match },
    { 
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSales: { $sum: '$totalAmount' },
        averageOrderValue: { $avg: '$totalAmount' }
      }
    }
  ]);
  
  return stats.length > 0 ? stats[0] : {
    totalOrders: 0,
    totalSales: 0,
    averageOrderValue: 0
  };
};

// Static method to get sales by date
OrderSchema.statics.getSalesByDate = async function(startDate, endDate, groupBy = 'day') {
  const match = {
    status: { $nin: ['cancelled', 'refunded'] }
  };
  
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }
  
  let dateFormat;
  if (groupBy === 'day') {
    dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  } else if (groupBy === 'month') {
    dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
  } else if (groupBy === 'year') {
    dateFormat = { $dateToString: { format: '%Y', date: '$createdAt' } };
  }
  
  const salesByDate = await this.aggregate([
    { $match: match },
    { 
      $group: {
        _id: dateFormat,
        totalOrders: { $sum: 1 },
        totalSales: { $sum: '$totalAmount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  return salesByDate;
};

// Indexes for faster lookups
OrderSchema.index({ userId: 1 });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: 1 });
OrderSchema.index({ 'shippingAddress.city': 1, 'shippingAddress.country': 1 });

module.exports = mongoose.model('Order', OrderSchema);