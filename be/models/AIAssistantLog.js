// models/AIAssistantLog.js
const mongoose = require('mongoose');

const AIAssistantLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      description: 'User ID if logged in, null for anonymous users'
    },
    sessionId: {
      type: String,
      description: 'Session ID for anonymous users'
    },
    query: {
      type: String,
      required: [true, 'Query is required'],
      trim: true
    },
    response: {
      type: String,
      required: [true, 'Response is required']
    },
    intentType: {
      type: String,
      match: /^[a-z][a-z0-9_]{1,59}$/,
      default: 'general'
    },
    querySource: {
      type: String,
      enum: ['text', 'voice', 'suggestion', 'api'],
      default: 'text'
    },
    deviceInfo: {
      type: Object,
      description: 'Information about the device used'
    },
    responseTime: {
      type: Number,
      description: 'Time taken to generate response in milliseconds'
    },
    modelVersion: { type: String, default: null },
    intentConfidence: { type: Number, min: 0, max: 1, default: null },
    suggestedProducts: { type: [mongoose.Schema.Types.Mixed], default: [] },
    suggestedRecipes: { type: [mongoose.Schema.Types.Mixed], default: [] },
    suggestedActions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    feedback: {
      isHelpful: Boolean,
      comments: String,
      providedAt: Date
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for calculating response length
AIAssistantLogSchema.virtual('responseLength').get(function() {
  return this.response ? this.response.length : 0;
});

// Method to add user feedback
AIAssistantLogSchema.methods.addFeedback = async function(isHelpful, comments = '') {
  this.feedback = {
    isHelpful,
    comments,
    providedAt: new Date()
  };
  
  return this.save();
};

// Static method to get frequent queries
AIAssistantLogSchema.statics.getFrequentQueries = async function(limit = 10) {
  const frequentQueries = await this.aggregate([
    {
      $group: {
        _id: '$query',
        count: { $sum: 1 },
        intentTypes: { $addToSet: '$intentType' },
        lastAsked: { $max: '$createdAt' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
  
  return frequentQueries;
};

// Static method to get intent distribution
AIAssistantLogSchema.statics.getIntentDistribution = async function(startDate, endDate) {
  const match = {};
  
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }
  
  const intentDistribution = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$intentType',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  return intentDistribution;
};

// Static method to get feedback statistics
AIAssistantLogSchema.statics.getFeedbackStats = async function() {
  const feedbackStats = await this.aggregate([
    { $match: { 'feedback.isHelpful': { $exists: true } } },
    {
      $group: {
        _id: '$feedback.isHelpful',
        count: { $sum: 1 },
        intents: {
          $push: {
            intentType: '$intentType',
            query: '$query'
          }
        }
      }
    }
  ]);
  
  return feedbackStats;
};

// Indexes for faster lookups
AIAssistantLogSchema.index({ userId: 1, createdAt: -1 });
AIAssistantLogSchema.index({ sessionId: 1, createdAt: -1 });
AIAssistantLogSchema.index({ intentType: 1 });
AIAssistantLogSchema.index({ createdAt: 1 });
AIAssistantLogSchema.index({ 'feedback.isHelpful': 1 });

module.exports = mongoose.model('AIAssistantLog', AIAssistantLogSchema);
