const test = require('node:test');
const assert = require('node:assert/strict');
const { signRequest, hashToken } = require('../bot/utils/pluginCrypto');
const { summarizeTelemetry } = require('../bot/utils/intelligenceEngine');

const now = Date.now();

test('plugin request signatures are deterministic and token hashes are one-way identifiers', () => {
  const signature = signRequest('secret', '1700000000', 'nonce-1', '{"events":[]}');
  assert.equal(signature, signRequest('secret', '1700000000', 'nonce-1', '{"events":[]}'));
  assert.notEqual(signature, signRequest('wrong', '1700000000', 'nonce-1', '{"events":[]}'));
  assert.equal(hashToken('token'), hashToken('token'));
  assert.notEqual(hashToken('token'), 'token');
});

test('intelligence returns insufficient data instead of inventing a trend', () => {
  const summary = summarizeTelemetry([], now);
  assert.equal(summary.confidence, 'insufficient');
  assert.equal(summary.analysis[0].key, 'insufficient_data');
  assert.equal(summary.recommendations.length, 0);
});

test('intelligence computes an evidence-backed activity decline', () => {
  const recent = Array.from({ length: 11 }, (_, index) => ({ type: 'player_count', occurredAt: new Date(now - (index + 1) * 60 * 60 * 1000), data: { onlinePlayers: 80 } }));
  const previous = Array.from({ length: 10 }, (_, index) => ({ type: 'player_count', occurredAt: new Date(now - 8 * 24 * 60 * 60 * 1000 - index * 60 * 60 * 1000), data: { onlinePlayers: 100 } }));
  const summary = summarizeTelemetry([...recent, ...previous], now);
  const trend = summary.analysis.find(item => item.key === 'activity_trend');
  assert.equal(summary.confidence, 'high');
  assert.equal(trend.changePercent, -20);
  assert.equal(summary.recommendations.length, 1);
});
