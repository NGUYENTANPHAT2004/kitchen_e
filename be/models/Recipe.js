// models/Recipe.js
const mongoose = require('mongoose');
const slugify = require('slugify');
const mongoosePaginate = require('mongoose-paginate-v2');

const RecipeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Recipe title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters']
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true
    },
    description: {
      type: String,
      required: [true, 'Recipe description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    coverImage: {
      type: String
    },
    images: [String],
    preparationTime: {
      type: Number,
      min: [1, 'Preparation time must be at least 1 minute']
    },
    cookingTime: {
      type: Number,
      min: [0, 'Cooking time cannot be negative']
    },
    servings: {
      type: Number,
      min: [1, 'Servings must be at least 1']
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    },
    ingredients: [
      {
        name: {
          type: String,
          required: [true, 'Ingredient name is required']
        },
        quantity: {
          type: String
        },
        unit: {
          type: String
        },
        notes: {
          type: String
        }
      }
    ],
    instructions: [
      {
        step: {
          type: Number,
          required: [true, 'Step number is required']
        },
        description: {
          type: String,
          required: [true, 'Step description is required']
        },
        image: {
          type: String
        },
        timers: [
          {
            duration: Number,
            description: String
          }
        ]
      }
    ],
    nutritionInfo: {
      calories: Number,
      protein: Number,
      carbs: Number,
      fat: Number,
      fiber: Number,
      sugar: Number
    },
    cuisineType: {
      type: String,
      trim: true
    },
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'dessert', 'snack', 'appetizer', 'drink', 'other'],
      default: 'other'
    },
    tags: [String],
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    authorName: {
      type: String
    },
    source: {
      type: String,
      description: 'Source of the recipe if not original'
    },
    sourceUrl: {
      type: String,
      description: 'URL to the original recipe if from an external source'
    },
    isPublished: {
      type: Boolean,
      default: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    viewCount: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      min: [0, 'Rating cannot be negative'],
      max: [5, 'Rating cannot exceed 5'],
      default: 0
    },
    ratingCount: {
      type: Number,
      default: 0
    },
    userRatings: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        rating: Number,
        comment: String,
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    videoDemonstration: {
      type: String,
      description: 'URL to video demonstration'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for related products
RecipeSchema.virtual('relatedProducts', {
  ref: 'RecipeProductLink',
  localField: '_id',
  foreignField: 'recipeId'
});

// Create slug from title
RecipeSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
  }
  next();
});

// Middleware for soft delete
RecipeSchema.pre(/^find/, function(next) {
  if (!this.getOptions().includeDeleted) {
    this.find({ isDeleted: { $ne: true } });
  }
  
  // By default, only show published recipes
  if (!this.getOptions().includeUnpublished) {
    this.find({ isPublished: true });
  }
  
  next();
});

// Method to increment view count
RecipeSchema.methods.incrementViewCount = async function() {
  this.viewCount += 1;
  return this.save();
};

// Method to add user rating
RecipeSchema.methods.addRating = async function(userId, rating, comment = '') {
  // Find existing rating by this user
  const existingRatingIndex = this.userRatings.findIndex(
    r => r.userId.toString() === userId.toString()
  );
  
  if (existingRatingIndex >= 0) {
    // Update existing rating
    this.userRatings[existingRatingIndex].rating = rating;
    this.userRatings[existingRatingIndex].comment = comment;
    this.userRatings[existingRatingIndex].createdAt = new Date();
  } else {
    // Add new rating
    this.userRatings.push({
      userId,
      rating,
      comment,
      createdAt: new Date()
    });
    this.ratingCount += 1;
  }
  
  // Recalculate average rating
  if (this.ratingCount > 0) {
    const totalRating = this.userRatings.reduce((sum, item) => sum + item.rating, 0);
    this.rating = totalRating / this.ratingCount;
  }
  
  return this.save();
};

// Method to toggle like
RecipeSchema.methods.toggleLike = async function() {
  this.likes = (this.likes || 0) + 1;
  return this.save();
};

// Static method to get featured recipes
RecipeSchema.statics.getFeaturedRecipes = async function(limit = 5) {
  return this.find({
    isFeatured: true,
    isPublished: true,
    isDeleted: false
  })
    .sort({ rating: -1, viewCount: -1 })
    .limit(limit);
};

// Static method to get popular recipes
RecipeSchema.statics.getPopularRecipes = async function(limit = 10) {
  return this.find({
    isPublished: true,
    isDeleted: false
  })
    .sort({ viewCount: -1, rating: -1 })
    .limit(limit);
};

// Static method to search recipes
RecipeSchema.statics.searchRecipes = async function(query, filters = {}, limit = 20) {
  const searchQuery = {
    isPublished: true,
    isDeleted: false
  };
  
  // Text search if query provided
  if (query && query.trim()) {
    searchQuery.$text = { $search: query };
  }
  
  // Apply filters if provided
  if (filters.difficulty) {
    searchQuery.difficulty = filters.difficulty;
  }
  
  if (filters.mealType) {
    searchQuery.mealType = filters.mealType;
  }
  
  if (filters.cuisineType) {
    searchQuery.cuisineType = filters.cuisineType;
  }
  
  if (filters.maxTime) {
    searchQuery.$expr = {
      $lte: [{ $add: ['$preparationTime', '$cookingTime'] }, filters.maxTime]
    };
  }
  
  // Execute search
  const recipes = await this.find(searchQuery)
    .sort(query ? { score: { $meta: 'textScore' } } : { viewCount: -1 })
    .limit(limit);
  
  return recipes;
};

// Indexes for faster lookups
RecipeSchema.index({ slug: 1 });
RecipeSchema.index({ isPublished: 1, isDeleted: 1 });
RecipeSchema.index({ isFeatured: 1 });
RecipeSchema.index({ authorId: 1 });
RecipeSchema.index({ 
  title: 'text', 
  description: 'text',
  tags: 'text',
  'ingredients.name': 'text'
});
RecipeSchema.index({ mealType: 1 });
RecipeSchema.index({ difficulty: 1 });
RecipeSchema.index({ cuisineType: 1 });

RecipeSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('Recipe', RecipeSchema);
