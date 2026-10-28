'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseInbound, tokenMatches } = require('../bot/utils/supportInboxService');

const source = fs.readFileSync(path.join(__dirname, '..', 'dash', 'index.js'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '..', 'dash', 'dashboard', 'pages', 'admin-inbox.html'), 'utf8');

test('support inbound parser accepts provider sender objects and bounds message data', () => {
  const parsed = parseInbound({ from: { email: 'Customer@example.com' }, subject: 'Help', text: 'Hello', 'message-id': '<abc@example.com>' });
  assert.equal(parsed.fromEmail, 'customer@example.com');
  assert.equal(parsed.providerMessageId, '<abc@example.com>');
});

test('support inbound webhook requires a timing-safe configured token', () => {
  const previous = process.env.SUPPORT_INBOUND_TOKEN;
  process.env.SUPPORT_INBOUND_TOKEN = 'secret-token';
  const req = { query: {}, get: name => name === 'x-support-inbound-token' ? 'secret-token' : '' };
  assert.equal(tokenMatches(req), true);
  assert.equal(tokenMatches({ query: {}, get: () => 'wrong' }), false);
  if (previous === undefined) delete process.env.SUPPORT_INBOUND_TOKEN;
  else process.env.SUPPORT_INBOUND_TOKEN = previous;
});

test('support inbox routes are protected and replies use the official address', () => {
  assert.match(source, /app\.post\('\/api\/inbound\/support'/);
  assert.match(source, /app\.get\('\/api\/admin\/support\/conversations'/);
  assert.match(source, /app\.post\('\/api\/admin\/support\/conversations\/:id\/reply', isAuthenticated, requireAdminRole/);
  assert.match(source, /app\.get\('\/admin\/inbox', isAuthenticated, requireAdmin/);
  assert.match(page, /Reply from support@promcbot\.dev/);
});
