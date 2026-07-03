// models/FlashSale.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const FlashSaleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a flash sale name'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    startDate: {
      type: Date,
      required: [true, 'Please provide a start date']
    },
    endDate: {
      type: Date,
      required: [true, 'Please provide an end date']
    },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'ended', 'cancelled'],
      default: 'scheduled'
    },
    bannerImage: {
      type: String
    },
    isActive: {
      type: Boolean,
      default: true
    },
    priority: {
      type: Number,
      default: 0
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

// Virtual for items in flash sale
FlashSaleSchema.virtual('items', {
  ref: 'FlashSaleItem',
  localField: '_id',
  foreignField: 'flashSaleId'
});

// Check if flash sale is currently active
FlashSaleSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return this.startDate <= now && this.endDate >= now && this.status === 'active';
});

// Query middleware for soft delete
FlashSaleSchema.pre(/^find/, function(next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

// Auto-update status based on dates
FlashSaleSchema.pre('save', function(next) {
  const now = new Date();
  
  if (this.isActive) {
    if (now < this.startDate) {
      this.status = 'scheduled';
    } else if (now >= this.startDate && now <= this.endDate) {
      this.status = 'active';
    } else if (now > this.endDate) {
      this.status = 'ended';
    }
  } else {
    this.status = 'cancelled';
  }
  
  next();
});

FlashSaleSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('FlashSale', FlashSaleSchema);