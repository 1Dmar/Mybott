const mongoose = require('mongoose');

const pluginNonceSchema = new mongoose.Schema({
  nonce: { type: String, required: true, unique: true },
  serverId: { type: String, required: true, index: true },
  instanceId: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

pluginNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.ProMcBotPluginNonce || mongoose.model('ProMcBotPluginNonce', pluginNonceSchema);
