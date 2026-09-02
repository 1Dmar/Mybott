'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const rulesSource = fs.readFileSync(path.join(__dirname, '../bot/Commands/Slash/Misc/rules.js'), 'utf8');

test('rules command is listed under Utility', () => {
  assert.match(rulesSource, /category:\s*'Utility'/);
});

test('rules messages use the website support URL and suppress embeds', () => {
  assert.match(rulesSource, /const SUPPORT_URL = 'https:\/\/promcbot\.dev\/discord'/);
  assert.equal(rulesSource.includes('discord.gg'), false, 'rules must not contain a Discord invite URL');
  assert.match(rulesSource, /\[support channels\]\(<\$\{SUPPORT_URL\}>\)/);
  assert.match(rulesSource, /\[Discord ToS\]\(<https:\/\/discord\.com\/terms>\)/);
  assert.match(rulesSource, /\[Discord Guidelines\]\(<https:\/\/discord\.com\/guidelines>\)/);
  assert.match(rulesSource, /\[ProMcBot Terms\]\(<\$\{TERMS_URL\}>\)/);
  assert.match(rulesSource, /\[Privacy Policy\]\(<\$\{PRIVACY_URL\}>\)/);
  assert.match(rulesSource, /\[ProMcBot Terms of Service\]\(<\$\{TERMS_URL\}>\)/);
});

test('rules messages do not mention a separate /discord command', () => {
  assert.equal(rulesSource.includes('/discord**'), false);
  assert.equal(rulesSource.includes('/discord command'), false);
});
