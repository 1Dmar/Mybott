'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const dashboard = fs.readFileSync(require.resolve('../dash/dashboard/dashboard.html'), 'utf8');
const dashboardServer = fs.readFileSync(require.resolve('../dash/index.js'), 'utf8');

test('dashboard exposes the ProMcBot Support Center for players and server owners', () => {
  assert.match(dashboard, /id="support-title"/);
  assert.match(dashboard, /Player support/);
  assert.match(dashboard, /Server owner support/);
  assert.match(dashboard, /https:\/\/discord\.gg\/6FjFYStz5a/);
  assert.match(dashboard, /target="_blank" rel="noopener noreferrer"/);
});

test('dashboard exposes a public Discord support redirect', () => {
  assert.match(dashboardServer, /app\.get\('\/discord', \(req, res\) => res\.redirect\(302, 'https:\/\/discord\.gg\/6FjFYStz5a'\)\);/);
});
