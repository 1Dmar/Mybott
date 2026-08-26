const mongoose = require('mongoose');

const pluginCredentialSchema = new mongoose.Schema({
  serverId: { type: String, required: true, index: true },
  instanceId: { type: String, required: true },
  accessTokenHash: { type: String, required: true },
  encryptedSigningSecret: { type: String, required: true },
  protocolVersion: { type: String, default: '1', maxlength: 32 },
  createdAt: { type: Date, default: Date.now },
  lastRotatedAt: { type: Date, default: Date.now },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });

pluginCredentialSchema.index({ serverId: 1, instanceId: 1 }, { unique: true });

module.exports = mongoose.models.ProMcBotPluginCredential || mongoose.model('ProMcBotPluginCredential', pluginCredentialSchema);
