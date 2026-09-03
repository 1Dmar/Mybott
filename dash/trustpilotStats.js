'use strict';

const PROFILE_URL = 'https://www.trustpilot.com/review/promcbot.dev';
const CACHE_TTL_MS = 15 * 60 * 1000;

let cache = { value: null, expiresAt: 0 };

function finiteNumber(value, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

function getConfiguredStats() {
  const score = finiteNumber(process.env.TRUSTPILOT_SCORE, 0, 5);
  const reviewCount = finiteNumber(process.env.TRUSTPILOT_REVIEW_COUNT, 0, Number.MAX_SAFE_INTEGER);
  const stars = score === null ? null : Math.round(score * 2) / 2;
  const hasConfiguredStats = score !== null && reviewCount !== null;

  return {
    score: hasConfiguredStats ? score : null,
    stars: hasConfiguredStats ? stars : null,
    reviewCount: hasConfiguredStats ? Math.floor(reviewCount) : null,
    source: hasConfiguredStats ? 'operator-configured' : 'trustpilot-profile',
    lastUpdated: hasConfiguredStats ? (process.env.TRUSTPILOT_STATS_UPDATED_AT || null) : null,
    profileUrl: PROFILE_URL,
    available: hasConfiguredStats,
  };
}

function getTrustpilotStats() {
  const now = Date.now();
  if (cache.value && cache.expiresAt > now) return cache.value;
  const value = getConfiguredStats();
  cache = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}

function clearTrustpilotStatsCache() {
  cache = { value: null, expiresAt: 0 };
}

module.exports = { PROFILE_URL, CACHE_TTL_MS, getTrustpilotStats, clearTrustpilotStatsCache };
