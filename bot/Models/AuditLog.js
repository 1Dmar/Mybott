const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actorId: { type: String, default: null, index: true },
  guildId: { type: String, required: true, index: true },
  action: { type: String, required: true, maxlength: 120 },
  feature: { type: String, required: true, maxlength: 120 },
  timestamp: { type: Date, default: Date.now, index: true },
  result: { type: String, enum: ['success', 'failure', 'denied'], required: true },
  source: { type: String, required: true, maxlength: 120 },
  target: { type: String, default: null, maxlength: 255 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

auditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
auditLogSchema.index({ guildId: 1, timestamp: -1 });

module.exports = mongoose.models.ProMcBotAuditLog || mongoose.model('ProMcBotAuditLog', auditLogSchema);
