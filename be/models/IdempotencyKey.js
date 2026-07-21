const mongoose = require('mongoose');

const IdempotencyKeySchema = new mongoose.Schema(
  {
    scope: { type: String, required: true },
    key: { type: String, required: true },
    ownerId: { type: String, required: true },
    requestHash: { type: String, required: true },
    status: {
      type: String,
      enum: ['processing', 'completed'],
      default: 'processing'
    },
    statusCode: Number,
    responseBody: mongoose.Schema.Types.Mixed,
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

IdempotencyKeySchema.index({ scope: 1, key: 1, ownerId: 1 }, { unique: true });
IdempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('IdempotencyKey', IdempotencyKeySchema);
