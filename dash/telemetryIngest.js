'use strict';

const { buildTelemetryRequestId } = require('./telemetryIdentity');

const MAX_EVENTS = 250;
const MAX_DATA_KEYS = 32;
const MAX_KEY_LENGTH = 64;
const MAX_VALUE_LENGTH = 512;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

function safeTelemetryData(data) {
  const source = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  return Object.fromEntries(Object.entries(source).slice(0, MAX_DATA_KEYS).map(([key, value]) => [
    String(key).slice(0, MAX_KEY_LENGTH),
    typeof value === 'string'
      ? value.slice(0, MAX_VALUE_LENGTH)
      : (typeof value === 'number' || typeof value === 'boolean' ? value : String(value).slice(0, MAX_VALUE_LENGTH)),
  ]));
}

function buildTelemetryDocuments(incoming, { serverId, instanceId, nonce, now = Date.now() } = {}) {
  if (!Array.isArray(incoming)) return [];
  return incoming.slice(0, MAX_EVENTS).map((event, index) => {
    const occurredAt = new Date(event?.occurredAt || now);
    if (Number.isNaN(occurredAt.getTime())) throw new Error('invalid_occurredAt');
    const eventId = String(event?.eventId || `${nonce || 'legacy-request'}:${index}`).slice(0, 128);
    return {
      serverId,
      instanceId,
      type: String(event?.type || 'unknown').slice(0, 64),
      occurredAt,
      receivedAt: new Date(now),
      requestId: buildTelemetryRequestId(serverId, instanceId, eventId),
      data: safeTelemetryData(event?.data),
      expiresAt: new Date(now + RETENTION_MS),
    };
  });
}

function buildTelemetryBulkOperations(documents) {
  return documents.map(document => ({
    updateOne: {
      filter: { requestId: document.requestId },
      update: { $setOnInsert: document },
      upsert: true,
    },
  }));
}

function summarizeTelemetryWrite(writeResult, total) {
  const accepted = Number(writeResult?.upsertedCount || 0);
  return { accepted, duplicates: Math.max(0, Number(total || 0) - accepted) };
}

module.exports = { MAX_EVENTS, MAX_DATA_KEYS, MAX_KEY_LENGTH, MAX_VALUE_LENGTH, buildTelemetryDocuments, buildTelemetryBulkOperations, safeTelemetryData, summarizeTelemetryWrite };
