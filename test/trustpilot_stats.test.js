const test = require('node:test');
const assert = require('node:assert/strict');

const modulePath = require.resolve('../dash/trustpilotStats');

function loadProvider(environment) {
  const previous = {
    score: process.env.TRUSTPILOT_SCORE,
    count: process.env.TRUSTPILOT_REVIEW_COUNT,
    updated: process.env.TRUSTPILOT_STATS_UPDATED_AT,
  };
  for (const key of ['TRUSTPILOT_SCORE', 'TRUSTPILOT_REVIEW_COUNT', 'TRUSTPILOT_STATS_UPDATED_AT']) delete process.env[key];
  Object.assign(process.env, environment);
  delete require.cache[modulePath];
  const provider = require(modulePath);
  const stats = provider.getTrustpilotStats();
  delete require.cache[modulePath];
  for (const [key, value] of Object.entries({ TRUSTPILOT_SCORE: previous.score, TRUSTPILOT_REVIEW_COUNT: previous.count, TRUSTPILOT_STATS_UPDATED_AT: previous.updated })) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  return stats;
}

test('Trustpilot provider returns transparent fallback when no permitted values are configured', () => {
  const stats = loadProvider({});
  assert.equal(stats.available, false);
  assert.equal(stats.score, null);
  assert.equal(stats.stars, null);
  assert.equal(stats.reviewCount, null);
  assert.equal(stats.profileUrl, 'https://www.trustpilot.com/review/promcbot.dev');
});

test('Trustpilot provider validates and returns fractional configured values', () => {
  const stats = loadProvider({ TRUSTPILOT_SCORE: '4.7', TRUSTPILOT_REVIEW_COUNT: '123', TRUSTPILOT_STATS_UPDATED_AT: '2026-09-03' });
  assert.equal(stats.available, true);
  assert.equal(stats.score, 4.7);
  assert.equal(stats.stars, 4.5);
  assert.equal(stats.reviewCount, 123);
  assert.equal(stats.lastUpdated, '2026-09-03');
});

test('Trustpilot provider rejects incomplete or out-of-range values', () => {
  const stats = loadProvider({ TRUSTPILOT_SCORE: '5.5', TRUSTPILOT_REVIEW_COUNT: '-1' });
  assert.equal(stats.available, false);
  assert.equal(stats.score, null);
  assert.equal(stats.reviewCount, null);
});
