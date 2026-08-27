'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPublicStats } = require('../dash/publicStats');

const now = Date.parse('2026-08-27T12:00:00.000Z');

test('public stats returns measured aggregates and excludes player identity fields', () => {
  const result = buildPublicStats([
    { type: 'player_join', occurredAt: '2026-08-27T10:00:00.000Z', data: { playerName: 'SecretPlayer' } },
    { type: 'player_count', occurredAt: '2026-08-27T11:00:00.000Z', data: { onlinePlayers: 17 } },
    { type: 'player_leave', occurredAt: '2026-08-27T11:30:00.000Z', data: { uuid: 'private' } },
  ], { lastSeenAt: '2026-08-27T11:59:00.000Z', lastOnlinePlayers: 16 }, now);
  assert.equal(result.measured, true);
  assert.equal(result.playerJoins, 1);
  assert.equal(result.playerLeaves, 1);
  assert.equal(result.latestOnlinePlayers, 17);
  assert.equal(result.plugin.online, true);
  assert.equal(result.privacy.excludesPlayerNames, true);
  assert.equal(Object.hasOwn(result, 'players'), false);
  assert.equal(Object.hasOwn(result, 'rawEvents'), false);
});

test('public stats uses plugin projection only when no recent count exists', () => {
  const result = buildPublicStats([], { lastSeenAt: '2026-08-27T11:59:00.000Z', lastOnlinePlayers: 4 }, now);
  assert.equal(result.measured, false);
  assert.equal(result.latestOnlinePlayers, 4);
  assert.equal(result.eventCount, 0);
  assert.equal(result.plugin.online, true);
});

test('public stats ignores stale events and invalid counts', () => {
  const result = buildPublicStats([
    { type: 'player_count', occurredAt: '2026-08-25T11:00:00.000Z', data: { onlinePlayers: 99 } },
    { type: 'heartbeat', occurredAt: '2026-08-27T11:00:00.000Z', data: { onlinePlayers: 'not-a-number' } },
  ], null, now);
  assert.equal(result.measured, true);
  assert.equal(result.eventCount, 1);
  assert.equal(result.latestOnlinePlayers, null);
  assert.equal(result.plugin.online, false);
});
