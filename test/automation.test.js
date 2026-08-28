'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { dedupeKey, renderMessage, deliverWithRetry, tryAcquireExecutionSlot, releaseExecutionSlot, automationLockKey, acquireDistributedLock } = require('../bot/utils/automationEngine');
const { WINDOW_MS } = require('../bot/utils/intelligenceEngine');

test('automation dedupe keys are stable within a period and distinct across periods', () => {
  const rule = { _id: 'rule-1', trigger: 'weekly_summary' };
  const monday = Date.parse('2026-08-24T12:00:00.000Z');
  const sunday = Date.parse('2026-08-30T12:00:00.000Z');
  const nextMonday = Date.parse('2026-08-31T12:00:00.000Z');
  assert.equal(dedupeKey(rule, monday), dedupeKey(rule, sunday));
  assert.notEqual(dedupeKey(rule, monday), dedupeKey(rule, nextMonday));
});

test('activity automation dedupe key changes with the intelligence window', () => {
  const rule = { _id: 'rule-2', trigger: 'activity_decline' };
  assert.equal(dedupeKey(rule, 10), dedupeKey(rule, 10));
  assert.notEqual(dedupeKey(rule, 10), dedupeKey(rule, WINDOW_MS * 2));
});

test('automation message rendering uses measured activity change', () => {
  const summary = { analysis: [{ key: 'activity_trend', changePercent: -12.345 }] };
  assert.equal(renderMessage('Change: {{activityChange}}', summary), 'Change: -12.35%');
});

test('automation lock keys are stable and tenant-scoped', () => {
  const rule = { _id: 'rule-1', serverId: 'guild-1', trigger: 'weekly_summary' };
  assert.equal(automationLockKey(rule, 1700000000000), automationLockKey(rule, 1700000000000));
  assert.notEqual(automationLockKey(rule, 1700000000000), automationLockKey({ ...rule, serverId: 'guild-2' }, 1700000000000));
});

test('distributed automation lock fails closed while Mongo is disconnected', async () => {
  assert.equal(await acquireDistributedLock('automation:test:lock'), false);
});

test('automation execution slots prevent local overlap and release safely', () => {
  assert.equal(tryAcquireExecutionSlot('rule-concurrent'), true);
  assert.equal(tryAcquireExecutionSlot('rule-concurrent'), false);
  releaseExecutionSlot('rule-concurrent');
  assert.equal(tryAcquireExecutionSlot('rule-concurrent'), true);
  releaseExecutionSlot('rule-concurrent');
});

test('automation delivery retries bounded failures and succeeds on a later attempt', async () => {
  let attempts = 0;
  const channel = {
    async send() {
      attempts += 1;
      if (attempts < 3) throw new Error('temporary');
    },
  };
  assert.equal(await deliverWithRetry(channel, { content: 'test' }, 3), true);
  assert.equal(attempts, 3);
});
