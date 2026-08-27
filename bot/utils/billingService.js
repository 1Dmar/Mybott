'use strict';

const crypto = require('crypto');
const axios = require('axios');
const Subscription = require('../Models/Subscription');
const Payment = require('../Models/Payment');
const Invoice = require('../Models/Invoice');
const BillingEvent = require('../Models/BillingEvent');
const { normalizePlan } = require('./entitlements');

const WEBHOOK_TOLERANCE_SECONDS = 300;
const PAYPAL_SANDBOX_API = 'https://api-m.sandbox.paypal.com';
const PAYPAL_LIVE_API = 'https://api-m.paypal.com';
const SUPPORTED_METHODS = ['paypal', 'card', 'google_pay'];

function timingSafeText(expected, actual) {
  const a = Buffer.from(String(expected || ''), 'utf8');
  const b = Buffer.from(String(actual || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function paypalApiBase() {
  return String(process.env.PAYPAL_ENV || 'sandbox').toLowerCase() === 'live' ? PAYPAL_LIVE_API : PAYPAL_SANDBOX_API;
}

function planIdFor(plan) {
  return plan === 'pro' ? process.env.PAYPAL_PRO_PLAN_ID : plan === 'ultimate' ? process.env.PAYPAL_ULTIMATE_PLAN_ID : null;
}

function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && process.env.PAYPAL_WEBHOOK_ID);
}

function getPaymentCatalog() {
  const configured = paypalConfigured();
  const planCatalog = {
    free: { plan: 'free', amount: 0, currency: 'USD', interval: 'month' },
    pro: { plan: 'pro', amount: 4.99, currency: 'USD', interval: 'month', providerPlanConfigured: Boolean(planIdFor('pro')) },
    ultimate: { plan: 'ultimate', amount: 9.99, currency: 'USD', interval: 'month', providerPlanConfigured: Boolean(planIdFor('ultimate')) },
  };
  return {
    provider: 'paypal',
    environment: paypalApiBase() === PAYPAL_LIVE_API ? 'live' : 'sandbox',
    configured,
    plans: planCatalog,
    methods: {
      paypal: { id: 'paypal', label: 'PayPal', enabled: configured && Boolean(planIdFor('pro')) && Boolean(planIdFor('ultimate')) },
      card: { id: 'card', label: 'Credit/debit card', enabled: configured && process.env.PAYPAL_CARD_CHECKOUT_ENABLED === 'true' && Boolean(planIdFor('pro')) && Boolean(planIdFor('ultimate')), provider: 'paypal-hosted' },
      google_pay: { id: 'google_pay', label: 'Google Pay', enabled: configured && process.env.PAYPAL_GOOGLE_PAY_ENABLED === 'true' && Boolean(planIdFor('pro')) && Boolean(planIdFor('ultimate')), provider: 'paypal-google-pay', requiresProviderEnablement: true },
    },
  };
}

function providerConfigured(provider = 'paypal') {
  return provider === 'paypal' && paypalConfigured();
}

function getPayPalErrorDetails(error) {
  const body = error?.response?.data || error?.paypal || {};
  const details = Array.isArray(body.details) ? body.details : [];
  const first = details.find(item => item && (item.issue || item.description)) || {};
  const headers = error?.response?.headers || {};
  return {
    name: String(body.name || body.error || first.issue || '').slice(0, 80),
    issue: String(first.issue || '').slice(0, 100),
    description: String(first.description || body.message || '').replace(/[\r\n]+/g, ' ').slice(0, 240),
    debugId: String(body.debug_id || headers['paypal-debug-id'] || '').slice(0, 80),
    status: Number(error?.response?.status) || null,
  };
}

function formatPayPalError(error) {
  const code = String(error?.message || '');
  if (code === 'paypal_credentials_missing') return 'PayPal Client ID أو Client Secret غير مضبوط في بيئة التشغيل.';
  if (code === 'payment_method_not_configured') return 'طريقة الدفع أو PayPal plan ID غير مهيأة بالكامل في بيئة التشغيل.';
  if (code === 'paypal_approval_url_missing') return 'PayPal أنشأ الطلب دون رابط موافقة؛ راجع حالة الخطة والبيئة.';
  const details = getPayPalErrorDetails(error);
  const reason = details.description || details.issue || details.name;
  if (reason) return `PayPal رفض إنشاء الاشتراك: ${reason}${details.debugId ? ` (debug ${details.debugId})` : ''}`;
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') return 'انتهت مهلة الاتصال مع PayPal. حاول مرة أخرى وتحقق من deployment network.';
  return 'فشل اتصال PayPal. تحقق من تطابق Sandbox/Live وClient credentials وPlan ID ثم حاول مرة أخرى.';
}

async function getPayPalAccessToken() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) throw new Error('paypal_credentials_missing');
  const response = await axios.post(`${paypalApiBase()}/v1/oauth2/token`, 'grant_type=client_credentials', {
    auth: { username: process.env.PAYPAL_CLIENT_ID, password: process.env.PAYPAL_CLIENT_SECRET },
    headers: { Accept: 'application/json', 'Accept-Language': 'en_US', 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });
  return response.data?.access_token;
}

