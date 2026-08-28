'use strict';

const crypto = require('crypto');

function legacySecret() {
  return String(process.env.LEGACY_PREMIUM_CODE_SECRET || '').trim();
}

function generatePremiumKey(port, daysValid) {
  const secret = legacySecret();
  if (!secret) throw new Error('legacy_premium_codes_disabled');
  const expiresAt = Date.now() + (daysValid * 24 * 60 * 60 * 1000);
  const payload = `${expiresAt}:${port}`;
  const b64Payload = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${b64Payload}.${signature}`;
}

function verifyPremiumKey(key, expectedPort) {
  const secret = legacySecret();
  if (!secret || !key || typeof key !== 'string') return false;
  const parts = key.split('.');
  if (parts.length !== 2) return false;
  const [b64Payload, signature] = parts;
  let payload;
  try { payload = Buffer.from(b64Payload, 'base64url').toString('utf8'); } catch (_) { return false; }
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (signature !== expectedSignature) return false;
  const payloadParts = payload.split(':');
  if (payloadParts.length !== 2) return false;
  const expiresAt = parseInt(payloadParts[0], 10);
  const port = parseInt(payloadParts[1], 10);
  if (!Number.isFinite(expiresAt) || !Number.isFinite(port) || Date.now() > expiresAt) return false;
  if (expectedPort && parseInt(expectedPort, 10) !== port) return false;
  return { valid: true, expiresAt, port };
}

module.exports = { generatePremiumKey, verifyPremiumKey };
