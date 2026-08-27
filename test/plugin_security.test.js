'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const PluginCredential = require('../bot/Models/PluginCredential');
const PluginNonce = require('../bot/Models/PluginNonce');
const {
  MAX_BODY_BYTES,
  encryptSecret,
  decryptSecret,
  hashToken,
  signRequest,
  authenticatePluginRequest,
} = require('../bot/utils/pluginSecurity');

function request(headers) {
  const values = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return { get(name) { return values[String(name).toLowerCase()] || ''; } };
}

function signedHeaders({ token, secret, serverId = 'guild-1', instanceId = 'primary', timestamp = Math.floor(Date.now() / 1000), nonce = 'nonce-1', version = '1', body = '{}' }) {
  return {
    authorization: `Bearer ${token}`,
    'x-promcbot-server': serverId,
    'x-promcbot-instance': instanceId,
    'x-promcbot-timestamp': timestamp,
    'x-promcbot-nonce': nonce,
    'x-promcbot-signature': signRequest(secret, timestamp, nonce, body),
    'x-promcbot-version': version,
  };
}

test('plugin secret encryption round-trips without storing plaintext', () => {
  const previous = process.env.PLUGIN_ENCRYPTION_KEY;
  process.env.PLUGIN_ENCRYPTION_KEY = 'deterministic-test-key';
  const encrypted = encryptSecret('signing-secret');
  assert.notEqual(encrypted, 'signing-secret');
  assert.equal(decryptSecret(encrypted), 'signing-secret');
  if (previous === undefined) delete process.env.PLUGIN_ENCRYPTION_KEY;
  else process.env.PLUGIN_ENCRYPTION_KEY = previous;
});

test('plugin authentication rejects malformed headers and oversized payloads before database access', async () => {
  const malformed = await authenticatePluginRequest(request({}), Buffer.from('{}'));
  assert.deepEqual(malformed, { ok: false, status: 401, error: 'invalid_plugin_headers' });
  const oversized = await authenticatePluginRequest(request(signedHeaders({ token: 'token', secret: 'secret' })), Buffer.alloc(MAX_BODY_BYTES + 1));
  assert.deepEqual(oversized, { ok: false, status: 413, error: 'payload_too_large' });
});

test('plugin authentication validates bearer hash, signature, and duplicate nonce', async () => {
  const previous = process.env.PLUGIN_ENCRYPTION_KEY;
  process.env.PLUGIN_ENCRYPTION_KEY = 'deterministic-test-key';
  const token = 'access-token';
  const secret = 'signing-secret';
  const credential = { serverId: 'guild-1', instanceId: 'primary', accessTokenHash: hashToken(token), encryptedSigningSecret: encryptSecret(secret) };
  const originalFindOne = PluginCredential.findOne;
  const originalCreate = PluginNonce.create;
  let nonceCreates = 0;
  PluginCredential.findOne = () => ({ lean: async () => credential });
  PluginNonce.create = async () => { nonceCreates += 1; if (nonceCreates > 1) { const error = new Error('duplicate'); error.code = 11000; throw error; } return { ok: true }; };
  try {
    const body = '{"events":[]}';
    const valid = await authenticatePluginRequest(request(signedHeaders({ token, secret, body })), body);
    assert.equal(valid.ok, true);
    assert.equal(valid.serverId, 'guild-1');
    const invalidSignature = await authenticatePluginRequest(request({ ...signedHeaders({ token, secret, body }), 'x-promcbot-signature': 'not-valid' }), body);
    assert.deepEqual(invalidSignature, { ok: false, status: 403, error: 'invalid_signature' });
    const replay = await authenticatePluginRequest(request(signedHeaders({ token, secret, body, nonce: 'nonce-2' })), body);
    assert.deepEqual(replay, { ok: false, status: 409, error: 'replayed_request' });
    const invalidBearer = await authenticatePluginRequest(request(signedHeaders({ token: 'wrong-token', secret, body, nonce: 'nonce-3' })), body);
    assert.deepEqual(invalidBearer, { ok: false, status: 403, error: 'plugin_not_provisioned' });
  } finally {
    PluginCredential.findOne = originalFindOne;
    PluginNonce.create = originalCreate;
    if (previous === undefined) delete process.env.PLUGIN_ENCRYPTION_KEY;
    else process.env.PLUGIN_ENCRYPTION_KEY = previous;
  }
});
