const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  type: { type: String, enum: ['weekly_intelligence'], required: true },
  periodStart: { type: Date, required: true, index: true },
  periodEnd: { type: Date, required: true },
  generatedAt: { type: Date, default: Date.now },
  planAtGeneration: { type: String, enum: ['free', 'pro', 'ultimate'], required: true },
  report: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

reportSchema.index({ guildId: 1, type: 1, periodStart: 1 }, { unique: true });
reportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.ProMcBotReport || mongoose.model('ProMcBotReport', reportSchema);
