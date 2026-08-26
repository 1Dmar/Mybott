const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { getEntitlement, hasFeature } = require('../bot/utils/entitlements');
const { verifyStripeSignature } = require('../bot/utils/billingService');

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

test('stripe webhook signature requires a fresh verified timestamp', () => {
  const secret = 'whsec_test';
  const timestamp = Math.floor(Date.now() / 1000);
  const body = '{"id":"evt_test"}';
  const digest = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  assert.equal(verifyStripeSignature(Buffer.from(body), `t=${timestamp},v1=${digest}`, secret, timestamp).valid, true);
  assert.equal(verifyStripeSignature(Buffer.from(body), `t=${timestamp},v1=bad`, secret, timestamp).valid, false);
});
