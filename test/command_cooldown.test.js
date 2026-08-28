const test = require('node:test');
const assert = require('node:assert/strict');
const { consumeCommandCooldown, getCooldownMs } = require('../bot/utils/commandCooldown');

test('slash cooldown is scoped to user, guild, and command', () => {
  const store = new Map();
  const command = { userPermissions: 1n };
  assert.equal(consumeCommandCooldown(store, { userId: 'u1', guildId: 'g1', commandName: 'setup' }, command, 1000).allowed, true);
  assert.equal(consumeCommandCooldown(store, { userId: 'u1', guildId: 'g1', commandName: 'setup' }, command, 2000).allowed, false);
  assert.equal(consumeCommandCooldown(store, { userId: 'u2', guildId: 'g1', commandName: 'setup' }, command, 2000).allowed, true);
  assert.equal(consumeCommandCooldown(store, { userId: 'u1', guildId: 'g2', commandName: 'setup' }, command, 2000).allowed, true);
  assert.equal(consumeCommandCooldown(store, { userId: 'u1', guildId: 'g1', commandName: 'status' }, command, 2000).allowed, true);
});

test('explicit command cooldown is converted from seconds and minimum is bounded', () => {
  assert.equal(getCooldownMs({ cooldown: 5 }), 5000);
  assert.equal(getCooldownMs({ cooldown: 0.1 }), 500);
  assert.equal(getCooldownMs({ cooldown: false }), 0);
});

test('missing identity cannot create a shared usable cooldown key', () => {
  const store = new Map();
  const command = { userPermissions: 1n };
  const first = consumeCommandCooldown(store, { commandName: 'setup' }, command, 1000);
  const second = consumeCommandCooldown(store, { commandName: 'setup' }, command, 1001);
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
});
