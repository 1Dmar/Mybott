const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  provider: { type: String, enum: ['paypal', 'manual'], required: true },
  providerPaymentId: { type: String, required: true, unique: true },
  providerEventId: { type: String, default: null, index: true },
  amountMinor: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  plan: { type: String, enum: ['pro', 'ultimate'], required: true },
  status: { type: String, enum: ['pending', 'succeeded', 'failed', 'refunded'], required: true },
  verifiedAt: { type: Date, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.models.ProMcBotPayment || mongoose.model('ProMcBotPayment', paymentSchema);
