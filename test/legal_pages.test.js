'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const privacy = fs.readFileSync(require.resolve('../dash/dashboard/pages/PrivacyPolicy.html'), 'utf8');
const terms = fs.readFileSync(require.resolve('../dash/dashboard/pages/TermsOfService.html'), 'utf8');
const index = fs.readFileSync(require.resolve('../dash/index.js'), 'utf8');
const home = fs.readFileSync(require.resolve('../dash/dashboard/home.html'), 'utf8');

test('public legal pages contain project-specific policy content', () => {
  assert.match(privacy, /Privacy Policy/);
  assert.match(privacy, /Discord OAuth/);
  assert.match(privacy, /Minecraft plugin/);
  assert.match(privacy, /telemetry/i);
  assert.match(privacy, /PayPal/);
  assert.match(privacy, /discord\.gg\/6FjFYStz5a/);
  assert.doesNotMatch(privacy, /Universal Temp Mail/);

  assert.match(terms, /Terms of Service/);
  assert.match(terms, /Acceptable use/);
  assert.match(terms, /server owner/i);
  assert.match(terms, /Minecraft plugin/);
  assert.match(terms, /Discord/);
  assert.match(terms, /discord\.gg\/6FjFYStz5a/);
});

test('legal routes and landing-page links are public and stable', () => {
  assert.match(index, /'\/privacy-policy': 'PrivacyPolicy\.html'/);
  assert.match(index, /'\/terms-of-service': 'TermsOfService\.html'/);
  assert.match(index, /app\.get\('\/privacy'/);
  assert.match(index, /app\.get\('\/terms'/);
  assert.match(home, /href="\/privacy-policy"/);
  assert.match(home, /href="\/terms-of-service"/);
});
