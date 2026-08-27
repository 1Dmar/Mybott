const test = require('node:test');
const assert = require('node:assert/strict');
const { getEntitlement, hasFeature } = require('../bot/utils/entitlements');
const { getPaymentCatalog, providerConfigured, extractSubscriptionUpdate, verifyPayPalWebhook } = require('../bot/utils/billingService');

test('free, pro, and ultimate feature boundaries are centralized', () => {
  const free = getEntitlement({ plan: 'free', status: 'active' });
  const pro = getEntitlement({ plan: 'pro', status: 'active', currentPeriodEnd: new Date(Date.now() + 86400000) });
  const ultimate = getEntitlement({ plan: 'ultimate', status: 'active', currentPeriodEnd: new Date(Date.now() + 86400000) });
  assert.equal(hasFeature(free, 'server.intelligence.basic'), true);
  assert.equal(hasFeature(free, 'retention.advanced'), false);
  assert.equal(hasFeature(pro, 'retention.advanced'), true);
  assert.equal(hasFeature(pro, 'network.intelligence'), false);
  assert.equal(hasFeature(ultimate, 'network.intelligence'), true);
});

test('expired paid subscription falls back to free while retaining reason', () => {
  const entitlement = getEntitlement({ plan: 'pro', status: 'active', currentPeriodEnd: new Date(Date.now() - 1000) });
  assert.equal(entitlement.plan, 'free');
  assert.equal(entitlement.status, 'expired');
  assert.equal(hasFeature(entitlement, 'retention.advanced'), false);
});

test('PayPal is the only billing provider and the catalog never reports fake checkout', () => {
  const catalog = getPaymentCatalog();
  assert.equal(providerConfigured('stripe'), false);
  assert.equal(catalog.provider, 'paypal');
  assert.deepEqual(Object.keys(catalog.methods).sort(), ['card', 'google_pay', 'paypal']);
  assert.equal(catalog.plans.pro.amount, 4.99);
  assert.equal(catalog.plans.ultimate.amount, 9.99);
  assert.equal(catalog.configured, false);
  assert.equal(Object.values(catalog.methods).some(method => method.enabled), false);
});

test('PayPal subscription events map to the shared subscription authority', () => {
  const previous = process.env.PAYPAL_ULTIMATE_PLAN_ID;
  process.env.PAYPAL_ULTIMATE_PLAN_ID = 'P-ultimate';
  const update = extractSubscriptionUpdate('paypal', {
    id: 'WH-test',
    event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
    resource: { id: 'I-sub', custom_id: 'guild-1', plan_id: 'P-ultimate', status: 'ACTIVE' },
  });
  assert.equal(update.guildId, 'guild-1');
  assert.equal(update.plan, 'ultimate');
  assert.equal(update.status, 'active');
  if (previous === undefined) delete process.env.PAYPAL_ULTIMATE_PLAN_ID;
  else process.env.PAYPAL_ULTIMATE_PLAN_ID = previous;
});

test('PayPal webhook rejects malformed JSON before provider verification', async () => {
  const previous = { id: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_CLIENT_SECRET, webhook: process.env.PAYPAL_WEBHOOK_ID };
  process.env.PAYPAL_CLIENT_ID = 'configured-for-structure-test';
  process.env.PAYPAL_CLIENT_SECRET = 'configured-for-structure-test';
  process.env.PAYPAL_WEBHOOK_ID = 'configured-for-structure-test';
  const now = Math.floor(Date.now() / 1000);
  const result = await verifyPayPalWebhook(Buffer.from('{invalid'), {
    'paypal-transmission-time': new Date(now * 1000).toISOString(),
    'paypal-transmission-id': 'transmission-1',
    'paypal-transmission-sig': 'signature',
    'paypal-cert-url': 'https://example.invalid/cert',
    'paypal-auth-algo': 'SHA256withRSA',
  }, now);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'malformed_paypal_event');
  for (const [key, value] of [['PAYPAL_CLIENT_ID', previous.id], ['PAYPAL_CLIENT_SECRET', previous.secret], ['PAYPAL_WEBHOOK_ID', previous.webhook]]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('PayPal subscription mapping rejects unknown plan IDs', () => {
  const previous = { pro: process.env.PAYPAL_PRO_PLAN_ID, ultimate: process.env.PAYPAL_ULTIMATE_PLAN_ID };
  process.env.PAYPAL_PRO_PLAN_ID = 'P-known-pro';
  process.env.PAYPAL_ULTIMATE_PLAN_ID = 'P-known-ultimate';
  assert.throws(() => extractSubscriptionUpdate('paypal', { id: 'WH-unknown', event_type: 'BILLING.SUBSCRIPTION.ACTIVATED', resource: { id: 'I-sub', custom_id: 'guild-1', plan_id: 'P-unknown', status: 'ACTIVE' } }), /unknown_paypal_plan/);
  for (const [key, value] of [['PAYPAL_PRO_PLAN_ID', previous.pro], ['PAYPAL_ULTIMATE_PLAN_ID', previous.ultimate]]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('PayPal webhook verification fails closed without provider configuration', async () => {
  const previous = { id: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_CLIENT_SECRET, webhook: process.env.PAYPAL_WEBHOOK_ID };
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;
  delete process.env.PAYPAL_WEBHOOK_ID;
  const result = await verifyPayPalWebhook(Buffer.from('{}'), {});
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'missing_paypal_configuration');
  for (const [key, value] of [['PAYPAL_CLIENT_ID', previous.id], ['PAYPAL_CLIENT_SECRET', previous.secret], ['PAYPAL_WEBHOOK_ID', previous.webhook]]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
