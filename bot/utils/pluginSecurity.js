const crypto = require('crypto');
const PluginCredential = require('../Models/PluginCredential');
const PluginNonce = require('../Models/PluginNonce');
const { hashToken, signRequest, safeEqual } = require('./pluginCrypto');

const REPLAY_WINDOW_SECONDS = 300;
const MAX_BODY_BYTES = 512 * 1024;
const MAX_HEADER_BYTES = 256;
const ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
const NONCE_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const VERSION_PATTERN = /^[A-Za-z0-9._-]{1,32}$/;

function encryptionKey() {
  const raw = process.env.PLUGIN_ENCRYPTION_KEY || '';
  if (!raw) throw new Error('PLUGIN_ENCRYPTION_KEY is required');
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

function decryptSecret(value) {
  const [ivText, tagText, dataText] = String(value || '').split('.');
  if (!ivText || !tagText || !dataText) throw new Error('Invalid encrypted secret');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64url')), decipher.final()]).toString('utf8');
}

function validateTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && Math.abs(Math.floor(Date.now() / 1000) - timestamp) <= REPLAY_WINDOW_SECONDS;
}

async function authenticatePluginRequest(req, rawBody) {
  const auth = String(req.get('authorization') || '');
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const serverId = String(req.get('x-promcbot-server') || '');
  const instanceId = String(req.get('x-promcbot-instance') || '');
  const timestamp = String(req.get('x-promcbot-timestamp') || '');
  const nonce = String(req.get('x-promcbot-nonce') || '');
  const signature = String(req.get('x-promcbot-signature') || '');
  const protocolVersion = String(req.get('x-promcbot-version') || '');
  const headerLengthsValid = [accessToken, serverId, instanceId, timestamp, nonce, signature, protocolVersion].every(value => value.length <= MAX_HEADER_BYTES);
  const formatValid = ID_PATTERN.test(serverId) && ID_PATTERN.test(instanceId) && NONCE_PATTERN.test(nonce) && SIGNATURE_PATTERN.test(signature) && VERSION_PATTERN.test(protocolVersion);
  if (!accessToken || !serverId || !instanceId || !nonce || !signature || !protocolVersion || !headerLengthsValid || !formatValid || !validateTimestamp(timestamp)) {
    return { ok: false, status: 401, error: 'invalid_plugin_headers' };
  }
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8');
  if (body.length > MAX_BODY_BYTES) return { ok: false, status: 413, error: 'payload_too_large' };
  const credential = await PluginCredential.findOne({ serverId, instanceId, revokedAt: null }).lean();
  if (!credential || !safeEqual(hashToken(accessToken), credential.accessTokenHash)) {
    return { ok: false, status: 403, error: 'plugin_not_provisioned' };
  }
  const secret = decryptSecret(credential.encryptedSigningSecret);
  const expected = signRequest(secret, timestamp, nonce, body.toString('utf8'));
  if (!safeEqual(signature, expected)) return { ok: false, status: 403, error: 'invalid_signature' };
  try {
    await PluginNonce.create({ nonce, serverId, instanceId, expiresAt: new Date(Date.now() + REPLAY_WINDOW_SECONDS * 1000) });
  } catch (error) {
    if (error && error.code === 11000) return { ok: false, status: 409, error: 'replayed_request' };
    throw error;
  }
  return { ok: true, serverId, instanceId, protocolVersion, credential };
}

module.exports = {
  REPLAY_WINDOW_SECONDS,
  MAX_BODY_BYTES,
  MAX_HEADER_BYTES,
  encryptSecret,
  decryptSecret,
  hashToken,
  signRequest,
  authenticatePluginRequest,
};
