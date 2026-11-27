'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const commandPath = require.resolve('../bot/Commands/Slash/Misc/playercard.js');
const source = fs.readFileSync(commandPath, 'utf8');
const command = require(commandPath);

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
  assert.match(source, /cardState: !plugin \? 'server_not_configured' : !pluginOnline \? 'server_offline'/);
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
