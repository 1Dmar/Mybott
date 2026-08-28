'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getSessionSecret, sanitizeDiscordProfile } = require('../dash/authPolicy');

test('session secret is mandatory in production and deterministic in development', () => {
  assert.equal(getSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: 'configured-secret' }), 'configured-secret');
  assert.throws(() => getSessionSecret({ NODE_ENV: 'production' }), /session_secret_required/);
  assert.equal(getSessionSecret({ NODE_ENV: 'development' }), 'development-only-session-secret');
});

test('Discord profile serialization strips OAuth tokens and bounds guild data', () => {
  const safe = sanitizeDiscordProfile({
    id: '123', username: 'owner', global_name: 'Owner', avatar: 'hash',
    accessToken: 'must-not-survive', refreshToken: 'must-not-survive',
    guilds: [{ id: 'guild-1', name: 'Server', owner: true, permissions: '2147483648', icon: 'icon', banner: 'banner', features: ['BANNER'] }],
  });
  assert.equal(safe.accessToken, undefined);
  assert.equal(safe.refreshToken, undefined);
  assert.deepEqual(safe.guilds[0], { id: 'guild-1', name: 'Server', icon: 'icon', banner: 'banner', owner: true, permissions: '2147483648', features: ['BANNER'] });
});
