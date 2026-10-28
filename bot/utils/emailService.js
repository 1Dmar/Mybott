'use strict';

const axios = require('axios');

const DEFAULT_FROM_EMAIL = 'support@promcbot.dev';
const DEFAULT_FROM_NAME = 'ProMcBot Support';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function configuredEmail(env = process.env) {
  return {
    apiKey: String(env.BREVO_API_KEY || '').trim(),
    fromEmail: DEFAULT_FROM_EMAIL,
    fromName: String(env.EMAIL_FROM_NAME || DEFAULT_FROM_NAME).trim().slice(0, 120),
  };
}

function normalizeRecipients(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/);
  const recipients = [...new Set(values.map(item => String(item || '').trim().toLowerCase()).filter(Boolean))];
  if (!recipients.length) throw new Error('email_recipient_required');
  if (recipients.length > 50) throw new Error('email_recipient_limit_exceeded');
  if (recipients.some(email => !EMAIL_PATTERN.test(email) || email.length > 254)) throw new Error('invalid_email_recipient');
  return recipients;
}

function normalizeMessage(body = {}) {
  const subject = String(body.subject || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
  const html = String(body.html || '').trim().slice(0, 200000);
  if (!subject) throw new Error('email_subject_required');
  if (!html) throw new Error('email_content_required');
  return { subject, html };
}

async function sendSupportEmail({ recipients, subject, html, inReplyTo = null, references = [] }, env = process.env) {
  const config = configuredEmail(env);
  if (!config.apiKey) throw new Error('email_provider_not_configured');
  if (!EMAIL_PATTERN.test(config.fromEmail)) throw new Error('email_sender_not_configured');
  const to = normalizeRecipients(recipients).map(email => ({ email }));
  const message = normalizeMessage({ subject, html });
  const headers = {};
  if (inReplyTo) headers['In-Reply-To'] = String(inReplyTo).slice(0, 500);
  if (Array.isArray(references) && references.length) headers.References = references.map(value => String(value).slice(0, 500)).join(' ').slice(0, 2000);
  const response = await axios.post('https://api.brevo.com/v3/smtp/email', {
    sender: { email: config.fromEmail, name: config.fromName },
    replyTo: { email: config.fromEmail, name: config.fromName },
    to,
    subject: message.subject,
    htmlContent: message.html,
    ...(Object.keys(headers).length ? { headers } : {}),
  }, {
    headers: { accept: 'application/json', 'api-key': config.apiKey, 'content-type': 'application/json' },
    timeout: 15000,
  });
  return { messageId: response.data?.messageId || null, recipients: to.map(item => item.email), from: config.fromEmail };
}

module.exports = { configuredEmail, normalizeRecipients, normalizeMessage, sendSupportEmail, DEFAULT_FROM_EMAIL, DEFAULT_FROM_NAME };
