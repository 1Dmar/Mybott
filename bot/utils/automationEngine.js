const AutomationRule = require('../Models/AutomationRule');
const AutomationExecution = require('../Models/AutomationExecution');
const TelemetryEvent = require('../Models/TelemetryEvent');
const { summarizeTelemetry, WINDOW_MS } = require('./intelligenceEngine');

function renderMessage(template, summary) {
  const activity = summary.analysis.find(item => item.key === 'activity_trend');
  const value = activity ? `${activity.changePercent.toFixed(2)}%` : 'measured decline';
  return String(template || 'ProMcBot detected a measured activity decline: {{activityChange}}.')
    .replaceAll('{{activityChange}}', value)
    .slice(0, 1500);
}

async function runRule(rule, discordClient, now = Date.now()) {
  if (!rule?.enabled) return { status: 'skipped', reason: 'disabled' };
  if (rule.lastTriggeredAt && now - new Date(rule.lastTriggeredAt).getTime() < rule.cooldownMinutes * 60 * 1000) {
    return { status: 'skipped', reason: 'cooldown' };
  }
  const events = await TelemetryEvent.find({ serverId: rule.serverId, occurredAt: { $gte: new Date(now - WINDOW_MS * 2), $lt: new Date(now) } }).lean();
  const summary = summarizeTelemetry(events, now);
  const activity = summary.analysis.find(item => item.key === 'activity_trend');
  const evidence = { confidence: summary.confidence, sample: summary.sample, activityChange: activity?.changePercent ?? null };
  if (!activity || summary.confidence === 'insufficient' || activity.changePercent > rule.thresholdPercent) {
    await AutomationExecution.create({ serverId: rule.serverId, ruleId: rule._id, trigger: rule.trigger, status: 'skipped', evidence, message: 'No evidence-supported trigger condition was met.', expiresAt: new Date(now + 90 * 24 * 60 * 60 * 1000) });
    return { status: 'skipped', reason: 'condition_not_met', evidence };
  }
  const message = renderMessage(rule.messageTemplate, summary);
  let delivered = false;
  try {
    const channel = discordClient?.channels?.cache?.get(rule.channelId);
    if (channel && typeof channel.send === 'function') {
      await channel.send({ content: message, allowedMentions: { parse: [] } });
      delivered = true;
    }
  } catch (_) {}
  const status = delivered ? 'executed' : 'failed';
  await AutomationExecution.create({ serverId: rule.serverId, ruleId: rule._id, trigger: rule.trigger, status, evidence, message, expiresAt: new Date(now + 90 * 24 * 60 * 60 * 1000) });
  if (delivered) await AutomationRule.updateOne({ _id: rule._id }, { $set: { lastTriggeredAt: new Date(now) } });
  return { status, evidence, message };
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

module.exports = { runRule, runEnabledRules, renderMessage };
