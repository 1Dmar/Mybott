'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAutomod } = require('../dash/moderationConfig');

test('automod normalization provides safe defaults for missing settings', () => {
  const result = normalizeAutomod(null);
  assert.equal(result.enabled, false);
  assert.equal(result.action, 'warn');
  assert.equal(result.logChannel, '');
  assert.deepEqual(result.filters, { badwords: false, links: false, invites: false, spam: false, caps: false, mentions: false });
  assert.deepEqual(result.limits, { capsPercentage: 70, spamCount: 5, spamInterval: 5000, maxMentions: 5 });
});

test('automod normalization preserves valid values and rejects unsafe actions', () => {
  const result = normalizeAutomod({ enabled: true, action: 'timeout', logChannel: 'channel-1', filters: { links: true }, limits: { spamCount: 9 } });
  assert.equal(result.enabled, true);
  assert.equal(result.action, 'timeout');
  assert.equal(result.logChannel, 'channel-1');
  assert.equal(result.filters.links, true);
  assert.equal(result.filters.badwords, false);
  assert.equal(result.limits.spamCount, 9);
  assert.equal(normalizeAutomod({ action: 'execute-shell' }).action, 'warn');
});
