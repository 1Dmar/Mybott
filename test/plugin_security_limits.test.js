'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_HEADER_BYTES } = require('../bot/utils/pluginSecurity');

test('plugin protocol header limits remain bounded', () => {
  assert.equal(MAX_HEADER_BYTES, 256);
});
