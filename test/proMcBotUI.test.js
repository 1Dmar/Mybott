const test = require('node:test');
const assert = require('node:assert/strict');
const { COLORS, serverHealth, intelligence, error, loading } = require('../bot/utils/proMcBotUI');

test('server health uses measured values and state-specific color', () => {
  const embed = serverHealth({
    instance: { instanceId: 'primary', status: 'online', lastSeenAt: new Date(Date.now() - 60_000) },
    playerCount: { data: { onlinePlayers: 24, latency: 42, version: '1.21.8' } },
  });
  assert.equal(embed.data.color, COLORS.success);
  assert.equal(embed.data.title, 'Server Health');
  assert.ok(embed.data.fields.some(item => item.name === 'PLAYERS' && item.value === '24 online'));
  assert.ok(embed.data.fields.some(item => item.name === 'LATENCY' && item.value === '42ms'));
  assert.ok(embed.data.fields.some(item => item.name === 'MINECRAFT' && item.value === '1.21.8'));
});

test('intelligence makes insufficient data intentional without inventing analytics', () => {
  const embed = intelligence({ summary: { confidence: 'insufficient', message: 'Not enough data yet.', sample: { events: 1 }, analysis: [] } });
  assert.equal(embed.data.color, COLORS.neutral);
  assert.ok(embed.data.fields.some(item => item.name === 'NEXT SIGNAL'));
  assert.equal(embed.data.fields.some(item => item.value.includes('0%')), false);
});

test('shared states have consistent premium hierarchy', () => {
  const failed = error({ reason: 'Permission denied', action: 'Ask a server administrator.' });
  const pending = loading({ title: 'Checking Server', message: 'Connecting to server telemetry...' });
  assert.match(failed.data.description, /could not complete/);
  assert.ok(failed.data.fields.some(item => item.name === 'REASON'));
  assert.equal(pending.data.color, COLORS.info);
  assert.match(pending.data.description, /Connecting/);
});
