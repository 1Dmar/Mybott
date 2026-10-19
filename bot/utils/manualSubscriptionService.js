const { PLAN_ORDER, normalizePlan } = require('./entitlements');

const GUILD_ID_PATTERN = /^\d{5,25}$/;
const MAX_GRANT_DAYS = 3650;
const MAX_COOLDOWN_HOURS = 24 * 365;

function serviceError(code, message, status = 400, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  Object.assign(error, details);
  return error;
}

function validateManualGrantInput(input = {}) {
  const guildId = String(input.guildId || '').trim();
  const plan = normalizePlan(input.plan);
  const durationDays = Number(input.durationDays);
  const cooldownHours = Number(input.cooldownHours);
  if (!GUILD_ID_PATTERN.test(guildId)) throw serviceError('invalid_guild_id', 'Enter a valid Discord server ID.', 400);
  if (!['pro', 'ultimate'].includes(plan)) throw serviceError('invalid_manual_plan', 'Manual grants support Pro or Ultimate only.', 400);
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > MAX_GRANT_DAYS) throw serviceError('invalid_grant_duration', `Grant duration must be between 1 and ${MAX_GRANT_DAYS} days.`, 400);
  if (!Number.isInteger(cooldownHours) || cooldownHours < 1 || cooldownHours > MAX_COOLDOWN_HOURS) throw serviceError('invalid_grant_cooldown', `Cooldown must be between 1 and ${MAX_COOLDOWN_HOURS} hours.`, 400);
  return { guildId, plan, durationDays, cooldownHours };
}

function calculateManualGrantWindow({ currentPeriodEnd, durationDays, now = new Date() }) {
  const start = new Date(now);
  const currentEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  const base = currentEnd && currentEnd > start ? currentEnd : start;
  const end = new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);
  return { start, end };
}

async function grantManualSubscription(input, adminId, now = new Date()) {
  const Subscription = require('../Models/Subscription');
  const values = validateManualGrantInput(input);
  const actorId = String(adminId || '').trim();
  if (!/^\d{5,25}$/.test(actorId)) throw serviceError('invalid_admin_id', 'The admin identity is invalid.', 400);

  const existing = await Subscription.findOne({ guildId: values.guildId });
  const cooldownUntil = existing?.manualGrantCooldownUntil ? new Date(existing.manualGrantCooldownUntil) : null;
  if (cooldownUntil && cooldownUntil > now) {
    throw serviceError('manual_grant_cooldown', 'This server is still on manual grant cooldown.', 409, { cooldownUntil, retryAfterMs: cooldownUntil.getTime() - now.getTime() });
  }
  if (existing?.provider === 'paypal' || existing?.providerSubscriptionId) {
    throw serviceError('paid_subscription_exists', 'This server has a provider subscription. Cancel or manage it through billing before using a manual grant.', 409);
  }

  const currentPlan = normalizePlan(existing?.plan);
  const plan = PLAN_ORDER.indexOf(values.plan) >= PLAN_ORDER.indexOf(currentPlan) ? values.plan : currentPlan;
  const window = calculateManualGrantWindow({ currentPeriodEnd: existing?.currentPeriodEnd, durationDays: values.durationDays, now });
  const nextCooldown = new Date(now.getTime() + values.cooldownHours * 60 * 60 * 1000);
  const metadata = {
    ...(existing?.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
    paymentVerified: true,
    entitlementSource: 'admin_manual_grant',
    lastManualGrantPlan: values.plan,
    lastManualGrantDays: values.durationDays,
    lastManualGrantBy: actorId,
    lastManualGrantAt: now.toISOString(),
  };
  const subscription = await Subscription.findOneAndUpdate(
    { guildId: values.guildId },
    {
      $set: {
        plan,
        status: 'active',
        provider: 'manual',
        providerCustomerId: null,
        providerSubscriptionId: null,
        currentPeriodStart: existing?.currentPeriodStart && new Date(existing.currentPeriodStart) < now ? existing.currentPeriodStart : window.start,
        currentPeriodEnd: window.end,
        renewalState: 'not_applicable',
        cancellationAt: null,
        gracePeriodEnd: null,
        manualGrantCooldownUntil: nextCooldown,
        lastManualGrantAt: now,
        lastManualGrantBy: actorId,
        metadata,
      },
      $inc: { manualGrantCount: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  ).lean();
  return { subscription, requestedPlan: values.plan, appliedPlan: plan, grantStart: window.start, grantEnd: window.end, cooldownUntil: nextCooldown };
}

module.exports = { GUILD_ID_PATTERN, MAX_GRANT_DAYS, MAX_COOLDOWN_HOURS, validateManualGrantInput, calculateManualGrantWindow, grantManualSubscription };
