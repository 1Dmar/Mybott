'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('bot startup excludes legacy membership handler from active runtime loaders', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'bot', 'index.js'), 'utf8');
  const handlesFiles = source.match(/const handlesFiles = \[([^\]]+)\]/)?.[1] || '';
  assert.equal(handlesFiles.includes('membership_handler'), false);
  assert.match(source, /Subscription\/entitlementService is the only Premium authority/);
});
