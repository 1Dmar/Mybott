const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const PlayerIdentity = require('../bot/Models/PlayerIdentity');
const PlayerLinkClaim = require('../bot/Models/PlayerLinkClaim');

const dashboard = fs.readFileSync(require.resolve('../dash/index.js'), 'utf8');
const playerPage = fs.readFileSync(require.resolve('../dash/dashboard/pages/player.html'), 'utf8');
const plugin = fs.readFileSync(require.resolve('../plugin/src/main/java/com/promcbot/plugin/ProMcBotPlugin.java'), 'utf8');
const pluginDescriptor = fs.readFileSync(require.resolve('../plugin/src/main/resources/plugin.yml'), 'utf8');

test('player identity is tenant-scoped and privacy-first', () => {
  const indexes = PlayerIdentity.schema.indexes();
  assert.ok(indexes.some(([fields, options]) => fields.serverId === 1 && fields.uuid === 1 && options.unique === true));
  assert.equal(PlayerIdentity.schema.path('privacy.showUsername').defaultValue, true);
  assert.equal(PlayerIdentity.schema.path('privacy.showStats').defaultValue, true);
  assert.equal(PlayerIdentity.schema.path('privacy.showServer').defaultValue, false);
});

test('player link claims are hashed, expiring, and one-time', () => {
  assert.equal(PlayerLinkClaim.schema.path('codeHash').options.required, true);
  assert.equal(PlayerLinkClaim.schema.path('status').enumValues.includes('consumed'), true);
  assert.ok(PlayerLinkClaim.schema.indexes().some(([fields, options]) => fields.expiresAt === 1 && options.expireAfterSeconds === 0));
  assert.match(dashboard, /codeHash: hashToken\(code\)/);
  assert.match(dashboard, /status: 'consumed'/);
});

test('player link requires an in-game command and signed telemetry event', () => {
  assert.match(plugin, /args\[0\]\.equalsIgnoreCase\("link"\)/);
  assert.match(plugin, /enqueue\("player_link"/);
  assert.match(dashboard, /processPlayerLinkEvents\(documents\)/);
  assert.match(dashboard, /PlayerIdentity\.findOneAndUpdate/);
  assert.match(dashboard, /normalized\.slice\(0, 8\).*normalized\.slice\(8, 12\)/s);
  assert.match(pluginDescriptor, /promcbot link <code>/);
});

test('Player Center exposes claim and privacy controls', () => {
  assert.match(dashboard, /app\.get\('\/player', isAuthenticated/);
  assert.match(playerPage, /Generate one-time code/);
  assert.match(playerPage, /showStats/);
  assert.match(playerPage, /\/api\/player\/links\/claim/);
});
