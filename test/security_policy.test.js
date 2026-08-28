'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedCorsOrigin, isSameOriginMutation } = require('../dash/securityPolicy');

const env = {
  PUBLIC_BASE_URL: 'https://promcbot.dev',
  PUBLIC_STATS_URL: 'https://stats.promcbot.dev',
};

function request(method, headers = {}) {
  return {
    method,
    protocol: 'https',
    get(name) {
      return headers[String(name).toLowerCase()] || '';
    },
  };
}

test('CORS allows configured public origins and rejects unknown origins', () => {
  assert.equal(isAllowedCorsOrigin(undefined, env), true);
  assert.equal(isAllowedCorsOrigin('https://promcbot.dev', env), true);
  assert.equal(isAllowedCorsOrigin('https://stats.promcbot.dev', env), true);
  assert.equal(isAllowedCorsOrigin('https://attacker.example', env), false);
});

test('mutations allow same-origin and configured dashboard origins', () => {
  assert.equal(isSameOriginMutation(request('POST', { origin: 'https://promcbot.dev', host: 'promcbot.dev' }), env), true);
  assert.equal(isSameOriginMutation(request('PATCH', { origin: 'https://stats.promcbot.dev', host: 'promcbot.dev' }), env), true);
  assert.equal(isSameOriginMutation(request('GET', { origin: 'https://attacker.example', host: 'promcbot.dev' }), env), true);
});

test('mutations reject an unconfigured cross-origin browser request', () => {
  assert.equal(isSameOriginMutation(request('POST', { origin: 'https://attacker.example', host: 'promcbot.dev' }), env), false);
  assert.equal(isSameOriginMutation(request('DELETE', { referer: 'https://attacker.example/page', host: 'promcbot.dev' }), env), false);
  assert.equal(isSameOriginMutation(request('POST', { host: 'promcbot.dev' }), env), true);
});
