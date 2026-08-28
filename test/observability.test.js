const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeOperationId, operationIdForRequest } = require('../dash/observability');

test('operation IDs accept bounded safe correlation values', () => {
  assert.equal(normalizeOperationId('trace-1234'), 'trace-1234');
  assert.equal(normalizeOperationId('x'.repeat(129)), '');
  assert.equal(normalizeOperationId('bad value'), '');
  assert.match(operationIdForRequest('trace-1234'), /^trace-1234$/);
});

test('operation IDs generate a UUID fallback when the request value is unsafe', () => {
  const id = operationIdForRequest('bad value');
  assert.match(id, /^[0-9a-f-]{36}$/);
});
