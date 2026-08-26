const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzePlayers } = require('../bot/utils/playerIntelligenceEngine');
const { summarizeNetwork } = require('../bot/utils/networkIntelligenceEngine');

test('player intelligence returns insufficient data for empty telemetry', () => {
  const result = analyzePlayers([], Date.parse('2026-01-15T00:00:00Z'));
  assert.equal(result.message, 'Not enough data yet.');
  assert.equal(result.sample.players, 0);
});

test('player journey counts real joins and measurable leave duration', () => {
  const now = Date.parse('2026-01-15T00:00:00Z');
  const events = [
    { type: 'player_join', occurredAt: '2026-01-10T12:00:00Z', data: { uuid: 'a', username: 'A' } },
    { type: 'player_leave', occurredAt: '2026-01-10T12:10:00Z', data: { uuid: 'a', username: 'A', sessionSeconds: 600 } },
    { type: 'player_join', occurredAt: '2026-01-12T12:00:00Z', data: { uuid: 'a', username: 'A' } },
    { type: 'player_join', occurredAt: '2026-01-14T12:00:00Z', data: { uuid: 'b', username: 'B' } },
  ];
  const result = analyzePlayers(events, now);
  assert.equal(result.sample.players, 2);
  assert.equal(result.players.find(player => player.uuid === 'a').sessionSeconds, 600);
  assert.equal(result.retention.newPlayers7d, 2);
});

test('network intelligence compares only measured instances', () => {
  const now = Date.parse('2026-01-15T00:00:00Z');
  const instances = [{ instanceId: 'survival', serverName: 'Survival', status: 'online' }, { instanceId: 'lobby', serverName: 'Lobby', status: 'offline' }];
  const events = [{ instanceId: 'survival', type: 'player_count', occurredAt: '2026-01-14T00:00:00Z', data: { onlinePlayers: 20 } }, { instanceId: 'survival', type: 'player_count', occurredAt: '2026-01-14T01:00:00Z', data: { onlinePlayers: 30 } }];
  const result = summarizeNetwork(instances, events, now);
  assert.equal(result.serverCount, 2);
  assert.equal(result.measuredServerCount, 1);
  assert.equal(result.topPerformingServer.serverName, 'Survival');
  assert.equal(result.weakestPerformingServer.serverName, 'Survival');
});
