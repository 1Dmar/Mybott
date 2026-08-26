const mongoose = require('mongoose');

const billingEventSchema = new mongoose.Schema({
  provider: { type: String, required: true },
  eventId: { type: String, required: true },
  eventType: { type: String, required: true },
  receivedAt: { type: Date, default: Date.now },
  processedAt: { type: Date, default: null },
  status: { type: String, enum: ['received', 'processed', 'failed'], default: 'received' },
  error: { type: String, maxlength: 500, default: null },
}, { timestamps: true });

billingEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.models.ProMcBotBillingEvent || mongoose.model('ProMcBotBillingEvent', billingEventSchema);
