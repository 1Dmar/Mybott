'use strict';

const crypto = require('crypto');
const axios = require('axios');
const Subscription = require('../Models/Subscription');
const Payment = require('../Models/Payment');
const Invoice = require('../Models/Invoice');
const BillingEvent = require('../Models/BillingEvent');
const { normalizePlan, PLANS } = require('./entitlements');

const WEBHOOK_TOLERANCE_SECONDS = 300;
const PAYPAL_SANDBOX_API = 'https://api-m.sandbox.paypal.com';
const PAYPAL_LIVE_API = 'https://api-m.paypal.com';
const SUPPORTED_METHODS = ['paypal', 'card', 'google_pay'];
const PAYMENT_COMPLETED_EVENTS = Object.freeze(['PAYMENT.SALE.COMPLETED', 'BILLING.SUBSCRIPTION.PAYMENT.COMPLETED']);

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
    free: { plan: 'free', amount: 0, currency: 'USD', interval: 'month', providerPlanConfigured: false },
    pro: { plan: 'pro', amount: 4.99, currency: 'USD', interval: 'month', providerPlanConfigured: Boolean(planIdFor('pro')) },
    ultimate: { plan: 'ultimate', amount: 9.99, currency: 'USD', interval: 'month', providerPlanConfigured: Boolean(planIdFor('ultimate')) },
  };
  const hasAnyPlan = Object.values(planCatalog).some(plan => plan.providerPlanConfigured);
  return {
    provider: 'paypal',
    environment: paypalApiBase() === PAYPAL_LIVE_API ? 'live' : 'sandbox',
    configured,
    plans: planCatalog,
    methods: {
      paypal: { id: 'paypal', label: 'PayPal', enabled: configured && hasAnyPlan },
      card: { id: 'card', label: 'Credit/debit card', enabled: configured && hasAnyPlan && process.env.PAYPAL_CARD_CHECKOUT_ENABLED === 'true', provider: 'paypal-hosted' },
      google_pay: { id: 'google_pay', label: 'Google Pay', enabled: configured && hasAnyPlan && process.env.PAYPAL_GOOGLE_PAY_ENABLED === 'true', provider: 'paypal-google-pay', requiresProviderEnablement: true },
    },
  };
}

function getPublicPlans() {
  const catalog = getPaymentCatalog();
  return Object.values(PLANS).map(plan => ({
    ...plan,
    providerPlanConfigured: Boolean(catalog.plans?.[plan.id]?.providerPlanConfigured),
  }));
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
  if (code === 'payment_method_not_configured') return 'طريقة الدفع غير مهيأة أو غير مفعلة من PayPal.';
  if (code === 'payment_plan_not_configured') return 'PayPal Plan ID لهذه الخطة غير مضبوط. أنشئ الخطة ثم ضع Plan ID في متغيرها الصحيح.';
  if (code === 'paypal_approval_url_missing') return 'PayPal أنشأ الطلب دون رابط موافقة؛ راجع حالة الخطة والبيئة.';
  const details = getPayPalErrorDetails(error);
  const reason = details.description || details.issue || details.name;
  if (reason) return `PayPal رفض إنشاء الاشتراك: ${reason}${details.debugId ? ` (debug ${details.debugId})` : ''}`;
  const rawMessage = String(error?.message || '').trim();
  const stage = String(error?.billingStage || '').trim();
  if (stage) return `فشل PayPal في مرحلة ${stage}${rawMessage ? `: ${rawMessage.slice(0, 180)}` : ': لم تصل رسالة provider. تحقق من سجل PayPal وبيئة التشغيل.'}`;
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') return 'انتهت مهلة الاتصال مع PayPal. حاول مرة أخرى وتحقق من deployment network.';
  const transportCode = String(error?.code || '').trim();
  if (transportCode) return `فشل اتصال PayPal (${transportCode}). تحقق من تطابق Sandbox/Live وClient credentials وPlan ID ثم حاول مرة أخرى.`;
  if (details.status) return `PayPal أعاد HTTP ${details.status}. تحقق من Client credentials وPlan ID وكون الخطة Active في نفس البيئة.`;
  if (/^Request failed with status code \d+$/.test(rawMessage)) return `فشل طلب PayPal: ${rawMessage.slice(0, 180)}`;
  return 'فشل اتصال PayPal. تحقق من تطابق Sandbox/Live وClient credentials وPlan ID ثم حاول مرة أخرى.';
}

