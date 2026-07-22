// models/Review.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const ReviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required']
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      description: 'Order ID if review is from a verified purchase'
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters']
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters']
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5']
    },
    images: [
      {
        url: String,
        caption: String
      }
    ],
    likes: {
      type: Number,
      default: 0
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false
    },
    isApproved: {
      type: Boolean,
      default: false
    },
    isRejected: {
      type: Boolean,
      default: false
    },
    rejectionReason: {
      type: String
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    productVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductVariant',
      description: 'Product variant if review is for a specific variant'
    },
    reportCount: {
      type: Number,
      default: 0
    },
    reports: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        reason: String,
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    adminResponse: {
      comment: String,
      createdAt: Date,
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Auto-approve reviews by default if not from a flagged user
ReviewSchema.pre('save', async function(next) {
  if (this.isNew && !this.isApproved && !this.isRejected) {
    // Check if user is flagged (has reports or suspicious activity)
    const User = mongoose.model('User');
    const user = await User.findById(this.userId);
    
    // Auto-approve if user is trusted, otherwise leave for manual approval
    if (user && !user.isFlagged) {
      this.isApproved = true;
    }
  }
  
  next();
});

// Middleware for soft delete
ReviewSchema.pre(/^find/, function(next) {
  if (!this.getOptions().includeDeleted) {
    this.find({ isDeleted: { $ne: true } });
  }
  
  // Only show approved reviews by default
  if (!this.getOptions().includeUnapproved) {
    this.find({ isApproved: true, isRejected: { $ne: true } });
  }
  
  next();
});

// After saving review, update product average rating
ReviewSchema.post('save', async function() {
  try {
    await updateProductRating(this.productId);
  } catch (error) {
    console.error('Failed to update product rating:', error);
  }
});

// After updating review, update product average rating
ReviewSchema.post('findOneAndUpdate', async function(doc) {
  try {
    if (doc) {
      await updateProductRating(doc.productId);
    }
  } catch (error) {
    console.error('Failed to update product rating after update:', error);
  }
});

// After deleting review, update product average rating
ReviewSchema.post('remove', async function() {
  try {
    await updateProductRating(this.productId);
  } catch (error) {
    console.error('Failed to update product rating after delete:', error);
  }
});

// Helper function to update product average rating
async function updateProductRating(productId) {
  try {
    const Review = mongoose.model('Review');
    const reviews = await Review.find({
      productId,
      isApproved: true,
      isDeleted: false
    });
    
    let avgRating = 0;
    let totalRating = 0;
    
    if (reviews.length > 0) {
      totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      avgRating = totalRating / reviews.length;
    }
    
    // Update product directly using updateOne to avoid additional middleware
    const Product = mongoose.model('Product');
    await Product.updateOne(
      { _id: productId },
      {
        $set: {
          averageRating: avgRating,
          reviewCount: reviews.length
        }
      }
    );
  } catch (error) {
    console.error('Error updating product rating:', error);
    throw error;
  }
}

// Method to report a review
ReviewSchema.methods.reportReview = async function(userId, reason) {
  // Check if user already reported this review
  const existingReport = this.reports.find(
    report => report.userId.toString() === userId.toString()
  );
  
  if (existingReport) {
    throw new Error('You have already reported this review');
  }
  
  // Add new report
  this.reports.push({
    userId,
    reason,
    createdAt: new Date()
  });
  
  this.reportCount = this.reports.length;
  
  // If report count exceeds threshold, automatically reject the review
  if (this.reportCount >= 5) {
    this.isApproved = false;
    this.isRejected = true;
    this.rejectionReason = 'Multiple reports received';
  }
  
  return this.save();
};

// Method to approve a review
ReviewSchema.methods.approveReview = async function(_adminId) {
  this.isApproved = true;
  this.isRejected = false;
  this.rejectionReason = '';
  
  return this.save();
};

// Method to reject a review
ReviewSchema.methods.rejectReview = async function(_adminId, reason) {
  this.isApproved = false;
  this.isRejected = true;
  this.rejectionReason = reason || 'Violated content guidelines';
  
  return this.save();
};

// Method to respond to a review (as admin/staff)
ReviewSchema.methods.respondToReview = async function(adminId, comment) {
  this.adminResponse = {
    comment,
    adminId,
    createdAt: new Date()
  };
  
  return this.save();
};

// Enforce unique review per user per product
ReviewSchema.index(
  { userId: 1, productId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } }
);

// Additional indexes for faster lookups
ReviewSchema.index({ productId: 1, createdAt: -1 });
ReviewSchema.index({ userId: 1, createdAt: -1 });
ReviewSchema.index({ orderId: 1 });
ReviewSchema.index({ rating: 1 });
ReviewSchema.index({ isApproved: 1, isRejected: 1 });

ReviewSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Review', ReviewSchema);