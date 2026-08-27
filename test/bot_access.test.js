'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { botAccessDecision, botAccessPayload, buildBotInviteUrl, getBotMembership, resolveBotMembership } = require('../dash/botAccess');

test('bot membership distinguishes installed, absent, and unavailable states', () => {
  const installedClient = { guilds: { cache: new Map([['guild-1', {}]]) } };
  assert.deepEqual(getBotMembership(installedClient, 'guild-1'), { state: 'installed', installed: true });
  assert.deepEqual(getBotMembership(installedClient, 'guild-2'), { state: 'absent', installed: false });
  assert.deepEqual(getBotMembership(null, 'guild-1'), { state: 'unknown', installed: false });
});

test('Discord fetch resolves a guild that is installed but not in cache', async () => {
  const fetched = { id: 'guild-2', name: 'Fetched Guild' };
  const client = { guilds: { cache: new Map(), fetch: async id => id === 'guild-2' ? fetched : null } };
  const result = await resolveBotMembership(client, 'guild-2');
  assert.equal(result.state, 'installed');
  assert.equal(result.guild, fetched);
});

test('Discord fetch maps unknown guild to absent and transient errors to unknown', async () => {
  const absent = { guilds: { cache: new Map(), fetch: async () => { const error = new Error('unknown guild'); error.code = 10004; throw error; } } };
  const transient = { guilds: { cache: new Map(), fetch: async () => { const error = new Error('rate limited'); error.status = 429; throw error; } } };
  assert.equal((await resolveBotMembership(absent, 'guild-2')).state, 'absent');
  assert.equal((await resolveBotMembership(transient, 'guild-2')).state, 'unknown');
});

test('bot access decision allows only an installed bot and gives actionable statuses', () => {
  assert.deepEqual(botAccessDecision({ state: 'installed' }), { allow: true, status: 200, error: null });
  assert.deepEqual(botAccessDecision({ state: 'absent' }), { allow: false, status: 409, error: 'bot_not_in_server' });
  assert.deepEqual(botAccessDecision({ state: 'unknown' }), { allow: false, status: 503, error: 'bot_membership_unavailable' });
});

test('invite URL contains only Discord application OAuth parameters', () => {
  const invite = buildBotInviteUrl('123456789012345678');
  const url = new URL(invite);
  assert.equal(url.origin, 'https://discord.com');
  assert.equal(url.pathname, '/oauth2/authorize');
  assert.equal(url.searchParams.get('client_id'), '123456789012345678');
  assert.equal(url.searchParams.get('scope'), 'bot applications.commands');
  assert.equal(url.searchParams.get('permissions'), '0');
});

test('listing payload never labels a missing bot as an installed workspace', () => {
  const payload = botAccessPayload({ id: 'guild-2', name: 'Test 2' }, { state: 'absent', installed: false }, 'https://discord.com/oauth2/authorize?client_id=1');
  assert.equal(payload.botInstalled, false);
  assert.equal(payload.botStatus, 'absent');
  assert.match(payload.inviteUrl, /^https:\/\/discord\.com\/oauth2\/authorize/);
});
