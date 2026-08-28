'use strict';

const crypto = require('crypto');

function normalizeOperationId(value) {
  const candidate = String(value || '').trim();
  return candidate.length <= 128 && /^[A-Za-z0-9._:-]{8,128}$/.test(candidate) ? candidate : '';
}

function operationIdForRequest(value) {
  return normalizeOperationId(value) || crypto.randomUUID();
}

module.exports = { normalizeOperationId, operationIdForRequest };
