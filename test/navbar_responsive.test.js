'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const dashboard = fs.readFileSync(path.join(__dirname, '../dash/dashboard/dashboard.html'), 'utf8');
const configuration = fs.readFileSync(path.join(__dirname, '../dash/dashboard/pages/configuration.html'), 'utf8');
const home = fs.readFileSync(path.join(__dirname, '../dash/dashboard/home.html'), 'utf8');

test('Change Look uses the dashboard navbar controls', () => {
  for (const source of [dashboard, configuration]) {
    assert.match(source, /id="sidebarToggle"/);
    assert.match(source, /id="darkLight"/);
    assert.match(source, /class="user_profile_nav"/);
  }
});

test('Public homepage keeps Dashboard and Invite Bot reachable behind a mobile hamburger', () => {
  assert.match(home, /id="landingMenuToggle"/);
  assert.match(home, /id="landingMenu"/);
  assert.match(home, /@media \(max-width: 640px\)/);
  assert.match(home, /href="\/invitebot"/);
  assert.match(home, /aria-expanded/);
});
