const FEATURES = Object.freeze({
  'server.intelligence.basic': 'free',
  'server.intelligence.advanced': 'pro',
  'player.journey.basic': 'free',
  'player.journey.advanced': 'pro',
  'player.analytics.basic': 'free',
  'player.analytics.advanced': 'pro',
  'retention.basic': 'free',
  'retention.advanced': 'pro',
  'retention.cohort': 'pro',
  'automation.basic': 'free',
  'automation.advanced': 'pro',
  'automation.campaigns': 'pro',
  'network.intelligence': 'ultimate',
  'network.analytics': 'ultimate',
  'security.basic': 'free',
  'moderation.advanced': 'pro',
  'security.advanced': 'ultimate',
  'reports.basic': 'free',
  'reports.advanced': 'pro',
  'reports.network': 'ultimate',
  'notifications.basic': 'free',
  'notifications.advanced': 'pro',
  'notifications.network': 'ultimate',
});

const PLANS = Object.freeze({
  free: Object.freeze({ id: 'free', name: 'Free', priceUsdMonthly: 0, promise: 'Help small servers become better.', historyDays: 14, usage: Object.freeze({ automation: 3, reports: 4, telemetryEvents: 50000 }) }),
  pro: Object.freeze({ id: 'pro', name: 'Pro', priceUsdMonthly: 4.99, promise: 'Help me grow my server.', historyDays: 90, usage: Object.freeze({ automation: 20, reports: 10, telemetryEvents: 250000 }) }),
  ultimate: Object.freeze({ id: 'ultimate', name: 'Ultimate', priceUsdMonthly: 9.99, promise: 'Help me operate and scale my network.', historyDays: 365, usage: Object.freeze({ automation: 100, reports: 50, telemetryEvents: 1000000 }) }),
});

const PLAN_ORDER = Object.freeze(['free', 'pro', 'ultimate']);

function normalizePlan(plan) {
  const value = String(plan || '').toLowerCase();
  return value === 'premium' ? 'pro' : (PLANS[value] ? value : 'free');
}

function getPlan(plan) {
  return PLANS[normalizePlan(plan)];
}

function planAllows(plan, requiredPlan) {
  return PLAN_ORDER.indexOf(normalizePlan(plan)) >= PLAN_ORDER.indexOf(normalizePlan(requiredPlan));
}

function effectiveSubscription(subscription, now = new Date()) {
  if (!subscription) return { plan: 'free', status: 'active', reason: 'no_subscription' };
  const plan = normalizePlan(subscription.plan);
  if (plan === 'free') return { plan, status: subscription.status || 'active', reason: 'free_plan' };
  const periodEnd = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  const graceEnd = subscription.gracePeriodEnd ? new Date(subscription.gracePeriodEnd) : null;
  const current = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const periodValid = periodEnd && periodEnd.getTime() > current;
  const graceValid = graceEnd && graceEnd.getTime() > current;
  const activeState = ['active', 'trialing'].includes(subscription.status) && (!periodEnd || periodValid);
  const cancelledState = subscription.status === 'cancelled' && periodValid;
  const graceState = ['past_due', 'grace_period'].includes(subscription.status) && graceValid;
  if (activeState || cancelledState || graceState) return { plan, status: subscription.status, reason: graceState ? 'grace_period' : 'active' };
  return { plan: 'free', status: 'expired', reason: 'expired' };
}

function getEntitlement(subscription, now = new Date()) {
  const effective = effectiveSubscription(subscription, now);
  const catalog = getPlan(effective.plan);
  const featureAccess = Object.fromEntries(Object.entries(FEATURES).map(([key, requiredPlan]) => [key, planAllows(effective.plan, requiredPlan)]));
  return { plan: effective.plan, status: effective.status, reason: effective.reason, name: catalog.name, priceUsdMonthly: catalog.priceUsdMonthly, promise: catalog.promise, features: featureAccess, limits: catalog.usage, historyDays: catalog.historyDays, currentPeriodEnd: subscription?.currentPeriodEnd || null, gracePeriodEnd: subscription?.gracePeriodEnd || null, renewalState: subscription?.renewalState || 'not_applicable' };
}

function hasFeature(entitlement, featureKey) {
  return entitlement?.features?.[featureKey] === true;
}

function requiredPlanFor(featureKey) {
  return FEATURES[featureKey] || null;
}

module.exports = { FEATURES, PLANS, PLAN_ORDER, normalizePlan, getPlan, planAllows, effectiveSubscription, getEntitlement, hasFeature, requiredPlanFor };
