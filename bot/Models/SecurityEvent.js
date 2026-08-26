const mongoose = require('mongoose');

const securityEventSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  instanceId: { type: String, default: null, maxlength: 64 },
  event: { type: String, required: true, maxlength: 80 },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  evidence: { type: mongoose.Schema.Types.Mixed, default: {} },
  time: { type: Date, default: Date.now, index: true },
  source: { type: String, default: 'plugin_protocol', maxlength: 120 },
  action: { type: String, default: 'review', maxlength: 255 },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

securityEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
securityEventSchema.index({ guildId: 1, event: 1, time: -1 });

module.exports = mongoose.models.ProMcBotSecurityEvent || mongoose.model('ProMcBotSecurityEvent', securityEventSchema);
