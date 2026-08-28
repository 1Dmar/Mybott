'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const source = fs.readFileSync(require.resolve('../dash/index.js'), 'utf8');

test('logout accepts both browser GET and fetch POST through one handler', () => {
  assert.match(source, /function completeLogout\(req, res\)/);
  assert.match(source, /app\.post\('\/api\/logout', completeLogout\)/);
  assert.match(source, /app\.get\('\/api\/logout', completeLogout\)/);
  assert.doesNotMatch(source, /logout_requires_post/);
});
