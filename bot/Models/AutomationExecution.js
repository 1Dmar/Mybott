const mongoose = require('mongoose');

const automationExecutionSchema = new mongoose.Schema({
  serverId: { type: String, required: true, index: true },
  ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProMcBotAutomationRule', required: true, index: true },
  trigger: { type: String, required: true },
  status: { type: String, enum: ['executed', 'skipped', 'failed', 'denied'], required: true },
  evidence: { type: mongoose.Schema.Types.Mixed, default: {} },
  message: { type: String, maxlength: 1500 },
  executedAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, required: true },
});

automationExecutionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.ProMcBotAutomationExecution || mongoose.model('ProMcBotAutomationExecution', automationExecutionSchema);
