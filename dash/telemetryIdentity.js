'use strict';

const crypto = require('crypto');

function normalizeEventId(value, fallback) {
  const candidate = String(value || '').trim().slice(0, 128);
  return candidate || String(fallback || '').trim().slice(0, 128);
}

function buildTelemetryRequestId(serverId, instanceId, eventId) {
  const scoped = `${String(serverId || '').trim()}:${String(instanceId || '').trim()}:${normalizeEventId(eventId, 'legacy-event')}`;
  return crypto.createHash('sha256').update(scoped, 'utf8').digest('hex');
}

module.exports = { normalizeEventId, buildTelemetryRequestId };
