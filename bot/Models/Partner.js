const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'PartnerApplication', required: true, index: true },
  status: { type: String, enum: ['ACTIVE', 'ENDED', 'SUSPENDED'], default: 'ACTIVE', index: true },
  startedAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date, required: true },
  endedAt: { type: Date, default: null },
  approvedBy: { type: String, required: true },
  discountPercentage: { type: Number, default: 25, min: 0, max: 100 },
  discountActive: { type: Boolean, default: true },
  partnerPro: {
    plan: { type: String, default: 'pro_premium' },
    durationDays: { type: Number, default: 90 },
    entitlementId: { type: String, default: null },
    grantedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    lastRenewedAt: { type: Date, default: null },
  },
}, { timestamps: true });
partnerSchema.index({ status: 1, expiresAt: 1 });
module.exports = mongoose.models.Partner || mongoose.model('Partner', partnerSchema);
