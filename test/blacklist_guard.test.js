'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isBlacklistActive } = require('../bot/utils/blacklistGuard');

test('permanent blacklist entries remain active', () => {
  assert.equal(isBlacklistActive({ isBlacklisted: 'true', isPermanent: true }), true);
});

test('future blacklist entries are active', () => {
  assert.equal(isBlacklistActive({ isBlacklisted: 'true', isPermanent: false, expiresAt: 2000 }, 1000), true);
});

test('expired blacklist entries are inactive', () => {
  assert.equal(isBlacklistActive({ isBlacklisted: 'true', isPermanent: false, expiresAt: 1000 }, 1000), false);
});

test('disabled or malformed entries are inactive', () => {
  assert.equal(isBlacklistActive({ isBlacklisted: 'false', isPermanent: true }), false);
  assert.equal(isBlacklistActive({ isBlacklisted: 'true', isPermanent: false, expiresAt: 'not-a-time' }, 1000), false);
});
