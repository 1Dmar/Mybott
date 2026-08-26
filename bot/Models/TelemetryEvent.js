const mongoose = require('mongoose');

const telemetryEventSchema = new mongoose.Schema({
  serverId: { type: String, required: true, index: true },
  instanceId: { type: String, required: true, index: true },
  type: { type: String, required: true, maxlength: 64 },
  occurredAt: { type: Date, required: true, index: true },
  receivedAt: { type: Date, default: Date.now, index: true },
  requestId: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  expiresAt: { type: Date, required: true, index: true },
}, { minimize: true });

telemetryEventSchema.index({ serverId: 1, occurredAt: -1 });
telemetryEventSchema.index({ serverId: 1, type: 1, occurredAt: -1 });
telemetryEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.ProMcBotTelemetryEvent || mongoose.model('ProMcBotTelemetryEvent', telemetryEventSchema);
