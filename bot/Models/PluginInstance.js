const mongoose = require('mongoose');

const pluginInstanceSchema = new mongoose.Schema({
  serverId: { type: String, required: true, index: true },
  instanceId: { type: String, required: true },
  protocolVersion: { type: String, required: true, maxlength: 32 },
  pluginVersion: { type: String, maxlength: 32 },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now, index: true },
  lastOnlinePlayers: { type: Number, default: 0, min: 0 },
  lastIpHash: { type: String, maxlength: 128 },
  status: { type: String, enum: ['online', 'degraded', 'offline'], default: 'online' },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });

pluginInstanceSchema.index({ serverId: 1, instanceId: 1 }, { unique: true });

module.exports = mongoose.models.ProMcBotPluginInstance || mongoose.model('ProMcBotPluginInstance', pluginInstanceSchema);
