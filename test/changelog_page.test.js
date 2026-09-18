const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pagePath = path.join(__dirname, '..', 'dash', 'dashboard', 'pages', 'changelog.html');
const routeSource = fs.readFileSync(path.join(__dirname, '..', 'dash', 'index.js'), 'utf8');
const page = fs.readFileSync(pagePath, 'utf8');

test('Changelog route and banner asset are wired', () => {
  assert.match(routeSource, /app\.get\('\/changelog', \(req, res\) => res\.sendFile\(path\.join\(dashDir, 'pages', 'changelog\.html'\)\)\)/);
  assert.match(page, /src="\/dashboard\/assets\/changelog-banner\.png"/);
});

test('Changelog page includes crawlable release content in the initial HTML', () => {
  assert.match(page, /<article class="release">/);
  assert.match(page, /<strong>v1\.2\.0<\/strong>/);
  assert.match(page, /A clearer path from signal to action/);
  assert.doesNotMatch(page, /<div id="changelogFeed"><\/div>/);
});

test('Changelog page uses the public homepage navbar', () => {
  assert.match(page, /class="logo"/);
  assert.match(page, /class="nav-links"/);
  assert.match(page, /id="navActions"/);
  assert.match(page, /class="landing-button landing-button-primary landing-button-quiet"/);
  assert.match(page, /src="\/shared\.js"/);
});
