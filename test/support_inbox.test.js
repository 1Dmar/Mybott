'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseInbound, tokenMatches, getInboxNotificationRecipients, buildInboxNotificationHtml } = require('../bot/utils/supportInboxService');

const source = fs.readFileSync(path.join(__dirname, '..', 'dash', 'index.js'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '..', 'dash', 'dashboard', 'pages', 'admin-inbox.html'), 'utf8');

test('support inbound parser accepts provider sender objects and bounds message data', async () => {
  const parsed = await parseInbound({ from: { email: 'Customer@example.com' }, subject: 'Help', text: 'Hello', 'message-id': '<abc@example.com>' });
  assert.equal(parsed.fromEmail, 'customer@example.com');
  assert.equal(parsed.providerMessageId, '<abc@example.com>');
});

test('support inbound parser accepts Mailgun inbound fields', async () => {
  const parsed = await parseInbound({ sender: 'mailgun-customer@example.com', subject: 'Mailgun help', 'body-plain': 'Please help', 'Message-Id': '<mailgun-1@example.com>', 'In-Reply-To': '<previous@example.com>' });
  assert.equal(parsed.fromEmail, 'mailgun-customer@example.com');
  assert.equal(parsed.text, 'Please help');
  assert.equal(parsed.inReplyTo, '<previous@example.com>');
});

test('support inbound parser preserves image and video attachments', async () => {
  const parsed = await parseInbound({
    from: 'customer@example.com', subject: 'Files', text: 'Please review these.',
    attachments: [
      { filename: 'screenshot.png', contentType: 'image/png', base64: Buffer.from('png-data').toString('base64') },
      { filename: 'clip.mp4', contentType: 'video/mp4', base64: Buffer.from('video-data').toString('base64') },
    ],
  });
  assert.equal(parsed.attachments.length, 2);
  assert.equal(parsed.attachments[0].contentType, 'image/png');
  assert.equal(parsed.attachments[1].contentType, 'video/mp4');
  assert.equal(parsed.attachments[1].data.toString(), 'video-data');
});

test('support inbound parser accepts attachment maps and file buffers', async () => {
  const parsed = await parseInbound({
    from: 'customer@example.com', subject: 'Files', text: 'Attached.',
    attachments: { first: { name: 'photo.jpg', type: 'image/jpeg', content: Buffer.from('jpg-data').toString('base64') } },
    multipartFiles: [{ originalname: 'clip.mp4', mimetype: 'video/mp4', buffer: Buffer.from('mp4-data') }],
  });
  assert.equal(parsed.attachments.length, 2);
  assert.equal(parsed.attachments[0].filename, 'photo.jpg');
  assert.equal(parsed.attachments[1].data.toString(), 'mp4-data');
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

test('support inbox notification recipients are configured separately and normalized', () => {
  assert.deepEqual(getInboxNotificationRecipients({ SUPPORT_INBOX_NOTIFICATION_EMAILS: 'Admin@Example.com, ops@example.com' }), ['admin@example.com', 'ops@example.com']);
  assert.deepEqual(getInboxNotificationRecipients({}), []);
});

test('support inbox notification preview escapes inbound content and links to the inbox', () => {
  const html = buildInboxNotificationHtml({ fromEmail: 'customer@example.com', subject: '<urgent>', text: '<script>alert(1)</script>' }, { PUBLIC_BASE_URL: 'https://promcbot.dev' });
  assert.match(html, /&lt;urgent&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /https:\/\/promcbot\.dev\/admin\/inbox/);
});

test('support inbox routes are protected and replies use the official address', () => {
  assert.match(source, /app\.post\('\/api\/inbound\/support'/);
  assert.match(source, /req\.path === '\/api\/inbound\/support'/);
  assert.match(source, /attachmentCount: result\.attachmentCount/);
  assert.match(source, /app\.get\('\/api\/admin\/support\/conversations'/);
  assert.match(source, /app\.post\('\/api\/admin\/support\/conversations\/:id\/reply', isAuthenticated, requireAdminRole/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'bot', 'utils', 'supportInboxService.js'), 'utf8'), /await notifyNewInboundMessage\(payload\)/);
  assert.match(source, /app\.get\('\/admin\/inbox', isAuthenticated, requireAdmin/);
  assert.match(page, /Reply from support@promcbot\.dev/);
  assert.match(page, /renderAttachments/);
  assert.match(page, /message-body img,.message-body video/);
  assert.match(source, /api\/admin\/support\/attachments/);
});
