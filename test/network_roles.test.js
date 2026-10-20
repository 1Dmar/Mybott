const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const NetworkRole = require('../bot/Models/NetworkRole');

const source = fs.readFileSync(require.resolve('../dash/index.js'), 'utf8');
const rolesPage = fs.readFileSync(require.resolve('../dash/dashboard/pages/network-roles.html'), 'utf8');

test('network roles have one bounded assignment per user and guild', () => {
  const indexes = NetworkRole.schema.indexes();
  assert.ok(indexes.some(([fields, options]) => fields.guildId === 1 && fields.userId === 1 && options.unique === true));
  assert.deepEqual(NetworkRole.schema.path('role').enumValues, ['owner', 'network_admin', 'server_manager', 'moderator', 'viewer']);
});

test('network role mutations are restricted to the Discord owner and bounded', () => {
  assert.match(source, /network-roles\/:userId', isAuthenticated, requireGuildManager, requireDatabaseReady/);
  assert.match(source, /discord_owner_required/);
  assert.match(source, /serverIds.*slice\(0, 200\)/s);
  assert.match(source, /network_role_updated/);
});

test('network roles have a server-scoped management page', () => {
  assert.match(source, /'network-roles'/);
  assert.match(rolesPage, /network-roles/);
  assert.match(rolesPage, /Only the Discord server owner can manage/);
  assert.match(rolesPage, /method:'PUT'/);
});
