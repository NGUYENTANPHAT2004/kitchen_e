const mongoose = require('mongoose');

const PaymentWebhookEventSchema = new mongoose.Schema(
  {
    gateway: { type: String, required: true },
    eventId: { type: String, required: true },
    paymentId: { type: String, required: true },
    payloadHash: { type: String, required: true },
    status: {
      type: String,
      enum: ['received', 'processed', 'failed'],
      default: 'received'
    },
    processedAt: Date,
    errorMessage: String
  },
  { timestamps: true }
);

PaymentWebhookEventSchema.index({ gateway: 1, eventId: 1 }, { unique: true });
PaymentWebhookEventSchema.index({ paymentId: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentWebhookEvent', PaymentWebhookEventSchema);
