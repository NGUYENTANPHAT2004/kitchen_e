// models/Voucher.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const VoucherSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Please provide a voucher code'],
      unique: true,
      trim: true,
      uppercase: true
    },
    description: {
      type: String,
      trim: true
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: [true, 'Please provide a discount type']
    },
    discountValue: {
      type: Number,
      required: [true, 'Please provide a discount value'],
      min: [0, 'Discount value cannot be negative']
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order value cannot be negative']
    },
    maxUsage: {
      type: Number,
      default: 0, // 0 means unlimited
      min: [0, 'Max usage cannot be negative']
    },
    currentUsage: {
      type: Number,
      default: 0,
      min: [0, 'Current usage cannot be negative']
    },
    startDate: {
      type: Date,
      required: [true, 'Please provide a start date']
    },
    endDate: {
      type: Date,
      required: [true, 'Please provide an end date']
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isPrivate: {
      type: Boolean,
      default: false,
      description: 'If true, voucher can only be used by assigned users'
    },
    categoryIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      description: 'Categories eligible for this voucher'
    }],
    productIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      description: 'Products eligible for this voucher'
    }],
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

// Virtual for checking if voucher is expired
VoucherSchema.virtual('isExpired').get(function() {
  return this.endDate < new Date();
});

// Virtual for checking if voucher is active based on date range
VoucherSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return (
    this.isActive &&
    !this.isDeleted &&
    now >= this.startDate &&
    now <= this.endDate &&
    (this.maxUsage === 0 || this.currentUsage < this.maxUsage)
  );
});

// Virtual for user vouchers
VoucherSchema.virtual('userVouchers', {
  ref: 'UserVoucher',
  localField: '_id',
  foreignField: 'voucherId'
});

// Query middleware for soft delete
VoucherSchema.pre(/^find/, function(next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

// Increase usage count when voucher is used
VoucherSchema.methods.incrementUsage = async function() {
  this.currentUsage += 1;
  return this.save();
};

// Index for faster lookups
VoucherSchema.index({ code: 1 });
VoucherSchema.index({ startDate: 1, endDate: 1 });
VoucherSchema.index({ isActive: 1, isDeleted: 1 });

VoucherSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Voucher', VoucherSchema);
