'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generatePremiumKey, verifyPremiumKey } = require('../bot/utils/premiumCode');

test('legacy premium codes fail closed without an explicit secret', () => {
  const previous = process.env.LEGACY_PREMIUM_CODE_SECRET;
  delete process.env.LEGACY_PREMIUM_CODE_SECRET;
  try {
    assert.throws(() => generatePremiumKey(25565, 30), /legacy_premium_codes_disabled/);
    assert.equal(verifyPremiumKey('anything', 25565), false);
  } finally {
    if (previous === undefined) delete process.env.LEGACY_PREMIUM_CODE_SECRET;
    else process.env.LEGACY_PREMIUM_CODE_SECRET = previous;
  }
});
