'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const AutomationRule = require('../Models/AutomationRule');
const AutomationExecution = require('../Models/AutomationExecution');
const TelemetryEvent = require('../Models/TelemetryEvent');
const PluginInstance = require('../Models/PluginInstance');
const Notification = require('../Models/Notification');
const { createNotification, resolveOpenByDedupeKey } = require('./notificationService');
const { summarizeTelemetry, WINDOW_MS } = require('./intelligenceEngine');
const { getForGuild } = require('./entitlementService');
const { hasFeature } = require('./entitlements');

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const LOCK_LEASE_MS = 5 * 60 * 1000;
const LOCK_OWNER = `${process.pid}:${crypto.randomUUID()}`;
const LOCK_COLLECTION = 'promcbot_automation_locks';
const activeRuleExecutions = new Set();
let lockIndexesReady;

function tryAcquireExecutionSlot(ruleId) {
  const key = String(ruleId || '').trim();
  if (!key || activeRuleExecutions.has(key)) return false;
  activeRuleExecutions.add(key);
  return true;
}

function releaseExecutionSlot(ruleId) {
  activeRuleExecutions.delete(String(ruleId || '').trim());
}

function automationLockKey(rule, now) {
  return `automation:${String(rule?.serverId || '').trim()}:${String(rule?._id || '').trim()}:${dedupeKey(rule, now)}`;
}

async function acquireDistributedLock(lockKey, now = Date.now()) {
  if (mongoose.connection.readyState !== 1 || !lockKey) return false;
  const collection = mongoose.connection.collection(LOCK_COLLECTION);
  if (!lockIndexesReady) {
    lockIndexesReady = Promise.all([
      collection.createIndex({ lockKey: 1 }, { unique: true }),
      collection.createIndex({ leaseUntil: 1 }, { expireAfterSeconds: 3600 }),
    ]);
  }
  await lockIndexesReady;
  try {
    const result = await collection.findOneAndUpdate(
      { lockKey, $or: [{ leaseUntil: { $lte: new Date(now) } }, { leaseUntil: { $exists: false } }] },
      { $set: { lockKey, owner: LOCK_OWNER, leaseUntil: new Date(now + LOCK_LEASE_MS), updatedAt: new Date(now) }, $setOnInsert: { createdAt: new Date(now) } },
      { upsert: true, returnDocument: 'after' },
    );
    return result?.value?.owner === LOCK_OWNER || result?.owner === LOCK_OWNER;
  } catch (error) {
    if (error?.code === 11000) return false;
    throw error;
  }
}

async function releaseDistributedLock(lockKey) {
  if (mongoose.connection.readyState !== 1 || !lockKey) return;
  await mongoose.connection.collection(LOCK_COLLECTION).deleteOne({ lockKey, owner: LOCK_OWNER });
}

function renderMessage(template, summary) {
  const activity = summary.analysis.find(item => item.key === 'activity_trend');
  const value = activity ? `${activity.changePercent.toFixed(2)}%` : 'measured decline';
  return String(template || 'ProMcBot detected a measured activity decline: {{activityChange}}.')
    .replaceAll('{{activityChange}}', value)
    .slice(0, 1500);
}

function weekKey(now) {
  const date = new Date(now);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function dedupeKey(rule, now) {
  if (rule.preset) return `${rule._id}:smart:${rule.preset}:${Math.floor(now / (5 * 60 * 1000))}`;
  if (rule.trigger === 'weekly_summary') return `${rule._id}:weekly:${weekKey(now)}`;
  return `${rule._id}:activity:${Math.floor(now / WINDOW_MS)}`;
}

async function deliverWithRetry(channel, payload, attempts = 3) {
  if (!channel || typeof channel.send !== 'function') return false;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await channel.send(payload);
      return true;
    } catch (error) {
      if (attempt === attempts) return false;
      await new Promise(resolve => setTimeout(resolve, attempt * 250));
    }
  }
  return false;
}

async function writeExecution({ rule, now, status, evidence, message, dedupe }) {
  return AutomationExecution.create({
    serverId: rule.serverId,
    ruleId: rule._id,
    trigger: rule.trigger,
    status,
    dedupeKey: dedupe,
    evidence,
    message,
    executedAt: new Date(now),
    expiresAt: new Date(now + RETENTION_MS),
  });
}

