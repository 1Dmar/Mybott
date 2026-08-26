const crypto = require('crypto');
const Subscription = require('../Models/Subscription');
const Payment = require('../Models/Payment');
const Invoice = require('../Models/Invoice');
const BillingEvent = require('../Models/BillingEvent');
const { normalizePlan } = require('./entitlements');

const WEBHOOK_TOLERANCE_SECONDS = 300;

function timingSafeHex(expected, actual) {
  const a = Buffer.from(String(expected || ''), 'utf8');
  const b = Buffer.from(String(actual || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyStripeSignature(rawBody, signatureHeader, secret, now = Math.floor(Date.now() / 1000)) {
  if (!rawBody || !signatureHeader || !secret) return { valid: false, reason: 'missing_signature_configuration' };
  const parts = Object.fromEntries(String(signatureHeader).split(',').map(part => part.split('=').map(item => item.trim())).filter(pair => pair.length === 2));
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > WEBHOOK_TOLERANCE_SECONDS || !parts.v1) return { valid: false, reason: 'stale_or_malformed_signature' };
  const payload = `${timestamp}.${Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody)}`;
  const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  return { valid: timingSafeHex(expected, parts.v1), reason: timingSafeHex(expected, parts.v1) ? 'verified' : 'signature_mismatch', timestamp };
}

function providerConfigured(provider = 'stripe') {
  return provider === 'stripe' && !!process.env.STRIPE_WEBHOOK_SECRET;
}

function extractSubscriptionUpdate(event) {
  const object = event?.data?.object || {};
  const metadata = object.metadata || object.subscription_details?.metadata || {};
  const guildId = String(metadata.guildId || metadata.guild_id || '');
  const plan = normalizePlan(metadata.plan || (Number(object.amount_total || object.amount || 0) >= 999 ? 'ultimate' : 'pro'));
  const statusMap = { active: 'active', trialing: 'trialing', past_due: 'past_due', canceled: 'cancelled', cancelled: 'cancelled', unpaid: 'expired' };
  const status = statusMap[object.status] || (event.type === 'invoice.paid' ? 'active' : 'past_due');
  return { guildId, plan, status, providerSubscriptionId: String(object.subscription || object.id || ''), providerCustomerId: String(object.customer || ''), currentPeriodStart: object.current_period_start ? new Date(object.current_period_start * 1000) : null, currentPeriodEnd: object.current_period_end ? new Date(object.current_period_end * 1000) : null, renewalState: object.cancel_at_period_end ? 'will_cancel' : 'auto_renew', amountMinor: Number(object.amount_paid ?? object.amount_total ?? object.amount ?? 0), currency: String(object.currency || 'usd').toUpperCase(), providerPaymentId: String(object.payment_intent || object.id || ''), providerInvoiceId: String(object.invoice || object.id || '') };
}

async function processVerifiedEvent(provider, event) {
  const eventRecord = await BillingEvent.findOneAndUpdate({ provider, eventId: event.id }, { $setOnInsert: { provider, eventId: event.id, eventType: event.type, status: 'received' } }, { upsert: true, new: false, setDefaultsOnInsert: true });
  if (eventRecord) return { duplicate: true, processed: false };
  const update = extractSubscriptionUpdate(event);
  if (!update.guildId) throw new Error('billing_event_missing_guild');
  const subscription = await Subscription.findOneAndUpdate({ guildId: update.guildId }, { $set: { plan: update.plan === 'free' ? 'pro' : update.plan, status: update.status, provider, providerCustomerId: update.providerCustomerId || null, providerSubscriptionId: update.providerSubscriptionId || null, currentPeriodStart: update.currentPeriodStart, currentPeriodEnd: update.currentPeriodEnd, renewalState: update.renewalState, lastProviderEventId: event.id, gracePeriodEnd: update.status === 'past_due' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  if (['invoice.paid', 'checkout.session.completed', 'payment_intent.succeeded'].includes(event.type)) {
    await Payment.findOneAndUpdate({ providerPaymentId: update.providerPaymentId || event.id }, { guildId: update.guildId, provider, providerPaymentId: update.providerPaymentId || event.id, providerEventId: event.id, amountMinor: update.amountMinor, currency: update.currency, plan: update.plan === 'ultimate' ? 'ultimate' : 'pro', status: 'succeeded', verifiedAt: new Date() }, { upsert: true, setDefaultsOnInsert: true });
    if (update.providerInvoiceId) await Invoice.findOneAndUpdate({ providerInvoiceId: update.providerInvoiceId }, { guildId: update.guildId, subscriptionId: subscription._id, provider, providerInvoiceId: update.providerInvoiceId, amountMinor: update.amountMinor, currency: update.currency, status: 'paid', paidAt: new Date() }, { upsert: true, setDefaultsOnInsert: true });
  }
  await BillingEvent.updateOne({ provider, eventId: event.id }, { $set: { status: 'processed', processedAt: new Date() } });
  return { duplicate: false, processed: true, guildId: update.guildId, plan: subscription.plan, status: subscription.status };
}

module.exports = { WEBHOOK_TOLERANCE_SECONDS, verifyStripeSignature, providerConfigured, extractSubscriptionUpdate, processVerifiedEvent };
