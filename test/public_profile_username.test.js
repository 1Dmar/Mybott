'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePublicUsername, validatePublicUsername } = require('../dash/publicProfile');

test('public username normalization is lowercase and trimmed', () => {
  assert.equal(normalizePublicUsername('  Alim_Pro  '), 'alim_pro');
});

test('public username validator accepts URL-safe names', () => {
  assert.deepEqual(validatePublicUsername('Alim.Pro-1'), { ok: true, username: 'alim.pro-1' });
});

test('public username validator rejects invalid and reserved names', () => {
  assert.equal(validatePublicUsername('ab').error, 'invalid_public_username');
  assert.equal(validatePublicUsername('Premium').error, 'reserved_public_username');
  assert.equal(validatePublicUsername('not valid').ok, false);
});
