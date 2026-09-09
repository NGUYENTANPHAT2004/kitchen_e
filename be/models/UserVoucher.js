// models/UserVoucher.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const UserVoucherSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please provide a user id']
    },
    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Voucher',
      required: [true, 'Please provide a voucher id']
    },
    isUsed: {
      type: Boolean,
      default: false
    },
    usedAt: {
      type: Date
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    expiresAt: {
      type: Date
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for voucher details
UserVoucherSchema.virtual('voucher', {
  ref: 'Voucher',
  localField: 'voucherId',
  foreignField: '_id',
  justOne: true
});

// Virtual for checking if expired
UserVoucherSchema.virtual('isExpired').get(function() {
  if (this.expiresAt) {
    return this.expiresAt < new Date();
  }
  return false;
});

// Query middleware for soft delete
UserVoucherSchema.pre(/^find/, function(next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

// Middleware to set expiration date if not set
UserVoucherSchema.pre('save', async function(next) {
  if (!this.expiresAt) {
    try {
      const voucher = await mongoose.model('Voucher').findById(this.voucherId);
      if (voucher) {
        this.expiresAt = voucher.endDate;
      }
    } catch (error) {
      console.error('Error setting expiration date:', error);
    }
  }
  next();
});

// Function to mark as used
UserVoucherSchema.methods.markAsUsed = async function(orderId) {
  this.isUsed = true;
  this.usedAt = new Date();
  this.orderId = orderId;
  
  // Also increment the voucher usage count
  try {
    const voucher = await mongoose.model('Voucher').findById(this.voucherId);
    if (voucher) {
      await voucher.incrementUsage();
    }
  } catch (error) {
    console.error('Error incrementing voucher usage:', error);
  }
  
  return this.save();
};

// Indexes for faster lookup
UserVoucherSchema.index({ userId: 1, voucherId: 1 }, { unique: true });
UserVoucherSchema.index({ voucherId: 1 });
UserVoucherSchema.index({ userId: 1, isUsed: 1 });

UserVoucherSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('UserVoucher', UserVoucherSchema);
