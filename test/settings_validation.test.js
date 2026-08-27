'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildServerInfoUpdate, normalizeMinecraftSettings } = require('../dash/settingsValidation');

test('settings validation normalizes Minecraft address and port', () => {
  assert.deepEqual(normalizeMinecraftSettings({ prefix: '  ?', language: 'ar', mcIp: ' play.example.com ', mcPort: '25570' }), {
    ok: true,
    settings: { prefix: '?', language: 'ar', mcIp: 'play.example.com', mcPort: 25570 },
  });
  assert.equal(normalizeMinecraftSettings({ mcIp: 'play.example.com' }).settings.mcPort, 25565);
});

test('settings validation rejects invalid Minecraft ports', () => {
  assert.deepEqual(normalizeMinecraftSettings({ mcPort: 0 }), { ok: false, error: 'invalid_minecraft_port' });
  assert.deepEqual(normalizeMinecraftSettings({ mcPort: 65536 }), { ok: false, error: 'invalid_minecraft_port' });
  assert.deepEqual(normalizeMinecraftSettings({ mcPort: '25565.5' }), { ok: false, error: 'invalid_minecraft_port' });
});

test('ServerInfo update persists Java IP and port for basic Minecraft consumers', () => {
  assert.deepEqual(buildServerInfoUpdate({ mcIp: 'play.example.com', mcPort: 25570 }), {
    $set: { javaPort: 25570, javaIP: 'play.example.com', serverType: 'java' },
  });
});

test('ServerInfo update unsets optional Java address without inventing a connection', () => {
  assert.deepEqual(buildServerInfoUpdate({ mcIp: '', mcPort: 25565 }), {
    $set: { javaPort: 25565 },
    $unset: { javaIP: '', serverType: '' },
  });
});
