const test = require('node:test');
const assert = require('node:assert/strict');
const { isPublicCustomApiHost } = require('../bot/utils/playerCardGenerator');

test('player-card custom API rejects loopback, private, link-local, and malformed hosts', async () => {
  for (const host of ['localhost', '127.0.0.1', '10.0.0.5', '192.168.1.20', '169.254.169.254', '[::1]', 'bad host']) {
    assert.equal(await isPublicCustomApiHost(host), false, host);
  }
});

test('player-card custom API accepts a public literal IP without DNS dependency', async () => {
  assert.equal(await isPublicCustomApiHost('203.0.113.10'), true);
});

test('player-card custom API rejects reserved local DNS suffixes', async () => {
  assert.equal(await isPublicCustomApiHost('server.local'), false);
});

// Intentionally no network lookup is asserted here: DNS availability is deployment-specific.
// A public hostname is accepted only after all resolved addresses pass the private-range guard.
