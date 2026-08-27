'use strict';

const PUBLIC_USERNAME_RE = /^[a-z0-9_.-]{3,32}$/;
const RESERVED_PUBLIC_USERNAMES = new Set(['admin', 'api', 'dashboard', 'profile', 'stats', 'u', 'user', 'premium']);

function normalizePublicUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function validatePublicUsername(value) {
  const username = normalizePublicUsername(value);
  if (!PUBLIC_USERNAME_RE.test(username)) return { ok: false, username, error: 'invalid_public_username', message: 'Username must be 3–32 characters and use only letters, numbers, dots, underscores, or hyphens.' };
  if (RESERVED_PUBLIC_USERNAMES.has(username)) return { ok: false, username, error: 'reserved_public_username', message: 'That public username is reserved.' };
  return { ok: true, username };
}

module.exports = { PUBLIC_USERNAME_RE, normalizePublicUsername, validatePublicUsername };
