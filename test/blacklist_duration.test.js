'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDuration } = require('../bot/Commands/Slash/Server/blacklist');

test('blacklist duration parser supports documented units', () => {
  assert.equal(parseDuration('250ms'), 250);
  assert.equal(parseDuration('2s'), 2000);
  assert.equal(parseDuration('5m'), 300000);
  assert.equal(parseDuration('1h'), 3600000);
  assert.equal(parseDuration('3d'), 259200000);
  assert.equal(parseDuration('2w'), 1209600000);
  assert.equal(parseDuration('5mo'), 12960000000);
  assert.equal(parseDuration('inf'), null);
});

test('blacklist duration parser rejects silent fallbacks', () => {
  assert.throws(() => parseDuration(''), /Invalid duration/);
  assert.throws(() => parseDuration('1y'), /Invalid duration/);
  assert.throws(() => parseDuration('forever'), /Invalid duration/);
  assert.throws(() => parseDuration('-1d'), /Invalid duration/);
});
