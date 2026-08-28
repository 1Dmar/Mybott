const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexSource = fs.readFileSync(path.join(__dirname, '..', 'dash', 'index.js'), 'utf8');

test('every guild-scoped API route is authorization guarded', () => {
  const routePattern = /app\.(?:get|post|put|patch|delete)\('\/api\/guilds\/:guildId[^']*',[^\n]+/g;
  const routes = indexSource.match(routePattern) || [];
  assert.ok(routes.length >= 20);
  for (const route of routes) assert.match(route, /requireGuildManager/);
});

test('sensitive child resource updates include the parent tenant in their database filter', () => {
  const requiredPatterns = [
    /resolveNotification\(req\.params\.guildId, req\.params\.notificationId\)/,
    /AutomationRule\.findOneAndUpdate\(\{ _id: req\.params\.ruleId, serverId: req\.params\.guildId \}/,
    /AutomationRule\.findOneAndDelete\(\{ _id: req\.params\.ruleId, serverId: req\.params\.guildId \}/,
    /PluginCredential\.updateOne\(\{ serverId: req\.params\.guildId, instanceId,/,
    /PluginInstance\.updateOne\(\{ serverId: req\.params\.guildId, instanceId \}/,
  ];
  for (const pattern of requiredPatterns) assert.match(indexSource, pattern);
});
