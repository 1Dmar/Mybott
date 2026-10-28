'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { configuredEmail, normalizeRecipients, normalizeMessage, DEFAULT_FROM_EMAIL } = require('../bot/utils/emailService');

const routeSource = fs.readFileSync(path.join(__dirname, '..', 'dash', 'index.js'), 'utf8');
const serviceSource = fs.readFileSync(path.join(__dirname, '..', 'bot', 'utils', 'emailService.js'), 'utf8');
const pageSource = fs.readFileSync(path.join(__dirname, '..', 'dash', 'dashboard', 'pages', 'admin-email.html'), 'utf8');

test('email recipients accept multiple bounded addresses and remove duplicates', () => {
  assert.deepEqual(normalizeRecipients('A@example.com, b@example.com; a@example.com'), ['a@example.com', 'b@example.com']);
  assert.throws(() => normalizeRecipients('not-an-email'), /invalid_email_recipient/);
});

test('email sender is always the official support address', () => {
  assert.equal(configuredEmail({ BREVO_API_KEY: 'secret', EMAIL_FROM: 'emadmauche@gmail.com' }).fromEmail, DEFAULT_FROM_EMAIL);
  assert.equal(configuredEmail({}).apiKey, '');
  assert.throws(() => normalizeMessage({ subject: '', html: '<p>x</p>' }), /email_subject_required/);
});

test('admin email route is protected and replies use the support address', () => {
  assert.match(routeSource, /app\.post\('\/api\/email\/send', isAuthenticated, requireAdminRole, emailSendLimiter/);
  assert.match(serviceSource, /replyTo: \{ email: config\.fromEmail/);
  assert.match(pageSource, /id="recipientEmails"/);
  assert.match(pageSource, /support@promcbot\.dev/);
  assert.doesNotMatch(pageSource, /id="senderEmail"/);
});
