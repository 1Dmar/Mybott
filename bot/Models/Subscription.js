const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  plan: { type: String, enum: ['free', 'pro', 'ultimate'], default: 'free', required: true },
  status: { type: String, enum: ['active', 'trialing', 'past_due', 'cancelled', 'expired', 'grace_period'], default: 'active', required: true },
  provider: { type: String, enum: ['none', 'paypal', 'manual'], default: 'none' },
  providerCustomerId: { type: String, default: null, maxlength: 255 },
  providerSubscriptionId: { type: String, default: null, maxlength: 255 },
  currentPeriodStart: { type: Date, default: null },
  currentPeriodEnd: { type: Date, default: null, index: true },
  renewalState: { type: String, enum: ['auto_renew', 'will_cancel', 'not_applicable'], default: 'not_applicable' },
  cancellationAt: { type: Date, default: null },
  gracePeriodEnd: { type: Date, default: null },
  lastProviderEventId: { type: String, default: null, unique: true, sparse: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });

module.exports = mongoose.models.ProMcBotSubscription || mongoose.model('ProMcBotSubscription', subscriptionSchema);
