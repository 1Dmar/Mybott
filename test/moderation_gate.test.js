'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isModerationEntitled } = require('../bot/utils/moderationGate');

test('moderation gate allows Pro and Ultimate entitlements', () => {
  assert.equal(isModerationEntitled({ plan: 'pro', features: { 'moderation.advanced': true } }), true);
  assert.equal(isModerationEntitled({ plan: 'ultimate', features: { 'moderation.advanced': true } }), true);
});

test('moderation gate blocks Free and missing entitlements', () => {
  assert.equal(isModerationEntitled({ plan: 'free', features: { 'moderation.advanced': false } }), false);
  assert.equal(isModerationEntitled(null), false);
  assert.equal(isModerationEntitled({}), false);
});
