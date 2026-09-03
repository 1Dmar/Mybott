const Subscription = require('../Models/Subscription');
const UsageCounter = require('../Models/UsageCounter');
const { getEntitlement, hasFeature, getPlan } = require('./entitlements');

function periodKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

async function getForGuild(guildId, now = new Date()) {
  const subscription = await Subscription.findOne({ guildId }).lean();
  return getEntitlement(subscription, now);
}

async function requireFeature(guildId, featureKey, now = new Date()) {
  const entitlement = await getForGuild(guildId, now);
  return { allowed: hasFeature(entitlement, featureKey), featureKey, requiredPlan: require('../utils/entitlements').requiredPlanFor(featureKey), entitlement };
}

async function consumeUsage(guildId, feature, amount = 1, now = new Date()) {
  const entitlement = await getForGuild(guildId, now);
  const limit = entitlement.limits?.[feature];
  const period = periodKey(now);
  const current = await UsageCounter.findOne({ guildId, period, feature }).lean();
  const used = current?.used || 0;
  if (Number.isFinite(limit) && used + amount > limit) return { allowed: false, used, limit, period, entitlement };
  const updated = await UsageCounter.findOneAndUpdate({ guildId, period, feature }, { $inc: { used: amount }, $set: { updatedAt: now } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  return { allowed: true, used: updated.used, limit, period, entitlement };
}

async function releaseUsage(guildId, feature, amount = 1, now = new Date()) {
  const period = periodKey(now);
  const updated = await UsageCounter.findOneAndUpdate(
    { guildId, period, feature, used: { $gte: amount } },
    { $inc: { used: -amount }, $set: { updatedAt: now } },
    { new: true }
  ).lean();
  return updated?.used ?? 0;
}

async function ensureFreeSubscription(guildId) {
  return Subscription.findOneAndUpdate({ guildId }, { $setOnInsert: { guildId, plan: 'free', status: 'active', provider: 'none', renewalState: 'not_applicable' } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
}

module.exports = { periodKey, getForGuild, requireFeature, consumeUsage, releaseUsage, ensureFreeSubscription, getPlan };
