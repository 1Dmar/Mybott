'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Review = require('../bot/Models/Review');

const home = fs.readFileSync(require.resolve('../dash/dashboard/home.html'), 'utf8');

test('review model is moderation-first and bounded', () => {
  assert.deepEqual(Review.schema.path('status').enumValues, ['pending', 'approved', 'rejected']);
  assert.equal(Review.schema.path('body').options.maxlength, 1200);
  assert.equal(Review.schema.path('title').options.maxlength, 120);
  assert.equal(Review.schema.path('consentToPublish').options.required, true);
  assert.equal(Review.schema.path('rating').options.min, 1);
  assert.equal(Review.schema.path('rating').options.max, 5);
});

test('homepage review system has no provider branding or fabricated fallback stats', () => {
  assert.match(home, /id="reviewList"/);
  assert.match(home, /id="reviewForm"/);
  assert.match(home, /awaiting moderation/);
  assert.doesNotMatch(home, /trustpilot|trustscore|star rating|review count/i);
  assert.doesNotMatch(home, /(?:\b[1-5](?:\.\d+)?\s*\/\s*5\b|\b[0-9]+\s+reviews?\b)/i);
});

test('homepage keeps a single primary closing CTA', () => {
  assert.equal((home.match(/class="final-cta"/g) || []).length, 1);
  assert.equal((home.match(/id="community-feedback"/g) || []).length, 1);
});
