const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(require.resolve('../dash/index.js'), 'utf8');

test('Network dashboard aggregates only authorized, bounded server data', () => {
  assert.match(source, /app\.get\('\/api\/guilds\/:guildId\/network-dashboard', isAuthenticated, requireGuildManager, requireDatabaseReady/);
  assert.match(source, /PluginInstance\.find\(\{ serverId: guildId, revokedAt: null \}\).*limit\(200\)/s);
  assert.match(source, /Notification\.find\(\{ guildId \}\).*limit\(50\)/s);
  assert.match(source, /AutomationExecution\.find\(\{ serverId: guildId \}\).*limit\(100\)/s);
  assert.match(source, /feature_requires_ultimate/);
  assert.match(source, /usageByFeature/);
});