async function runRule(rule, discordClient, now = Date.now()) {
  if (!rule?.enabled) return { status: 'skipped', reason: 'disabled' };
  const executionKey = String(rule._id || '').trim();
  if (!tryAcquireExecutionSlot(executionKey)) return { status: 'skipped', reason: 'already_running' };
  const lockKey = automationLockKey(rule, now);
  let distributedLock;
  try {
    distributedLock = await acquireDistributedLock(lockKey, now);
    if (!distributedLock) return { status: 'skipped', reason: 'lock_unavailable' };
    return await runRuleInternal(rule, discordClient, now);
  } finally {
    if (distributedLock) await releaseDistributedLock(lockKey).catch(() => null);
    releaseExecutionSlot(executionKey);
  }
}

async function runSmartPreset(rule, discordClient, now, dedupe) {
  const preset = String(rule.preset || '').trim();
  const plugin = await PluginInstance.findOne({ serverId: rule.serverId, revokedAt: null }).sort({ lastSeenAt: -1 }).lean();
  const lastSeenAt = plugin?.lastSeenAt ? new Date(plugin.lastSeenAt).getTime() : null;
  const ageMs = lastSeenAt === null ? null : Math.max(0, now - lastSeenAt);
  const fresh = ageMs !== null && ageMs <= 10 * 60 * 1000;
  const stale = ageMs === null || ageMs > 10 * 60 * 1000;
  let evidence = { preset, pluginProvisioned: Boolean(plugin), lastSeenAt: plugin?.lastSeenAt || null, telemetryAgeSeconds: ageMs === null ? null : Math.round(ageMs / 1000), measuredAt: new Date(now).toISOString() };
  let conditionMet = false;
  let message = String(rule.messageTemplate || '').slice(0, 1500);
  let notificationDedupe = `smart:${rule.serverId}:${preset}:open`;

  if (preset === 'server_offline') {
    conditionMet = Boolean(plugin && stale);
    message = `${rule.messageTemplate || 'ProMcBot detected that the Minecraft server heartbeat is stale.'} Last measured heartbeat: ${plugin?.lastSeenAt ? new Date(plugin.lastSeenAt).toISOString() : 'not measured'}.`;
  } else if (preset === 'telemetry_delayed') {
    conditionMet = Boolean(plugin && (ageMs === null || ageMs > 15 * 60 * 1000));
    message = `${rule.messageTemplate || 'ProMcBot has not received recent Minecraft telemetry.'} No fresh heartbeat has been measured within the expected window.`;
  } else if (preset === 'server_recovered') {
    const offlineKey = `smart:${rule.serverId}:server_offline:open`;
    const openOffline = await Notification.findOne({ guildId: rule.serverId, dedupeKey: offlineKey, status: { $ne: 'resolved' } }).lean();
    conditionMet = Boolean(plugin && fresh && openOffline);
    message = `${rule.messageTemplate || 'ProMcBot detected a fresh Minecraft server heartbeat. The server appears to have recovered.'} Last measured heartbeat: ${fresh ? new Date(lastSeenAt).toISOString() : 'not measured'}.`;
    notificationDedupe = `smart:${rule.serverId}:server_recovered:${Math.floor(now / (60 * 60 * 1000))}`;
  } else if (preset === 'first_player') {
    const event = await TelemetryEvent.findOne({ serverId: rule.serverId, type: 'player_join', occurredAt: { $gte: new Date(now - 5 * 60 * 1000), $lt: new Date(now) } }).sort({ occurredAt: -1 }).lean();
    conditionMet = Boolean(event);
    evidence = { ...evidence, eventId: event?._id ? String(event._id) : null, occurredAt: event?.occurredAt || null };
    notificationDedupe = event?._id ? `smart:${rule.serverId}:${preset}:${event._id}` : `smart:${rule.serverId}:${preset}:${Math.floor(now / (5 * 60 * 1000))}`;
    message = rule.messageTemplate || 'ProMcBot recorded the first measured player join in the current activity window.';
  } else if (['player_join', 'player_leave'].includes(preset)) {
    const event = await TelemetryEvent.findOne({ serverId: rule.serverId, type: preset, occurredAt: { $gte: new Date(now - 5 * 60 * 1000), $lt: new Date(now) } }).sort({ occurredAt: -1 }).lean();
    conditionMet = Boolean(event);
    evidence = { ...evidence, eventId: event?._id ? String(event._id) : null, occurredAt: event?.occurredAt || null, username: event?.data?.username || null };
    notificationDedupe = event?._id ? `smart:${rule.serverId}:${preset}:${event._id}` : `smart:${rule.serverId}:${preset}:${Math.floor(now / (5 * 60 * 1000))}`;
    message = `${rule.messageTemplate || (preset === 'player_join' ? 'A player joined the Minecraft server.' : 'A player left the Minecraft server.')} ${event?.data?.username ? `Player: ${event.data.username}.` : ''}`.trim();
  } else if (['player_count_high', 'player_count_low'].includes(preset)) {
    const event = await TelemetryEvent.findOne({ serverId: rule.serverId, type: 'player_count', occurredAt: { $gte: new Date(now - 10 * 60 * 1000), $lt: new Date(now) } }).sort({ occurredAt: -1 }).lean();
    const count = Number(event?.data?.onlinePlayers);
    conditionMet = Number.isFinite(count) && (preset === 'player_count_high' ? count >= 10 : count <= 1);
    evidence = { ...evidence, eventId: event?._id ? String(event._id) : null, onlinePlayers: Number.isFinite(count) ? count : null, occurredAt: event?.occurredAt || null };
    notificationDedupe = event?._id ? `smart:${rule.serverId}:${preset}:${event._id}` : `smart:${rule.serverId}:${preset}:${Math.floor(now / (10 * 60 * 1000))}`;
    message = `${rule.messageTemplate || (preset === 'player_count_high' ? 'The measured online player count is high.' : 'The measured online player count is low.')} Current measured players: ${Number.isFinite(count) ? count : 'not measured'}.`;
  }

  if (!conditionMet) return { status: 'skipped', reason: 'condition_not_met', evidence, dedupeKey: dedupe };
  const channel = discordClient?.channels?.cache?.get(rule.channelId);
  const safeMessage = message.slice(0, 1500);
  const delivered = await deliverWithRetry(channel, { content: safeMessage, allowedMentions: { parse: [] } });
  const status = delivered ? 'executed' : 'failed';
  await writeExecution({ rule, now, status, dedupe, evidence, message: safeMessage });
  if (delivered) {
    await AutomationRule.updateOne({ _id: rule._id }, { $set: { lastTriggeredAt: new Date(now) } });
    if (preset === 'server_recovered') await resolveOpenByDedupeKey(rule.serverId, `smart:${rule.serverId}:server_offline:open`);
    await createNotification({ guildId: rule.serverId, type: `smart_action_${preset}`, priority: preset === 'server_offline' ? 'high' : 'medium', title: rule.name, message: safeMessage, source: `smart_action:${preset}`, action: '/smart-actions', dedupeKey: notificationDedupe, metadata: { preset, evidence, resolutionStatus: preset === 'server_recovered' ? 'resolved' : 'open' } });
  } else {
    await createNotification({ guildId: rule.serverId, type: 'smart_action_failure', priority: 'high', title: `${rule.name} failed`, message: 'The configured Discord channel was unavailable after bounded retries.', source: `smart_action:${preset}`, action: '/smart-actions', dedupeKey: `${notificationDedupe}:failure`, metadata: { preset, evidence, resolutionStatus: 'open' } });
  }
  return { status, evidence, message: safeMessage, dedupeKey: dedupe };
}

