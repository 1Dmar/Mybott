const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProMcBotSubscription', required: true, index: true },
  provider: { type: String, enum: ['stripe', 'paypal', 'manual'], required: true },
  providerInvoiceId: { type: String, required: true, unique: true },
  amountMinor: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  status: { type: String, enum: ['draft', 'open', 'paid', 'void', 'uncollectible'], required: true },
  hostedUrl: { type: String, default: null, maxlength: 2048 },
  issuedAt: { type: Date, default: null },
  paidAt: { type: Date, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.models.ProMcBotInvoice || mongoose.model('ProMcBotInvoice', invoiceSchema);
