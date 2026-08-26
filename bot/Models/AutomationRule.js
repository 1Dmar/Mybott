const mongoose = require('mongoose');

const automationRuleSchema = new mongoose.Schema({
  serverId: { type: String, required: true, index: true },
  name: { type: String, required: true, maxlength: 120 },
  enabled: { type: Boolean, default: true, index: true },
  trigger: { type: String, enum: ['activity_decline', 'weekly_summary'], required: true },
  thresholdPercent: { type: Number, default: -5, min: -100, max: 100 },
  action: { type: String, enum: ['discord_message'], required: true },
  channelId: { type: String, required: true, maxlength: 32 },
  messageTemplate: { type: String, required: true, maxlength: 1500 },
  cooldownMinutes: { type: Number, default: 1440, min: 60, max: 43200 },
  createdBy: { type: String, required: true },
  lastTriggeredAt: { type: Date, default: null },
}, { timestamps: true });

automationRuleSchema.index({ serverId: 1, enabled: 1 });

module.exports = mongoose.models.ProMcBotAutomationRule || mongoose.model('ProMcBotAutomationRule', automationRuleSchema);