async function runRuleInternal(rule, discordClient, now = Date.now()) {
  const entitlement = await getForGuild(rule.serverId);
  const requiredFeature = rule.trigger === 'weekly_summary' || rule.preset === 'weekly_summary' ? 'automation.advanced' : 'automation.basic';
  const dedupe = dedupeKey(rule, now);

  const prior = await AutomationExecution.findOne({ ruleId: rule._id, dedupeKey: dedupe, status: { $in: ['executed', 'failed'] } }).lean();
  if (prior) return { status: 'skipped', reason: 'deduplicated', dedupeKey: dedupe };

  if (!hasFeature(entitlement, requiredFeature)) {
    await writeExecution({ rule, now, status: 'denied', dedupe, evidence: { reason: 'entitlement_expired', requiredFeature, plan: entitlement.plan }, message: 'Automation was not executed because the current entitlement does not include this feature.' });
    return { status: 'denied', reason: 'entitlement_expired', dedupeKey: dedupe };
  }
  if (rule.lastTriggeredAt && now - new Date(rule.lastTriggeredAt).getTime() < rule.cooldownMinutes * 60 * 1000) {
    return { status: 'skipped', reason: 'cooldown', dedupeKey: dedupe };
  }

  if (rule.preset && ['server_offline', 'server_recovered', 'telemetry_delayed', 'first_player', 'player_join', 'player_leave', 'player_count_high', 'player_count_low'].includes(rule.preset)) return runSmartPreset(rule, discordClient, now, dedupe);

  const events = await TelemetryEvent.find({ serverId: rule.serverId, occurredAt: { $gte: new Date(now - WINDOW_MS * 2), $lt: new Date(now) } }).lean();
  const summary = summarizeTelemetry(events, now);
  const activity = summary.analysis.find(item => item.key === 'activity_trend');
  const evidence = { confidence: summary.confidence, sample: summary.sample, activityChange: activity?.changePercent ?? null, generatedAt: summary.generatedAt };
  const isWeekly = rule.trigger === 'weekly_summary';
  const conditionMet = isWeekly
    ? summary.confidence !== 'insufficient'
    : Boolean(activity && summary.confidence !== 'insufficient' && activity.changePercent <= rule.thresholdPercent);
  if (!conditionMet) return { status: 'skipped', reason: 'condition_not_met', evidence, dedupeKey: dedupe };

  const message = isWeekly
    ? `PRO MCBOT WEEKLY INTELLIGENCE\nActivity: ${activity ? `${activity.changePercent.toFixed(2)}%` : 'not measured'}\nConfidence: ${summary.confidence}\nAction: Review the evidence in the Intelligence dashboard.`
    : renderMessage(rule.messageTemplate, summary);
  const channel = discordClient?.channels?.cache?.get(rule.channelId);
  const delivered = await deliverWithRetry(channel, { content: message, allowedMentions: { parse: [] } });
  const status = delivered ? 'executed' : 'failed';
  await writeExecution({ rule, now, status, dedupe, evidence, message });
  if (delivered) {
    await AutomationRule.updateOne({ _id: rule._id }, { $set: { lastTriggeredAt: new Date(now) } });
    await createNotification({ guildId: rule.serverId, type: 'automation_execution', priority: 'medium', title: 'Automation executed', message, source: `automation:${rule._id}`, action: '/smart-actions', dedupeKey: dedupe, metadata: { ruleId: String(rule._id), evidence, resolutionStatus: 'open' } });
  } else {
    await createNotification({ guildId: rule.serverId, type: 'automation_failure', priority: 'high', title: 'Automation could not be delivered', message: 'The configured Discord channel was unavailable after bounded retries.', source: `automation:${rule._id}`, action: '/smart-actions', dedupeKey: dedupe, metadata: { ruleId: String(rule._id), evidence, resolutionStatus: 'open' } });
  }
  return { status, evidence, message, dedupeKey: dedupe };
}

async function runEnabledRules(discordClient) {
  const rules = await AutomationRule.find({ enabled: true }).limit(250).lean();
  const results = [];
  for (const rule of rules) {
    try { results.push({ ruleId: rule._id, ...(await runRule(rule, discordClient)) }); }
    catch (error) { results.push({ ruleId: rule._id, status: 'failed', reason: 'engine_error' }); }
  }
  return results;
}

module.exports = { runRule, runEnabledRules, renderMessage, dedupeKey, deliverWithRetry, tryAcquireExecutionSlot, releaseExecutionSlot, automationLockKey, acquireDistributedLock, releaseDistributedLock };
