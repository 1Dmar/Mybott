const mongoose = require('mongoose');

const automationRuleSchema = new mongoose.Schema({
  serverId: { type: String, required: true, index: true },
  name: { type: String, required: true, maxlength: 120 },
  enabled: { type: Boolean, default: true, index: true },
  trigger: { type: String, enum: ['activity_decline', 'weekly_summary', 'server_offline', 'server_recovered', 'telemetry_delayed', 'first_player', 'player_join', 'player_leave', 'player_count_high', 'player_count_low'], required: true },
  // Optional preset identifier. Legacy rules may omit this field.
  preset: { type: String, enum: ['server_offline', 'server_recovered', 'telemetry_delayed', 'first_player', 'player_join', 'player_leave', 'player_count_high', 'player_count_low', 'activity_decline', 'weekly_summary'], default: null, index: true },
  thresholdPercent: { type: Number, default: -5, min: -100, max: 100 },
  thresholdPlayers: { type: Number, default: 0, min: 0, max: 100000 },
  action: { type: String, enum: ['discord_message'], required: true },
  channelId: { type: String, required: true, maxlength: 32 },
  messageTemplate: { type: String, required: true, maxlength: 1500 },
  cooldownMinutes: { type: Number, default: 1440, min: 60, max: 43200 },
  createdBy: { type: String, required: true },
  lastTriggeredAt: { type: Date, default: null },
}, { timestamps: true });

automationRuleSchema.index({ serverId: 1, enabled: 1 });
automationRuleSchema.index({ serverId: 1, preset: 1 }, { sparse: true });

module.exports = mongoose.models.ProMcBotAutomationRule || mongoose.model('ProMcBotAutomationRule', automationRuleSchema);
