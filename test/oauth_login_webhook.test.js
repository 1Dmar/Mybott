'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync(require.resolve('../dash/index.js'), 'utf8');

test('Discord OAuth2 success handler sends the main-branch login embed asynchronously', () => {
  assert.match(source, /void notifyDiscordOAuthLogin\(profile\)/);
  assert.match(source, /title: '🔹 تسجيل دخول جديد'/);
  assert.match(source, /name: '👤 الاسم'/);
  assert.match(source, /name: '🆔 المعرف'/);
  assert.match(source, /name: '⏳ التاريخ'/);
  assert.match(source, /footer: \{ text: 'ProMcBot Dashboard' \}/);
});

test('OAuth2 webhook reads only environment configuration and blocks malformed URLs', () => {
  assert.match(source, /DISCORD_OAUTH_LOGIN_WEBHOOK_URL \|\| process\.env\.WEBHOOK_URL/);
  assert.match(source, /process\.env\.WEBHOOK_ID/);
  assert.match(source, /process\.env\.WEBHOOK_TOKEN/);
  assert.ok(source.includes('https://discord.com/api/webhooks'));
  assert.match(source, /allowed_mentions: \{ parse: \[\] \}/);
  assert.match(source, /AbortSignal\.timeout\(8000\)/);
});
