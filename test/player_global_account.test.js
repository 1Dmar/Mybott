const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const PlayerAccount = require('../bot/Models/PlayerAccount');
const MinecraftIdentity = require('../bot/Models/MinecraftIdentity');
const PlayerServerLink = require('../bot/Models/PlayerServerLink');
const PlayerCardSettings = require('../bot/Models/PlayerCardSettings');

const source = fs.readFileSync(require.resolve('../dash/index.js'), 'utf8');

test('player account is global and unique per Discord user', () => {
  assert.equal(PlayerAccount.schema.path('discordUserId').options.unique, true);
  assert.equal(PlayerAccount.schema.path('globalPrivacy.showServers').defaultValue, false);
  assert.equal(PlayerAccount.schema.path('globalPrivacy.showAchievements').defaultValue, true);
});

test('Minecraft identity is separate from server scope', () => {
  assert.equal(MinecraftIdentity.schema.path('accountType').enumValues.join(','), 'online,offline,unknown');
  assert.equal(MinecraftIdentity.schema.path('verificationLevel').enumValues.includes('server_scoped'), true);
  assert.ok(PlayerServerLink.schema.path('accountId').options.required);
  assert.ok(PlayerServerLink.schema.path('serverId').options.required);
  assert.ok(PlayerServerLink.schema.indexes().some(([fields, options]) => fields.accountId === 1 && fields.identityId === 1 && fields.serverId === 1 && options.unique === true));
});

test('card settings are bounded and do not accept arbitrary templates or colors', () => {
  assert.deepEqual(PlayerCardSettings.schema.path('template').enumValues, ['darkmode', 'glass', 'minimal', 'minecraft']);
  assert.equal(PlayerCardSettings.schema.path('bio').options.maxlength, 240);
  assert.equal(PlayerCardSettings.schema.path('accentColor').options.default, '#5865f2');
  assert.equal(PlayerCardSettings.schema.path('accountId').options.unique, true);
});

test('global account API returns scoped links and measured aggregate stats', () => {
  assert.match(source, /app\.get\('\/api\/player\/account', isAuthenticated/);
  assert.match(source, /globalStats/);
  assert.match(source, /measuredPlayerStats\(link\.serverId, identity\.uuid\)/);
  assert.match(source, /app\.patch\('\/api\/player\/card', isAuthenticated/);
  assert.match(source, /body\.bio\.trim\(\)\.slice\(0, 240\)/);
});

test('Player Center explains global account versus server-scoped activity', () => {
  const page = fs.readFileSync(require.resolve('../dash/dashboard/pages/player.html'), 'utf8');
  assert.match(page, /Global player account/);
  assert.match(page, /Server-scoped activity/);
  assert.match(page, /cracked\/offline accounts/);
  assert.match(page, /\/api\/player\/account/);
  assert.match(page, /\/api\/player\/card/);
});

test('player link processing creates the global account and server link', () => {
  assert.match(source, /PlayerAccount\.findOneAndUpdate/);
  assert.match(source, /MinecraftIdentity\.findOneAndUpdate/);
  assert.match(source, /PlayerServerLink\.findOneAndUpdate/);
  assert.match(source, /accountType: 'unknown'/);
});
