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

test('Changelog page provides explicit light mode and an accessible toggle', () => {
  assert.match(page, /\[data-theme="light"\]/);
  assert.match(page, /id="themeToggle"[^>]*aria-pressed="false"/);
  assert.match(page, /localStorage\.setItem\('pmcbot-theme', nextTheme\)/);
  assert.match(page, /prefers-color-scheme: light/);
  assert.match(page, /\[data-theme="light"\] \.hero-image/);
});
