'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTelemetryRequestId, normalizeEventId } = require('../dash/telemetryIdentity');

test('telemetry request id is deterministic for the same scoped event', () => {
  const first = buildTelemetryRequestId('guild-1', 'instance-1', 'event-1');
  const retry = buildTelemetryRequestId('guild-1', 'instance-1', 'event-1');
  assert.equal(first, retry);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('telemetry request id is scoped to server and instance', () => {
  const event = buildTelemetryRequestId('guild-1', 'instance-1', 'event-1');
  assert.notEqual(event, buildTelemetryRequestId('guild-2', 'instance-1', 'event-1'));
  assert.notEqual(event, buildTelemetryRequestId('guild-1', 'instance-2', 'event-1'));
  assert.notEqual(event, buildTelemetryRequestId('guild-1', 'instance-1', 'event-2'));
});

test('empty event ids use a bounded fallback', () => {
  assert.equal(normalizeEventId('', 'fallback'), 'fallback');
  assert.equal(normalizeEventId('  event-1  ', 'fallback'), 'event-1');
  assert.equal(normalizeEventId('x'.repeat(200), 'fallback').length, 128);
});