async function paypalRequest(method, path, data = undefined, headers = {}) {
  const accessToken = await getPayPalAccessToken();
  const response = await axios({
    method,
    url: `${paypalApiBase()}${path}`,
    data,
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'Content-Type': 'application/json', ...headers },
    timeout: 10000,
  });
  return response.data;
}

async function createCheckout({ guildId, plan, method = 'paypal', returnUrl, cancelUrl }) {
  const normalizedPlan = normalizePlan(plan);
  const catalog = getPaymentCatalog();
  if (!['pro', 'ultimate'].includes(normalizedPlan)) throw new Error('invalid_paid_plan');
  if (!SUPPORTED_METHODS.includes(method)) throw new Error('unsupported_payment_method');
  if (!catalog.methods[method]?.enabled) throw new Error('payment_method_not_configured');
  const providerPlanId = planIdFor(normalizedPlan);
  const data = await paypalRequest('POST', '/v1/billing/subscriptions', {
    plan_id: providerPlanId,
    custom_id: String(guildId),
    application_context: {
      brand_name: 'ProMcBot',
      user_action: 'SUBSCRIBE_NOW',
      shipping_preference: 'NO_SHIPPING',
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  });
  const approval = Array.isArray(data?.links) ? data.links.find(link => link.rel === 'approve')?.href : null;
  if (!approval) throw new Error('paypal_approval_url_missing');
  return { provider: 'paypal', method, providerSubscriptionId: data.id, status: data.status, checkoutUrl: approval };
}

async function cancelSubscription(providerSubscriptionId, reason = 'Cancelled by guild manager') {
  if (!providerSubscriptionId) throw new Error('provider_subscription_missing');
  await paypalRequest('POST', `/v1/billing/subscriptions/${encodeURIComponent(providerSubscriptionId)}/cancel`, { reason: String(reason).slice(0, 128) });
  return { provider: 'paypal', providerSubscriptionId, renewalState: 'will_cancel' };
}

async function verifyPayPalWebhook(rawBody, headers, now = Math.floor(Date.now() / 1000)) {
  if (!paypalConfigured()) return { valid: false, reason: 'missing_paypal_configuration' };
  const transmissionTime = headers?.['paypal-transmission-time'];
  const transmissionId = headers?.['paypal-transmission-id'];
  const transmissionSig = headers?.['paypal-transmission-sig'];
  const certUrl = headers?.['paypal-cert-url'];
  const authAlgo = headers?.['paypal-auth-algo'];
  if (!transmissionTime || !transmissionId || !transmissionSig || !certUrl || !authAlgo || !rawBody) return { valid: false, reason: 'malformed_paypal_signature' };
  const timestamp = Math.floor(new Date(transmissionTime).getTime() / 1000);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return { valid: false, reason: 'stale_paypal_signature', timestamp };
  let webhookEvent;
  try {
    webhookEvent = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
  } catch (_) {
    return { valid: false, reason: 'malformed_paypal_event', timestamp };
  }
  if (!webhookEvent || typeof webhookEvent !== 'object' || Array.isArray(webhookEvent)) return { valid: false, reason: 'malformed_paypal_event', timestamp };
  const result = await paypalRequest('POST', '/v1/notifications/verify-webhook-signature', {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: process.env.PAYPAL_WEBHOOK_ID,
    webhook_event: webhookEvent,
  });
  const valid = result?.verification_status === 'SUCCESS';
  return { valid, reason: valid ? 'verified' : 'signature_mismatch', timestamp };
}

function extractSubscriptionUpdate(provider, event) {
  if (provider !== 'paypal') throw new Error('unsupported_billing_provider');
  const resource = event?.resource || {};
  const customId = resource.custom_id || resource.customId || resource.purchase_units?.[0]?.custom_id || '';
  const planId = String(resource.plan_id || resource.billing_agreement_id || '');
  const metadataPlan = String(resource.metadata?.plan || '').toLowerCase();
  const configuredPlan = planId && planId === process.env.PAYPAL_ULTIMATE_PLAN_ID ? 'ultimate' : planId && planId === process.env.PAYPAL_PRO_PLAN_ID ? 'pro' : '';
  const plan = normalizePlan(metadataPlan === 'ultimate' || metadataPlan === 'pro' ? metadataPlan : configuredPlan);
  if (!['pro', 'ultimate'].includes(plan)) throw new Error('unknown_paypal_plan');
  const statusMap = {
    ACTIVE: 'active',
    APPROVAL_PENDING: 'trialing',
    APPROVED: 'trialing',
    SUSPENDED: 'past_due',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired',
    PAYMENT_FAILED: 'past_due',
  };
  const status = statusMap[String(resource.status || '').toUpperCase()] || (event.type === 'PAYMENT.SALE.COMPLETED' ? 'active' : 'past_due');
  const lastPayment = resource.billing_info?.last_payment?.amount?.value || resource.amount?.value || resource.purchase_units?.[0]?.amount?.value || 0;
  const nextBilling = resource.billing_info?.next_billing_time || null;
  return {
    guildId: String(customId),
    plan,
    status,
    providerSubscriptionId: String(resource.id || resource.billing_agreement_id || ''),
    providerCustomerId: String(resource.subscriber?.payer_id || resource.payer?.payer_id || ''),
    currentPeriodStart: resource.start_time ? new Date(resource.start_time) : null,
    currentPeriodEnd: nextBilling ? new Date(nextBilling) : null,
    renewalState: resource.status === 'CANCELLED' ? 'cancelled' : 'auto_renew',
    amountMinor: Math.round(Number(lastPayment || 0) * 100),
    currency: String(resource.billing_info?.last_payment?.amount?.currency_code || resource.amount?.currency_code || 'USD').toUpperCase(),
    providerPaymentId: String(resource.id || event.id || ''),
    providerInvoiceId: String(resource.invoice_id || resource.id || event.id || ''),
  };
}

async function processVerifiedEvent(provider, event) {
  if (provider !== 'paypal' || !event?.id) throw new Error('invalid_paypal_event');
  const eventRecord = await BillingEvent.findOneAndUpdate(
    { provider, eventId: event.id },
    { $setOnInsert: { provider, eventId: event.id, eventType: event.event_type || event.type, status: 'received' } },
    { upsert: true, new: false, setDefaultsOnInsert: true }
  );
  if (eventRecord) return { duplicate: true, processed: false };
  const update = extractSubscriptionUpdate(provider, event);
  if (!update.guildId) throw new Error('billing_event_missing_guild');
  const subscription = await Subscription.findOneAndUpdate(
    { guildId: update.guildId },
    { $set: { plan: update.plan === 'free' ? 'pro' : update.plan, status: update.status, provider, providerCustomerId: update.providerCustomerId || null, providerSubscriptionId: update.providerSubscriptionId || null, currentPeriodStart: update.currentPeriodStart, currentPeriodEnd: update.currentPeriodEnd, renewalState: update.renewalState, lastProviderEventId: event.id, gracePeriodEnd: update.status === 'past_due' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (['PAYMENT.SALE.COMPLETED', 'BILLING.SUBSCRIPTION.ACTIVATED', 'BILLING.SUBSCRIPTION.PAYMENT.COMPLETED'].includes(event.event_type || event.type)) {
    await Payment.findOneAndUpdate(
      { providerPaymentId: update.providerPaymentId || event.id },
      { guildId: update.guildId, provider, providerPaymentId: update.providerPaymentId || event.id, providerEventId: event.id, amountMinor: update.amountMinor, currency: update.currency, plan: update.plan === 'ultimate' ? 'ultimate' : 'pro', status: 'succeeded', verifiedAt: new Date() },
      { upsert: true, setDefaultsOnInsert: true }
    );
    if (update.providerInvoiceId) await Invoice.findOneAndUpdate({ providerInvoiceId: update.providerInvoiceId }, { guildId: update.guildId, subscriptionId: subscription._id, provider, providerInvoiceId: update.providerInvoiceId, amountMinor: update.amountMinor, currency: update.currency, status: 'paid', paidAt: new Date() }, { upsert: true, setDefaultsOnInsert: true });
  }
  await BillingEvent.updateOne({ provider, eventId: event.id }, { $set: { status: 'processed', processedAt: new Date() } });
  return { duplicate: false, processed: true, guildId: update.guildId, plan: subscription.plan, status: subscription.status };
}

module.exports = { WEBHOOK_TOLERANCE_SECONDS, SUPPORTED_METHODS, paypalConfigured, providerConfigured, getPaymentCatalog, getPayPalAccessToken, paypalRequest, createCheckout, cancelSubscription, formatPayPalError, getPayPalErrorDetails, verifyPayPalWebhook, extractSubscriptionUpdate, processVerifiedEvent };
