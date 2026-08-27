'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { formatPayPalError, getPayPalErrorDetails, getPaymentCatalog, getPublicPlans, inspectPayPalConfiguration } = require('../bot/utils/billingService');

test('PayPal diagnostics fail safely when credentials are absent', async () => {
  const previous = { id: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_CLIENT_SECRET };
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;
  const diagnostics = await inspectPayPalConfiguration();
  assert.equal(diagnostics.oauth.ok, false);
  assert.equal(diagnostics.oauth.code, 'paypal_credentials_missing');
  assert.equal(diagnostics.credentials.clientIdPresent, false);
  if (previous.id === undefined) delete process.env.PAYPAL_CLIENT_ID;
  else process.env.PAYPAL_CLIENT_ID = previous.id;
  if (previous.secret === undefined) delete process.env.PAYPAL_CLIENT_SECRET;
  else process.env.PAYPAL_CLIENT_SECRET = previous.secret;
});

test('Premium UI reads array-shaped billing plans and checks each plan readiness', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'dash/dashboard/pages/premium.html'), 'utf8');
  assert.match(html, /Array\.isArray\(catalog\?\.plans\)/);
  assert.match(html, /planIsConfigured\(plan\.id\)/);
});

test('PayPal catalog allows Pro when only the Pro plan is configured', () => {
  const previous = {};
  for (const key of ['PAYPAL_ENV', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID', 'PAYPAL_PRO_PLAN_ID', 'PAYPAL_ULTIMATE_PLAN_ID']) previous[key] = process.env[key];
  process.env.PAYPAL_ENV = 'sandbox';
  process.env.PAYPAL_CLIENT_ID = 'client';
  process.env.PAYPAL_CLIENT_SECRET = 'secret';
  process.env.PAYPAL_WEBHOOK_ID = 'webhook';
  process.env.PAYPAL_PRO_PLAN_ID = 'P-pro';
  delete process.env.PAYPAL_ULTIMATE_PLAN_ID;
  const catalog = getPaymentCatalog();
  assert.equal(catalog.plans.pro.providerPlanConfigured, true);
  assert.equal(catalog.plans.ultimate.providerPlanConfigured, false);
  assert.equal(catalog.methods.paypal.enabled, true);
  const publicPlans = getPublicPlans();
  assert.equal(publicPlans.find(plan => plan.id === 'pro').providerPlanConfigured, true);
  assert.equal(publicPlans.find(plan => plan.id === 'ultimate').providerPlanConfigured, false);
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('PayPal formatter explains local configuration errors', () => {
  assert.match(formatPayPalError(new Error('paypal_credentials_missing')), /Client ID/);
  assert.match(formatPayPalError(new Error('payment_method_not_configured')), /طريقة الدفع/);
  assert.match(formatPayPalError(new Error('payment_plan_not_configured')), /Plan ID/);
  assert.match(formatPayPalError(new Error('paypal_approval_url_missing')), /رابط موافقة/);
});

test('PayPal formatter exposes checkout stage when provider returns no structured details', () => {
  const error = new Error('Request failed with status code 422');
  error.billingStage = 'create_subscription';
  assert.match(formatPayPalError(error), /create_subscription/);
  assert.match(formatPayPalError(error), /422/);
  const noMessage = new Error('');
  noMessage.billingStage = 'create_subscription';
  assert.match(formatPayPalError(noMessage), /create_subscription/);
});

test('PayPal formatter exposes safe provider issue and debug id', () => {
  const error = {
    response: {
      status: 400,
      headers: { 'paypal-debug-id': 'DEBUG-123' },
      data: {
        name: 'INVALID_REQUEST',
        details: [{ issue: 'INVALID_RESOURCE_ID', description: 'The specified plan does not exist.' }],
      },
    },
  };
  const details = getPayPalErrorDetails(error);
  assert.equal(details.issue, 'INVALID_RESOURCE_ID');
  assert.equal(details.debugId, 'DEBUG-123');
  assert.match(formatPayPalError(error), /INVALID_RESOURCE_ID|plan does not exist/);
  assert.match(formatPayPalError(error), /DEBUG-123/);
});

test('PayPal formatter falls back to actionable generic message', () => {
  assert.match(formatPayPalError({ code: 'ECONNABORTED', message: 'timeout' }), /انتهت مهلة/);
  assert.match(formatPayPalError(new Error('unexpected_provider_failure')), /Sandbox\/Live/);
});
