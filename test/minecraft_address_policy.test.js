const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMinecraftAddress, isSafeMinecraftAddress } = require('../bot/utils/minecraftAddressPolicy');
const { normalizeMinecraftSettings } = require('../dash/settingsValidation');

test('Minecraft address policy accepts DNS names, IPv4, and bracketed IPv6', () => {
  assert.equal(normalizeMinecraftAddress('Play.Example.COM'), 'play.example.com');
  assert.equal(normalizeMinecraftAddress('203.0.113.10'), '203.0.113.10');
  assert.equal(normalizeMinecraftAddress('[2001:db8::1]'), '[2001:db8::1]');
  assert.equal(isSafeMinecraftAddress('localhost'), true);
});

test('Minecraft address policy rejects URL schemes, paths, credentials, and control characters', () => {
  for (const value of ['https://example.com', 'example.com/path', 'example.com:25565', 'user@example.com', 'example.com?x=1', 'bad host', '']) {
    assert.equal(isSafeMinecraftAddress(value), false, value);
  }
});

test('settings reject unsafe Minecraft addresses before persistence', () => {
  assert.equal(normalizeMinecraftSettings({ mcIp: 'http://127.0.0.1', mcPort: 25565 }).error, 'invalid_minecraft_address');
  assert.equal(normalizeMinecraftSettings({ mcIp: 'play.example.com', mcPort: 25565 }).settings.mcIp, 'play.example.com');
});
