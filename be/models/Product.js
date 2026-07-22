// models/Product.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a product name'],
      trim: true,
      maxlength: [100, 'Product name cannot exceed 100 characters']
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true
    },
    description: {
      type: String,
      required: [true, 'Please provide a product description'],
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Please provide a category']
    },
    basePrice: {
      type: Number,
      required: [true, 'Please provide a base price'],
      min: [0, 'Price cannot be negative']
    },
    images: [
      {
        url: {
          type: String,
          required: true
        },
        path: {
          type: String,
          description: 'Storage path or S3 key'
        },
        altText: String,
        isDefault: {
          type: Boolean,
          default: false
        }
      }
    ],
    sku: {
      type: String,
      required: [true, 'Please provide a SKU'],
      unique: true,
      trim: true
    },
    isCustomizable: {
      type: Boolean,
      default: false
    },
    stockQuantity: {
      type: Number,
      default: 0
    },
    popularity: {
      type: Number,
      default: 0
    },
    featured: {
      type: Boolean,
      default: false
    },
    tags: [String],
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: {
        type: String,
        enum: ['cm', 'inch'],
        default: 'cm'
      }
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    metadata: {
      type: Map,
      of: String
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for variants
ProductSchema.virtual('variants', {
  ref: 'ProductVariant',
  localField: '_id',
  foreignField: 'productId'
});

// Virtual for reviews
ProductSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'productId'
});

// Virtual for customizations
ProductSchema.virtual('customizations', {
  ref: 'ProductCustomization',
  localField: '_id',
  foreignField: 'productId'
});

// Method to calculate average rating
ProductSchema.virtual('averageRating').get(function() {
  if (this.reviews && this.reviews.length > 0) {
    const sum = this.reviews.reduce((total, review) => total + review.rating, 0);
    return (sum / this.reviews.length).toFixed(1);
  }
  return 0;
});

// Query middleware for soft delete
ProductSchema.pre(/^find/, function(next) {
  // this points to the current query
  this.find({ isDeleted: { $ne: true } });
  next();
});

// Index for text search
ProductSchema.index({ 
  name: 'text', 
  description: 'text',
  tags: 'text' 
});

// Create slug from the name
ProductSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});
ProductSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('Product', ProductSchema);