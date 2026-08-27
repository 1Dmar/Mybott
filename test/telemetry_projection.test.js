'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { latestOnlinePlayers } = require('../bot/utils/telemetryProjection');

test('telemetry projection reads online players from heartbeat and player_count only', () => {
  assert.equal(latestOnlinePlayers([{ type: 'heartbeat', data: { onlinePlayers: 17 } }]), 17);
  assert.equal(latestOnlinePlayers([{ type: 'player_count', data: { onlinePlayers: 4 } }]), 4);
  assert.equal(latestOnlinePlayers([{ type: 'player_join', data: { onlinePlayers: 99 } }]), null);
  assert.equal(latestOnlinePlayers([{ type: 'heartbeat', data: { onlinePlayers: 'not-a-number' } }]), null);
});

test('telemetry projection clamps negative player counts and never returns NaN', () => {
  assert.equal(latestOnlinePlayers([{ type: 'heartbeat', data: { onlinePlayers: -3 } }]), 0);
  assert.equal(Number.isNaN(latestOnlinePlayers([])), false);
});
