'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const { COMMAND_CATALOG, loadCanonicalCommands } = require('../bot/commands/commandCatalog');

const legacy = new Set(['setup_server', 'remove_server', 'setlanguage', 'automod-settings', 'mc-info', 'mc-players', 'mc-player', 'mc-setup', 'generate-apikey', 'link-apikey']);

test('canonical Discord taxonomy has eight unique top-level groups', () => {
  const names = COMMAND_CATALOG.map(command => command.name);
  assert.equal(names.length, 8);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(names, ['server', 'minecraft', 'intelligence', 'moderation', 'premium', 'utility', 'admin', 'help']);
});

test('canonical commands have descriptions and no legacy public names', () => {
  for (const command of COMMAND_CATALOG) {
    assert.ok(command.description);
    for (const [name, description] of command.subcommands || []) {
      assert.ok(description);
      assert.equal(legacy.has(name), false);
      assert.equal(legacy.has(command.name), false);
    }
  }
});

test('management and premium groups carry runtime permission metadata', () => {
  const byName = Object.fromEntries(loadCanonicalCommands().map(command => [command.name, command]));
  assert.equal(byName.server.userPermissions, PermissionFlagsBits.ManageGuild);
  assert.equal(byName.minecraft.userPermissions, PermissionFlagsBits.ManageGuild);
  assert.equal(byName.intelligence.userPermissions, PermissionFlagsBits.ManageGuild);
  assert.equal(byName.premium.userPermissions, PermissionFlagsBits.ManageGuild);
  assert.equal(byName.admin.userPermissions, PermissionFlagsBits.Administrator);
  assert.equal(byName.utility.userPermissions, undefined);
});

test('help is registered from the same canonical surface', () => {
  const help = loadCanonicalCommands().find(command => command.name === 'help');
  assert.ok(help);
  assert.equal(help.type1, 'slash');
  assert.equal(typeof help.run, 'function');
});
