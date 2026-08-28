'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPublicBaseUrl } = require('../dash/urlPolicy');

function request(protocol, host) {
  return { protocol, get(name) { return name.toLowerCase() === 'host' ? host : ''; } };
}

test('production provisioning requires configured HTTPS public URL', () => {
  assert.equal(buildPublicBaseUrl(request('https', 'spoofed.example'), { NODE_ENV: 'production', PUBLIC_BASE_URL: 'https://promcbot.dev' }), 'https://promcbot.dev');
  assert.throws(() => buildPublicBaseUrl(request('https', 'spoofed.example'), { NODE_ENV: 'production' }), /public_base_url_not_configured/);
});

test('configured public URL rejects non-HTTPS external origins', () => {
  assert.throws(() => buildPublicBaseUrl(request('https', 'promcbot.dev'), { NODE_ENV: 'production', PUBLIC_BASE_URL: 'http://promcbot.dev' }), /public_base_url_must_use_https/);
});

test('development may use a validated local request host', () => {
  assert.equal(buildPublicBaseUrl(request('http', 'localhost:3000'), { NODE_ENV: 'development' }), 'http://localhost:3000');
  assert.throws(() => buildPublicBaseUrl(request('http', 'bad host'), { NODE_ENV: 'development' }), /request_host_invalid/);
});
