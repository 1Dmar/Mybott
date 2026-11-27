'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const commandPath = require.resolve('../bot/Commands/Slash/Misc/playercard.js');
const source = fs.readFileSync(commandPath, 'utf8');
const command = require(commandPath);
const rendererSource = fs.readFileSync(require.resolve('../bot/utils/playerCardGenerator.js'), 'utf8');

test('playercard is a short server-scoped command with optional template only', () => {
  assert.equal(command.name, 'playercard');
  assert.equal(command.options.some(option => option.name === 'scope'), false);
  assert.equal(command.options.find(option => option.name === 'template').required, false);
  assert.match(source, /PlayerAccount\.findOne/);
  assert.match(source, /MinecraftIdentity\.find/);
  assert.match(source, /interaction\.guild\.id/);
});

test('playercard selects only the current server link and measured events', () => {
  assert.match(source, /PluginInstance\.findOne/);
  assert.match(source, /PLUGIN_FRESHNESS_MS/);
  assert.match(source, /PlayerServerLink\.findOne\(/);
  assert.match(source, /serverId: interaction\.guild\.id/);
  assert.match(source, /TelemetryEvent\.find/);
  assert.match(source, /type: \{ \$in: \['player_join', 'player_leave'\] \}/);
});

test('playercard keeps public lookup isolated to the current server', () => {
  assert.match(source, /Public Minecraft name lookup/);
  assert.match(source, /legacyIgn/);
  assert.match(source, /لا يمكن استخدام IGN مع بطاقة عضو آخر/);
});

test('legacy IGN cards use server telemetry when the player has already joined', () => {
  assert.match(source, /const legacyEvents = await TelemetryEvent\.find/);
  assert.match(source, /'data\.username': new RegExp/);
  assert.match(source, /cardState: 'measured'/);
  assert.match(source, /legacyStats/);
});

test('staff badge permissions are resolved from the card target, not the command invoker', () => {
  assert.match(source, /targetMember = null/);
  assert.match(source, /interaction\.guild\.members\.fetch\(targetUser\.id\)/);
  assert.match(source, /const memberPermissions = targetMember\?\.permissions/);
  assert.doesNotMatch(source, /interaction\.member\?\.permissions/);
});

test('player card uses the supplied layout for avatar, account identity, status, and reserved slots', () => {
  assert.match(rendererSource, /player-card-template\.png/);
  assert.match(rendererSource, /const avatarX = 245, avatarY = 238/);
  assert.match(rendererSource, /Original Account/);
  assert.match(rendererSource, /Verification check: visible only for an original account/);
  assert.match(rendererSource, /Online\/offline: replace only the status text\/dot/);
  assert.match(rendererSource, /three lower cards remain the exact empty placeholders/);
});

test('playercard passes real measured stats and badges to the renderer', () => {
  assert.match(source, /sessionSeconds/);
  assert.match(source, /activeDays/);
  assert.match(source, /buildBadges/);
  assert.match(source, /badges:/);
  assert.match(source, /generatePlayerCard\(ign \|\| targetUser\.username, template, rendererServerConfig, profileContext\)/);
});

test('playercard does not use the legacy API token to decide server status', () => {
  assert.match(source, /rendererServerConfig/);
  assert.match(source, /wallpaper: serverConfig\.wallpaper/);
  assert.match(source, /cardState: hasMeasuredActivity \? 'measured'/);
});

test('playercard preserves verified presence when raw telemetry is empty or the server is offline', () => {
  assert.match(source, /hasVerifiedServerPresence = Boolean\(link\?\.firstSeenAt\)/);
  assert.match(source, /expired raw telemetry as "never joined"/);
  assert.match(source, /const fallbackFirstSeenAt = link\?\.firstSeenAt/);
  assert.match(source, /joins: 1/);
  assert.match(source, /Historical presence wins over current server availability/);
});

test('playercard creates explicit state for setup, offline, and never-joined cases', () => {
  assert.match(source, /server_not_configured/);
  assert.match(source, /server_offline/);
  assert.match(source, /never_joined/);
  assert.match(source, /SETUP REQUIRED|server_not_configured/);
});

test('playercard only exposes the template and player target as optional parameters', () => {
  const optionNames = command.options.map(option => option.name);
  assert.deepEqual(optionNames, ['template', 'ign', 'user']);
});
