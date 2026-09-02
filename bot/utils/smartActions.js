'use strict';

const AutomationRule = require('../Models/AutomationRule');
const { getForGuild } = require('./entitlementService');
const { hasFeature } = require('./entitlements');

const SMART_ACTION_PRESETS = Object.freeze([
  {
    key: 'server_offline',
    name: 'Server Offline',
    icon: '🔴',
    description: 'Re-check the server and notify staff when measured heartbeat evidence remains stale.',
    trigger: 'server_offline',
    feature: 'automation.basic',
    defaultMessage: 'ProMcBot detected that the Minecraft server heartbeat is stale. Re-check the server and notify staff if it remains offline.',
    recommendation: 'The existing automation engine will re-check measured heartbeat evidence and send one bounded Discord notification.',
  },
  {
    key: 'server_recovered',
    name: 'Server Recovered',
    icon: '🟢',
    description: 'Notify staff when a server with an open offline alert sends a fresh heartbeat again.',
    trigger: 'server_recovered',
    feature: 'automation.basic',
    defaultMessage: 'ProMcBot detected a fresh Minecraft server heartbeat. The server appears to have recovered.',
    recommendation: 'The related open offline notification will be resolved when recovery evidence is measured.',
  },
  {
    key: 'telemetry_delayed',
    name: 'Telemetry Delayed',
    icon: '🟡',
    description: 'Warn staff when telemetry is delayed, without treating missing optional data as a false outage.',
    trigger: 'telemetry_delayed',
    feature: 'automation.basic',
    defaultMessage: 'ProMcBot has not received recent Minecraft telemetry. Check the plugin connection and server status.',
    recommendation: 'The alert is emitted only after a provisioned instance has exceeded the bounded telemetry delay window.',
  },
  {
    key: 'first_player',
    name: 'First Player',
    icon: '👋',
    description: 'Notify staff when the first measured player join event arrives in a quiet window.',
    trigger: 'first_player',
    feature: 'automation.basic',
    defaultMessage: 'ProMcBot recorded the first measured player join in the current activity window.',
    recommendation: 'The notification is based on a real player_join telemetry event and never invents player activity.',
  },
]);

function getSmartActionPreset(key) {
  return SMART_ACTION_PRESETS.find(preset => preset.key === String(key || '').trim()) || null;
}

function smartActionCatalog(rules, entitlement) {
  const byPreset = new Map((rules || []).filter(rule => rule.preset).map(rule => [rule.preset, rule]));
  return SMART_ACTION_PRESETS.map(preset => {
    const rule = byPreset.get(preset.key) || null;
    return {
      ...preset,
      enabled: Boolean(rule?.enabled),
      ruleId: rule ? String(rule._id) : null,
      channelId: rule?.channelId || null,
      status: rule?.enabled ? 'enabled' : rule ? 'disabled' : 'available',
      available: hasFeature(entitlement, preset.feature),
      requiredPlan: hasFeature(entitlement, preset.feature) ? entitlement.plan : 'free',
    };
  });
}

function validateSmartActionChannel(channelId) {
  const value = String(channelId || '').trim();
  return /^\d{15,25}$/.test(value) ? value : null;
}

async function getSmartActionState(guildId) {
  const [rules, entitlement] = await Promise.all([
    AutomationRule.find({ serverId: guildId, preset: { $exists: true } }).sort({ createdAt: -1 }).lean(),
    getForGuild(guildId),
  ]);
  return { rules, entitlement, catalog: smartActionCatalog(rules, entitlement) };
}

module.exports = {
  SMART_ACTION_PRESETS,
  getSmartActionPreset,
  smartActionCatalog,
  validateSmartActionChannel,
  getSmartActionState,
};
