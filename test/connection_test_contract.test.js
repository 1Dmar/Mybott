const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const serverSource = fs.readFileSync(require.resolve('../dash/index.js'), 'utf8');
const pageSource = fs.readFileSync(require.resolve('../dash/dashboard/pages/intelligence.html'), 'utf8');

test('Minecraft connection test is tenant-guarded and bounded', () => {
  assert.match(serverSource, /app\.post\('\/api\/guilds\/:guildId\/connection-test', isAuthenticated, requireGuildManager, requireDatabaseReady/);
  assert.match(serverSource, /api\.mcstatus\.io\/v2\/status\/java/);
  assert.match(serverSource, /setTimeout\(\(\) => controller\.abort\(\), 8000\)/);
  assert.match(serverSource, /minecraft_connection_not_configured/);
});

test('Intelligence setup exposes an explicit connection test action', () => {
  assert.match(pageSource, /id="testConnectionButton"/);
  assert.match(pageSource, /connection-test/);
  assert.match(pageSource, /Testing the Minecraft connection/);
});
