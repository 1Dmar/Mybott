'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const rulesSource = fs.readFileSync(path.join(__dirname, '../bot/Commands/Slash/Misc/rules.js'), 'utf8');

test('rules command is listed under Utility', () => {
  assert.match(rulesSource, /category:\s*'Utility'/);
});

test('rules messages wrap every displayed URL in angle brackets', () => {
  const urls = [
    'https://discord.com/terms',
    'https://discord.com/guidelines',
    'https://promcbot.dev/terms-of-service',
    'https://promcbot.dev/privacy-policy',
    'https://discord.gg/6FjFYStz5a',
  ];

  for (const url of urls) {
    assert.equal(rulesSource.includes(`](${url})`), false, `found an embed-enabled link for ${url}`);
  }

  assert.match(rulesSource, /\[support channels\]\(<\$\{SUPPORT_URL\}>\)/);
  assert.match(rulesSource, /\[Discord ToS\]\(<https:\/\/discord\.com\/terms>\)/);
  assert.match(rulesSource, /\[Discord Guidelines\]\(<https:\/\/discord\.com\/guidelines>\)/);
  assert.match(rulesSource, /\[ProMcBot Terms\]\(<\$\{TERMS_URL\}>\)/);
  assert.match(rulesSource, /\[Privacy Policy\]\(<\$\{PRIVACY_URL\}>\)/);
  assert.match(rulesSource, /\[ProMcBot Terms of Service\]\(<\$\{TERMS_URL\}>\)/);
});

test('rules messages direct users to the /discord command', () => {
  assert.match(rulesSource, /Use the \*\*\/discord\*\* command/);
  assert.match(rulesSource, /use the \/discord command to join/);
  assert.match(rulesSource, /Security reports:.*\*\*\/discord\*\* command/);
});
