const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'dash/index.js'), 'utf8');
const shared = fs.readFileSync(path.join(root, 'dash/dashboard/shared.js'), 'utf8');
const overview = fs.readFileSync(path.join(root, 'dash/dashboard/pages/admin-overview.html'), 'utf8');
const partners = fs.readFileSync(path.join(root, 'dash/dashboard/pages/admin-partners.html'), 'utf8');

test('admin overview route exposes the manual server grant tool', () => {
  assert.match(index, /app\.get\(\['\/admin', '\/admin\/overview'\]/);
  assert.match(overview, /id="manualGrantForm"/);
  assert.match(overview, /\/api\/admin\/subscriptions\/grant/);
});

test('admin navigation uses the shared sidebar on all admin pages', () => {
  assert.match(shared, /href="\/admin\/overview"/);
  assert.match(shared, /href="\/admin\/partners"/);
  assert.match(shared, /href="\/admin\/changelog"/);
  assert.match(partners, /id="sidebar"/);
  assert.match(partners, /src="\/shared\.js"/);
  assert.doesNotMatch(partners, /id="adminSidebar"/);
});

test('normal workspace sidebar stays focused on account home and managed servers', () => {
  const normalBranch = shared.slice(shared.indexOf('} else {'), shared.indexOf('    menuContent.innerHTML'));
  assert.match(normalBranch, /href="\/dashboard"/);
  assert.match(normalBranch, /href="\/myservers"/);
  assert.doesNotMatch(normalBranch, /href="\/admin\//);
  assert.doesNotMatch(normalBranch, /href="\/actions"/);
  assert.doesNotMatch(normalBranch, /href="\/smart-actions"/);
  assert.doesNotMatch(normalBranch, /href="\/premium"/);
});
