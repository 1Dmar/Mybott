'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const AutomationRule = require('../Models/AutomationRule');
const AutomationExecution = require('../Models/AutomationExecution');
const TelemetryEvent = require('../Models/TelemetryEvent');
const { createNotification } = require('./notificationService');
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

async function runRuleInternal(rule, discordClient, now = Date.now()) {
  const entitlement = await getForGuild(rule.serverId);
  const requiredFeature = rule.trigger === 'weekly_summary' ? 'automation.advanced' : 'automation.basic';
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
    await createNotification({ guildId: rule.serverId, type: 'automation_execution', priority: 'medium', title: 'Automation executed', message, source: `automation:${rule._id}`, action: '/actions', dedupeKey: dedupe, metadata: { ruleId: String(rule._id), evidence, resolutionStatus: 'open' } });
  } else {
    await createNotification({ guildId: rule.serverId, type: 'automation_failure', priority: 'high', title: 'Automation could not be delivered', message: 'The configured Discord channel was unavailable after bounded retries.', source: `automation:${rule._id}`, action: '/actions', dedupeKey: dedupe, metadata: { ruleId: String(rule._id), evidence, resolutionStatus: 'open' } });
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
