'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getConfigurationStatus } = require('../dash/configurationStatus');

test('configuration status reports presence booleans without exposing secret values', () => {
  assert.deepEqual(getConfigurationStatus({
    PLUGIN_ENCRYPTION_KEY: 'redacted-value',
    MONGO_URL: 'mongodb://example.invalid',
    DISCORD_CLIENT_ID: 'client-id',
    DISCORD_CLIENT_SECRET: 'client-secret',
    PAYPAL_CLIENT_ID: 'paypal-id',
    PAYPAL_CLIENT_SECRET: 'paypal-secret',
    PAYPAL_WEBHOOK_ID: 'webhook-id',
  }), {
    pluginProvisioningConfigured: true,
    mongoConfigured: true,
    discordOAuthConfigured: true,
    paypalConfigured: true,
  });
});

test('configuration status is false when deployment secrets are absent', () => {
  assert.deepEqual(getConfigurationStatus({}), {
    pluginProvisioningConfigured: false,
    mongoConfigured: false,
    discordOAuthConfigured: false,
    paypalConfigured: false,
  });
});