async function inspectPayPalConfiguration() {
  const result = {
    environment: paypalApiBase() === PAYPAL_LIVE_API ? 'live' : 'sandbox',
    credentials: {
      clientIdPresent: Boolean(process.env.PAYPAL_CLIENT_ID),
      clientSecretPresent: Boolean(process.env.PAYPAL_CLIENT_SECRET),
      webhookIdPresent: Boolean(process.env.PAYPAL_WEBHOOK_ID),
    },
    oauth: { ok: false },
    plans: {},
  };
  if (!result.credentials.clientIdPresent || !result.credentials.clientSecretPresent) {
    result.oauth = { ok: false, code: 'paypal_credentials_missing' };
    return result;
  }
  try {
    await getPayPalAccessToken();
    result.oauth = { ok: true };
  } catch (error) {
    result.oauth = { ok: false, code: String(error?.response?.data?.error || error?.code || error?.message || 'paypal_auth_failed').slice(0, 80) };
    return result;
  }
  for (const plan of ['pro', 'ultimate']) {
    const planId = planIdFor(plan);
    if (!planId) {
      result.plans[plan] = { configured: false, ok: false, code: 'plan_id_missing' };
      continue;
    }
    try {
      const data = await paypalRequest('GET', `/v1/billing/plans/${encodeURIComponent(planId)}`);
      result.plans[plan] = { configured: true, ok: true, status: String(data?.status || '').toUpperCase() || 'UNKNOWN', name: String(data?.name || '').slice(0, 120) };
    } catch (error) {
      const details = getPayPalErrorDetails(error);
      result.plans[plan] = { configured: true, ok: false, code: details.issue || details.name || String(error?.code || 'plan_lookup_failed').slice(0, 80), status: details.status };
    }
  }
  return result;
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
  if (!catalog.plans[normalizedPlan]?.providerPlanConfigured) throw new Error('payment_plan_not_configured');
  const providerPlanId = planIdFor(normalizedPlan);
  let data;
  try {
    data = await paypalRequest('POST', '/v1/billing/subscriptions', {
      plan_id: providerPlanId,
      custom_id: String(guildId),
      application_context: {
        brand_name: 'ProMcBot',
        user_action: 'SUBSCRIBE_NOW',
        shipping_preference: 'NO_SHIPPING',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }, {
      Prefer: 'return=representation',
      'PayPal-Request-Id': crypto.randomUUID(),
    });
  } catch (error) {
    error.billingStage = 'create_subscription';
    throw error;
  }
  const approval = Array.isArray(data?.links) ? data.links.find(link => link.rel === 'approve')?.href : null;
  if (!approval) throw new Error('paypal_approval_url_missing');
  return { provider: 'paypal', method, providerSubscriptionId: data.id, status: data.status, checkoutUrl: approval };
}

async function cancelSubscription(providerSubscriptionId, reason = 'Cancelled by guild manager') {
  if (!providerSubscriptionId) throw new Error('provider_subscription_missing');
  try {
    await paypalRequest('POST', `/v1/billing/subscriptions/${encodeURIComponent(providerSubscriptionId)}/cancel`, { reason: String(reason).slice(0, 128) });
  } catch (error) {
    error.billingStage = 'cancel_subscription';
    throw error;
  }
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

function shouldGrantPaymentProof(eventType, existingSubscription, update) {
  if (PAYMENT_COMPLETED_EVENTS.includes(eventType)) return true;
  const previousId = String(existingSubscription?.providerSubscriptionId || '');
  const currentId = String(update?.providerSubscriptionId || '');
  return Boolean(existingSubscription?.metadata?.paymentVerified === true && previousId && currentId && previousId === currentId);
}

function extractSubscriptionUpdate(provider, event, fallback = {}) {
  if (provider !== 'paypal') throw new Error('unsupported_billing_provider');
  const resource = event?.resource || {};
  const customId = resource.custom_id || resource.customId || resource.purchase_units?.[0]?.custom_id || fallback.guildId || '';
  const planId = String(resource.plan_id || resource.billing_agreement_id || '');
  const metadataPlan = String(resource.metadata?.plan || '').toLowerCase();
  const configuredPlan = planId && planId === process.env.PAYPAL_ULTIMATE_PLAN_ID ? 'ultimate' : planId && planId === process.env.PAYPAL_PRO_PLAN_ID ? 'pro' : '';
  const plan = normalizePlan(metadataPlan === 'ultimate' || metadataPlan === 'pro' ? metadataPlan : configuredPlan || fallback.plan);
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
    providerSubscriptionId: String(resource.id || resource.billing_agreement_id || fallback.providerSubscriptionId || ''),
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
  const eventType = event.event_type || event.type;
  const paymentCompletedEvent = PAYMENT_COMPLETED_EVENTS.includes(eventType);
  const resource = event.resource || {};
  const paymentSubscriptionId = String(resource.billing_agreement_id || resource.subscription_id || '');
  const existingForPayment = paymentCompletedEvent && paymentSubscriptionId
    ? await Subscription.findOne({ providerSubscriptionId: paymentSubscriptionId }).lean()
    : null;
  const update = extractSubscriptionUpdate(provider, event, existingForPayment ? { guildId: existingForPayment.guildId, plan: existingForPayment.plan, providerSubscriptionId: existingForPayment.providerSubscriptionId } : {});
  if (!update.guildId) throw new Error('billing_event_missing_guild');
  const existingSubscription = existingForPayment || await Subscription.findOne({ guildId: update.guildId }).lean();
  const paymentVerified = shouldGrantPaymentProof(eventType, existingSubscription, update);
  const subscription = await Subscription.findOneAndUpdate(
    { guildId: update.guildId },
    { $set: { plan: update.plan === 'free' ? 'pro' : update.plan, status: update.status, provider, providerCustomerId: update.providerCustomerId || null, providerSubscriptionId: update.providerSubscriptionId || null, currentPeriodStart: update.currentPeriodStart, currentPeriodEnd: update.currentPeriodEnd, renewalState: update.renewalState, lastProviderEventId: event.id, gracePeriodEnd: update.status === 'past_due' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null, 'metadata.paymentVerified': paymentVerified } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (paymentVerified) {
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

module.exports = { WEBHOOK_TOLERANCE_SECONDS, SUPPORTED_METHODS, paypalConfigured, providerConfigured, getPaymentCatalog, getPublicPlans, inspectPayPalConfiguration, getPayPalAccessToken, paypalRequest, cancelSubscription, formatPayPalError, getPayPalErrorDetails, verifyPayPalWebhook, shouldGrantPaymentProof, extractSubscriptionUpdate, processVerifiedEvent };
