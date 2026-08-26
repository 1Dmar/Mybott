const crypto = require('crypto');

function hashToken(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function signRequest(secret, timestamp, nonce, body) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}\n${nonce}\n${body}`, 'utf8').digest('hex');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { hashToken, signRequest, safeEqual };
