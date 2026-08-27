'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { formatPayPalError, getPayPalErrorDetails } = require('../bot/utils/billingService');

test('PayPal formatter explains local configuration errors', () => {
  assert.match(formatPayPalError(new Error('paypal_credentials_missing')), /Client ID/);
  assert.match(formatPayPalError(new Error('payment_method_not_configured')), /plan ID/);
  assert.match(formatPayPalError(new Error('paypal_approval_url_missing')), /رابط موافقة/);
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
