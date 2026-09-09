// models/Bundle.js
const mongoose = require("mongoose");
const slugify = require("slugify");
const mongoosePaginate = require("mongoose-paginate-v2");

const BundleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Bundle name is required"],
      trim: true,
      maxlength: [100, "Bundle name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, "Bundle description is required"],
      trim: true,
      maxlength: [1000, "Bundle description cannot exceed 1000 characters"],
    },
    image: {
      type: String,
    },
    imagePath: {
      type: String,
      description: "Storage path or S3 key for the image",
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"],
      validate: {
        validator(value) {
          const type =
            typeof this.get === "function"
              ? this.get("discountType")
              : this.discountType;
          return type !== "percentage" || value <= 100;
        },
        message: "Percentage discount cannot exceed 100%",
      },
    },
    totalPrice: {
      type: Number,
      default: 0,
      description: "Calculated total price of all items (before discount)",
    },
    finalPrice: {
      type: Number,
      default: 0,
      description: "Final price after discount",
    },
    isCustomizable: {
      type: Boolean,
      default: false,
      description: "Whether users can customize the bundle items",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    featuredOrder: {
      type: Number,
      default: 0,
      description: "Order for featured bundles (higher = more prominent)",
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    minItems: {
      type: Number,
      default: 1,
      description: "Minimum number of items for customizable bundles",
    },
    maxItems: {
      type: Number,
      description: "Maximum number of items for customizable bundles",
    },
    tags: [String],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for bundle items
BundleSchema.virtual("items", {
  ref: "BundleItem",
  localField: "_id",
  foreignField: "bundleId",
});

// Virtual to check if bundle is current
BundleSchema.virtual("isCurrent").get(function () {
  const now = new Date();
  return (
    this.isActive &&
    (!this.startDate || this.startDate <= now) &&
    (!this.endDate || this.endDate >= now)
  );
});

// Create slug from name
BundleSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });
  }
  next();
});

// Middleware for soft delete
BundleSchema.pre(/^find/, function (next) {
  if (!this.getOptions().includeDeleted) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

// Method to calculate bundle prices
BundleSchema.methods.calculatePrices = async function () {
  try {
    const BundleItem = mongoose.model("BundleItem");
    const items = await BundleItem.find({ bundleId: this._id })
      .populate({
        path: "productId",
        select: "basePrice",
      })
      .populate({
        path: "variantId",
        select: "priceAdjustment",
      });

    let totalPrice = 0;

    // Calculate total price of all items
    for (const item of items) {
      let itemPrice = item.productId ? item.productId.basePrice : 0;

      if (item.variantId && item.variantId.priceAdjustment) {
        itemPrice += item.variantId.priceAdjustment;
      }

      totalPrice += itemPrice * item.quantity;
    }

    this.totalPrice = totalPrice;

    // Calculate final price after discount
    if (this.discountType === "percentage") {
      this.finalPrice = totalPrice * (1 - this.discountValue / 100);
    } else {
      this.finalPrice = Math.max(0, totalPrice - this.discountValue);
    }

    // Round to 2 decimal places
    this.finalPrice = Math.round(this.finalPrice * 100) / 100;

    return this.save();
  } catch (error) {
    throw new Error(`Failed to calculate bundle prices: ${error.message}`);
  }
};

// Static method to get active bundles
BundleSchema.statics.getActiveBundles = async function (includeItems = true) {
  const now = new Date();

  const query = {
    isActive: true,
    isDeleted: false,
    startDate: { $lte: now },
    $or: [{ endDate: { $gte: now } }, { endDate: null }],
  };

  let bundles = includeItems
    ? await this.find(query).populate("items")
    : await this.find(query);

  return bundles;
};

// Static method to get featured bundles
BundleSchema.statics.getFeaturedBundles = async function (limit = 5) {
  const now = new Date();

  const query = {
    isActive: true,
    isDeleted: false,
    isFeatured: true,
    startDate: { $lte: now },
    $or: [{ endDate: { $gte: now } }, { endDate: null }],
  };

  const bundles = await this.find(query)
    .sort({ featuredOrder: -1, createdAt: -1 })
    .limit(limit)
    .populate("items");

  return bundles;
};

// Indexes for faster lookups
BundleSchema.index({ slug: 1 });
BundleSchema.index({ isActive: 1, isDeleted: 1 });
BundleSchema.index({ isFeatured: 1 });
BundleSchema.index({ startDate: 1, endDate: 1 });
BundleSchema.index({
  name: "text",
  description: "text",
  tags: "text",
});
BundleSchema.plugin(mongoosePaginate);
module.exports = mongoose.model("Bundle", BundleSchema);
