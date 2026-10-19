const test = require('node:test');
const assert = require('node:assert/strict');
const { validateManualGrantInput, calculateManualGrantWindow } = require('../bot/utils/manualSubscriptionService');

test('manual subscription grants validate a server-scoped Pro or Ultimate request', () => {
  assert.deepEqual(validateManualGrantInput({ guildId: '123456789012345678', plan: 'pro', durationDays: 30, cooldownHours: 24 }), {
    guildId: '123456789012345678', plan: 'pro', durationDays: 30, cooldownHours: 24,
  });
  assert.deepEqual(validateManualGrantInput({ guildId: '123456789012345678', plan: 'ultimate', durationDays: 90, cooldownHours: 72 }).plan, 'ultimate');
  assert.throws(() => validateManualGrantInput({ guildId: 'not-a-guild', plan: 'pro', durationDays: 30, cooldownHours: 24 }), error => error.code === 'invalid_guild_id');
  assert.throws(() => validateManualGrantInput({ guildId: '123456789012345678', plan: 'free', durationDays: 30, cooldownHours: 24 }), error => error.code === 'invalid_manual_plan');
});

test('manual grant window extends from an active server entitlement', () => {
  const now = new Date('2026-10-19T00:00:00.000Z');
  const currentEnd = new Date('2026-10-25T00:00:00.000Z');
  const window = calculateManualGrantWindow({ currentPeriodEnd: currentEnd, durationDays: 30, now });
  assert.equal(window.start.toISOString(), now.toISOString());
  assert.equal(window.end.toISOString(), '2026-11-24T00:00:00.000Z');
});
