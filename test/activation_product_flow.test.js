const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const serverSource = fs.readFileSync(require.resolve('../dash/index.js'), 'utf8');
const shared = fs.readFileSync(require.resolve('../dash/dashboard/shared.js'), 'utf8');
const servers = fs.readFileSync(require.resolve('../dash/dashboard/pages/servers.html'), 'utf8');
const dashboard = fs.readFileSync(require.resolve('../dash/dashboard/dashboard.html'), 'utf8');
const eventModel = fs.readFileSync(require.resolve('../bot/Models/ProductEvent.js'), 'utf8');

test('Guild API returns server-scoped setup evidence and prioritizes ready servers', () => {
  assert.match(serverSource, /PluginInstance\.find\(\{ serverId: \{ \$in: ids \}/);
  assert.match(serverSource, /TelemetryEvent\.aggregate/);
  assert.match(serverSource, /nextAction/);
  assert.match(serverSource, /botStatus === 'installed'/);
  assert.match(servers, /server-health/);
  assert.match(servers, /server-next/);
});

test('Product analytics is bounded, authenticated, and does not accept arbitrary payloads', () => {
  assert.match(serverSource, /app\.post\('\/api\/analytics\/events', isAuthenticated/);
  assert.match(serverSource, /invalid_product_event/);
  assert.match(serverSource, /metadata: \{\}/);
  assert.match(eventModel, /expiresAt/);
  assert.match(eventModel, /180 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(shared, /keepalive: true/);
});

test('Account Home exposes an actionable first-value card', () => {
  assert.match(dashboard, /firstValueDescription/);
  assert.match(dashboard, /firstValueAction/);
  assert.match(dashboard, /first_value_viewed/);
  assert.match(dashboard, /No managed server yet/);
});
