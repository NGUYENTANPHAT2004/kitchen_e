// models/Payment.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const PaymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      unique: true,
      description: 'Internal payment reference ID'
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order ID is required']
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'vnpay', 'momo', 'zalopay', 'bank_transfer', 'credit_card'],
      required: [true, 'Payment method is required']
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Amount cannot be negative']
    },
    currency: {
      type: String,
      default: 'VND'
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded', 'cancelled'],
      default: 'pending'
    },
    transactionId: {
      type: String,
      description: 'External transaction ID from payment gateway'
    },
    paymentDetails: {
      type: Object,
      description: 'Additional payment details from payment gateway'
    },
    refunds: [
      {
        amount: Number,
        reason: String,
        status: {
          type: String,
          enum: ['pending', 'completed', 'failed']
        },
        transactionId: String,
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    totalRefunded: {
      type: Number,
      default: 0
    },
    errorMessage: {
      type: String
    },
    gatewayResponse: {
      type: Object,
      description: 'Complete response from payment gateway'
    },
    paymentUrl: {
      type: String,
      description: 'URL for payment gateway redirect'
    },
    returnUrl: {
      type: String,
      description: 'Return URL after payment completion'
    },
    notifyUrl: {
      type: String,
      description: 'Webhook URL for payment notifications'
    },
    paidAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Generate unique payment ID before saving
PaymentSchema.pre('save', function(next) {
  this.$locals.completedInThisSave = this.isModified('status') && this.status === 'completed';

  if (!this.paymentId) {
    // Format: PM-{random 10 chars}
    this.paymentId = `PM-${uuidv4().substring(0, 10).toUpperCase()}`;
  }
  
  // If status is completed but paidAt is not set, set it now
  if (this.status === 'completed' && !this.paidAt) {
    this.paidAt = new Date();
  }
  
  next();
});

// After payment completion, update order payment status
PaymentSchema.post('save', async function() {
  if (this.$locals.completedInThisSave) {
    try {
      const Order = mongoose.model('Order');
      const order = await Order.findById(this.orderId);
      
      if (order && !order.isPaid && !['cancelled', 'refunded'].includes(order.status)) {
        order.isPaid = true;
        order.paidAt = new Date();
        
        // If order was pending, move to processing
        if (order.status === 'pending') {
          order.status = 'processing';
        }
        
        await order.save();
      }
    } catch (error) {
      console.error('Failed to update order payment status:', error);
    }
  }
});

// Method to process refund
PaymentSchema.methods.refund = async function(amount, reason) {
  // Check if refund amount is valid
  if (!amount || amount <= 0) {
    throw new Error('Refund amount must be greater than 0');
  }
  
  // Check if refund amount is not more than remaining amount
  const remainingAmount = this.amount - this.totalRefunded;
  if (amount > remainingAmount) {
    throw new Error(`Cannot refund more than the remaining amount: ${remainingAmount}`);
  }
  
  // Check if payment is completed
  if (this.status !== 'completed') {
    throw new Error('Cannot refund a payment that is not completed');
  }
  
  // Process refund based on payment method
  let refundStatus = 'pending';
  let refundTransactionId = null;
  
  try {
    // In a real implementation, this would call the payment gateway's API
    // For now, we'll simulate a successful refund
    refundStatus = 'completed';
    refundTransactionId = `REF-${uuidv4().substring(0, 8).toUpperCase()}`;
    
    // Add refund to refunds array
    this.refunds.push({
      amount,
      reason,
      status: refundStatus,
      transactionId: refundTransactionId,
      createdAt: new Date()
    });
    
    // Update total refunded amount
    this.totalRefunded += amount;
    
    // Update payment status if fully refunded
    if (this.totalRefunded >= this.amount) {
      this.status = 'refunded';
    } else {
      this.status = 'partially_refunded';
    }
    
    await this.save();
    
    return {
      success: true,
      refundTransactionId,
      refundStatus,
      amount,
      totalRefunded: this.totalRefunded,
      paymentStatus: this.status
    };
  } catch (error) {
    // If refund fails, add to refunds with failed status
    this.refunds.push({
      amount,
      reason,
      status: 'failed',
      transactionId: null,
      createdAt: new Date()
    });
    
    await this.save();
    
    throw new Error(`Refund failed: ${error.message}`);
  }
};

// Static method to create a payment
PaymentSchema.statics.createPayment = async function(paymentData) {
  try {
    // Set user ID from order if not provided
    if (!paymentData.userId) {
      const Order = mongoose.model('Order');
      const order = await Order.findById(paymentData.orderId);
      
      if (order) {
        paymentData.userId = order.userId;
      }
    }
    
    // Create payment
    const payment = await this.create(paymentData);
    
    // Process based on payment method
    if (payment.paymentMethod === 'cod') {
      // Cash on delivery doesn't need processing
      return payment;
    } else if (payment.paymentMethod === 'vnpay') {
      // In a real implementation, this would call the VNPay API
      // and set the paymentUrl for the frontend to redirect to
      return payment;
    } else {
      // Other payment methods
      return payment;
    }
  } catch (error) {
    throw new Error(`Failed to create payment: ${error.message}`);
  }
};

// Static method to get payment statistics
PaymentSchema.statics.getPaymentStats = async function(startDate, endDate) {
  const match = {
    status: 'completed'
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
        _id: '$paymentMethod',
        count: { $sum: 1 },
        total: { $sum: '$amount' }
      }
    }
  ]);
  
  return stats;
};

// Indexes for faster lookups
PaymentSchema.index({ paymentId: 1 });
PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ userId: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ transactionId: 1 });
PaymentSchema.index({ createdAt: 1 });

module.exports = mongoose.model('Payment', PaymentSchema);