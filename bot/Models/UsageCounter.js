const mongoose = require('mongoose');

const usageCounterSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  period: { type: String, required: true },
  feature: { type: String, required: true, maxlength: 128 },
  used: { type: Number, default: 0, min: 0 },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

usageCounterSchema.index({ guildId: 1, period: 1, feature: 1 }, { unique: true });

module.exports = mongoose.models.ProMcBotUsageCounter || mongoose.model('ProMcBotUsageCounter', usageCounterSchema);
