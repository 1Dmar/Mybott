'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const commandPath = require.resolve('../bot/Commands/Message/Misc/mc.js');
const source = fs.readFileSync(commandPath, 'utf8');

test('mc command prefers the first-party plugin heartbeat for the current guild', () => {
  assert.match(source, /PluginInstance\.findOne/);
  assert.match(source, /PLUGIN_FRESHNESS_MS/);
  assert.match(source, /plugin\.lastOnlinePlayers/);
  assert.match(source, /ProMcBot plugin heartbeat/);
});

test('mc command keeps external status API as a fallback only', () => {
  const pluginBranch = source.indexOf('if (pluginOnline)');
  const externalLookup = source.indexOf('api.mcsrvstat.us');
  assert.ok(pluginBranch >= 0);
  assert.ok(externalLookup > pluginBranch);
  assert.match(source, /currently offline/);
});
