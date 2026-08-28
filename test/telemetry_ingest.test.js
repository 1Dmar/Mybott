const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_EVENTS,
  buildTelemetryDocuments,
  buildTelemetryBulkOperations,
  summarizeTelemetryWrite,
} = require('../dash/telemetryIngest');

test('telemetry documents are bounded, scoped, and safe to upsert', () => {
  const docs = buildTelemetryDocuments([
    {
      eventId: 'event-1',
      type: 'player_count',
      occurredAt: '2026-08-28T00:00:00Z',
      data: { onlinePlayers: 4, long: 'x'.repeat(700), nested: { ignored: true } },
    },
  ], { serverId: 'guild-1', instanceId: 'instance-1', nonce: 'nonce-1', now: Date.parse('2026-08-28T01:00:00Z') });
  assert.equal(docs.length, 1);
  assert.equal(docs[0].serverId, 'guild-1');
  assert.equal(docs[0].instanceId, 'instance-1');
  assert.match(docs[0].requestId, /^[a-f0-9]{64}$/);
  assert.equal(docs[0].data.long.length, 512);
  assert.equal(typeof docs[0].data.nested, 'string');
  const operations = buildTelemetryBulkOperations(docs);
  assert.deepEqual(operations[0].updateOne.filter, { requestId: docs[0].requestId });
  assert.equal(operations[0].updateOne.upsert, true);
  assert.deepEqual(Object.keys(operations[0].updateOne.update), ['$setOnInsert']);
});

test('telemetry input is capped and invalid timestamps fail closed', () => {
  const docs = buildTelemetryDocuments(Array.from({ length: MAX_EVENTS + 5 }, (_, index) => ({ eventId: `e-${index}` })), {
    serverId: 'guild-1', instanceId: 'instance-1', nonce: 'nonce', now: Date.now(),
  });
  assert.equal(docs.length, MAX_EVENTS);
  assert.throws(() => buildTelemetryDocuments([{ occurredAt: 'not-a-date' }], {
    serverId: 'guild-1', instanceId: 'instance-1', nonce: 'nonce', now: Date.now(),
  }), /invalid_occurredAt/);
});

test('telemetry write summary distinguishes accepted upserts from retries', () => {
  assert.deepEqual(summarizeTelemetryWrite({ upsertedCount: 2 }, 5), { accepted: 2, duplicates: 3 });
  assert.deepEqual(summarizeTelemetryWrite({ upsertedCount: 0 }, 5), { accepted: 0, duplicates: 5 });
});
