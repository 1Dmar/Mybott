const mongoose = require('mongoose');

const productEventSchema = new mongoose.Schema({
  event: { type: String, required: true, trim: true, maxlength: 80, index: true },
  userId: { type: String, required: true, trim: true, maxlength: 40, index: true },
  guildId: { type: String, default: null, trim: true, maxlength: 40, index: true },
  path: { type: String, default: null, maxlength: 240 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), index: true },
}, { versionKey: false });

productEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
productEventSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.models.ProMcBotProductEvent || mongoose.model('ProMcBotProductEvent', productEventSchema);
