process.env.PLUGIN_ENCRYPTION_KEY = 'local-test-key-that-is-not-a-production-secret';
const assert = require('node:assert/strict');
const { encryptSecret, decryptSecret } = require('../bot/utils/pluginSecurity');
const { renderMessage } = require('../bot/utils/automationEngine');
const secret = 'runtime-signing-secret';
assert.equal(decryptSecret(encryptSecret(secret)), secret);
assert.equal(renderMessage('Activity changed {{activityChange}}', { analysis: [{ key: 'activity_trend', changePercent: -8.4 }] }), 'Activity changed -8.40%');
console.log('smoke-foundations-ok');
