'use strict';

const crypto = require('crypto');
const axios = require('axios');
const net = require('net');
const { simpleParser } = require('mailparser');
const SupportConversation = require('../Models/SupportConversation');
const SupportMessage = require('../Models/SupportMessage');
const SupportAttachment = require('../Models/SupportAttachment');
const { sendSupportEmail, normalizeRecipients, DEFAULT_FROM_EMAIL } = require('./emailService');

function clean(value, max) { return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max); }
function email(value) { return clean(value, 254).toLowerCase(); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
// MongoDB's BSON document ceiling is 16MB, so keep each binary attachment
// below that ceiling while accepting Mailgun videos up to 15MB.
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MAX_ATTACHMENTS = 8;
const SAFE_CONTENT_TYPE = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i;

function parseAttachmentList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return parseAttachmentList(parsed); } catch (_) { return []; }
  }
  if (typeof value === 'object') return Object.values(value);
  return [];
}
function attachmentCandidates(body = {}) {
  const candidates = [
    ...parseAttachmentList(body.attachments),
    ...parseAttachmentList(body.attachment),
    ...parseAttachmentList(body.files),
    ...(Array.isArray(body.multipartFiles) ? body.multipartFiles : []),
  ];
  for (const [key, value] of Object.entries(body)) {
    if (!/^attachment(?:[-_]\d+)?$/i.test(key)) continue;
    candidates.push(value && typeof value === 'object' ? value : { name: key, content: value });
  }
  return candidates.slice(0, MAX_ATTACHMENTS);
}
function decodeBase64(value) {
  const text = String(value || '').replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (!text || text.length < 4 || text.length % 4 === 1 || !/^[A-Za-z0-9+/=_-]+$/.test(text)) return null;
  try { const data = Buffer.from(text, 'base64'); return data.length ? data : null; } catch (_) { return null; }
}
function asBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (Array.isArray(value)) return Buffer.from(value);
  if (value && value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data);
  return null;
}
function mailgunStorageUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    const allowed = url.protocol === 'https:' && (url.hostname === 'api.mailgun.net' || url.hostname === 'api.eu.mailgun.net' || /^storage-[a-z0-9-]+\.api\.mailgun\.net$/i.test(url.hostname));
    return allowed ? url.toString() : null;
  } catch (_) { return null; }
}
function storageDetails(body = {}) {
  const storage = body.storage && typeof body.storage === 'object' ? body.storage : {};
  const storageUrlValue = storage.url || body['storage.url'];
  const urls = Array.isArray(storageUrlValue) ? storageUrlValue : [storageUrlValue, body.storageUrl, body['message-url']];
  const url = urls.map(mailgunStorageUrl).find(Boolean) || null;
  const key = clean(storage.key || body['storage.key'] || body.storageKey || '', 500) || null;
  return { url, key };
}
function storageUrlFromKey(key, env = process.env) {
  const domain = String(env.MAILGUN_DOMAIN || '').trim();
  const region = String(env.MAILGUN_REGION || 'us').trim().toLowerCase();
  if (!domain || !key || !/^[a-z0-9.-]+$/i.test(domain) || !/^[a-z0-9_-]+$/i.test(key)) return null;
  const host = region === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net';
  return `https://${host}/v3/domains/${encodeURIComponent(domain)}/messages/${encodeURIComponent(key)}`;
}
function safeAttachmentUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    const hostname = url.hostname.toLowerCase();
    const ip = net.isIP(hostname);
    const privateIpv4 = ip === 4 && (/^(10|127)\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) || hostname === '169.254.169.254');
    const blockedHost = hostname === 'localhost' || hostname === 'metadata.google.internal' || hostname.endsWith('.local');
    return url.protocol === 'https:' && !privateIpv4 && !blockedHost ? url : null;
  } catch (_) { return null; }
}
async function loadAttachmentData(item) {
  const direct = [item.buffer, item.data, item.contentBytes].map(asBuffer).find(Boolean);
  if (direct) return direct;
  const encoded = item.base64 || item.contentBytes || (typeof item.content === 'string' && /^data:[^;]+;base64,|^[A-Za-z0-9+/=_-]{8,}$/.test(item.content) ? item.content : null);
  const decoded = decodeBase64(encoded);
  if (decoded) return decoded;
  const remote = safeAttachmentUrl(item.url || item.downloadUrl || item.download_url || item.attachmentUrl || item.fileUrl || item.href || (typeof item.content === 'string' && /^https:\/\//i.test(item.content) ? item.content : null));
  if (!remote) return null;
  try {
    const response = await axios.get(remote.toString(), { responseType: 'arraybuffer', timeout: 15000, maxContentLength: MAX_ATTACHMENT_BYTES, maxBodyLength: MAX_ATTACHMENT_BYTES, validateStatus: status => status >= 200 && status < 300 });
    return Buffer.from(response.data);
  } catch (_) { return null; }
}
async function normalizeAttachments(body = {}) {
  const items = await Promise.all(attachmentCandidates(body).map(async (item, index) => {
    const filename = clean(item.originalname || item.originalFilename || item.filename || item.name || item.fileName || `attachment-${index + 1}`, 255).replace(/[\\/]/g, '_') || `attachment-${index + 1}`;
    const contentType = clean(item.mimetype || item.contentType || item.mimeType || item.type || item.headers?.['content-type'] || 'application/octet-stream', 120).toLowerCase();
    const data = await loadAttachmentData(item);
    if (!data || !data.length || data.length > MAX_ATTACHMENT_BYTES || !SAFE_CONTENT_TYPE.test(contentType)) return null;
    return { filename, contentType, size: data.length, data };
  }));
  return items.filter(Boolean);
}
function getInboxNotificationRecipients(env = process.env) {
  const configured = String(env.SUPPORT_INBOX_NOTIFICATION_EMAILS || env.SUPPORT_INBOX_NOTIFICATION_EMAIL || '').trim();
  return configured ? normalizeRecipients(configured) : [];
}
function buildInboxNotificationHtml(payload, env = process.env) {
  const preview = clean(payload.text || String(payload.html || '').replace(/<[^>]*>/g, ' '), 4000);
  const baseUrl = String(env.PUBLIC_BASE_URL || 'https://promcbot.dev').replace(/\/$/, '');
  const attachmentNote = payload.attachments?.length ? `<p><strong>Attachments:</strong> ${payload.attachments.length} file(s) saved in the Support Inbox.</p>` : '';
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#202945"><h2>New ProMcBot support message</h2><p><strong>From:</strong> ${escapeHtml(payload.fromEmail)}</p><p><strong>Subject:</strong> ${escapeHtml(payload.subject)}</p>${attachmentNote}<hr><p style="white-space:pre-wrap">${escapeHtml(preview)}</p><p><a href="${escapeHtml(baseUrl)}/admin/inbox">Open Support Inbox</a></p></div>`;
}
async function notifyNewInboundMessage(payload, env = process.env) {
  const recipients = getInboxNotificationRecipients(env);
  if (!recipients.length) return { sent: false, reason: 'notification_recipient_not_configured' };
  try {
    const result = await sendSupportEmail({ recipients, subject: `[ProMcBot] New support message: ${payload.subject}`, html: buildInboxNotificationHtml(payload, env) }, env);
    return { sent: true, messageId: result.messageId || null, recipients: result.recipients };
  } catch (error) {
    console.error('[support inbox] notification delivery failed:', error.response?.data || error.message);
    return { sent: false, reason: 'notification_delivery_failed' };
  }
}
function tokenMatches(req) {
  const expected = String(process.env.SUPPORT_INBOUND_TOKEN || '').trim();
  const received = String(req.get('x-support-inbound-token') || req.query?.token || '').trim();
  if (!expected || !received) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}
async function parseInbound(body = {}) {
  const fromEmail = email(body.fromEmail || body.from?.email || body.sender?.email || body.sender || body.from);
  const subject = clean(body.subject || '(No subject)', 200) || '(No subject)';
  const text = clean(body.text || body.textContent || body['body-plain'] || body.body || '', 100000);
  const html = clean(body.html || body.htmlContent || body['body-html'] || '', 200000);
  const providerMessageId = clean(body.messageId || body['message-id'] || body['Message-Id'] || body.providerMessageId || '', 500) || null;
  const inReplyTo = clean(body.inReplyTo || body['in-reply-to'] || body['In-Reply-To'] || '', 500) || null;
  const references = (Array.isArray(body.references) ? body.references : String(body.references || body.References || '').split(/\s+/)).map(value => clean(value, 500)).filter(Boolean).slice(0, 20);
  const attachments = await normalizeAttachments(body);
  const storage = storageDetails(body);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) throw new Error('invalid_inbound_sender');
  if (!text && !html && !attachments.length) throw new Error('inbound_content_required');
  return { fromEmail, subject, text, html, providerMessageId, inReplyTo, references, attachments, mailgunStorageUrl: storage.url, mailgunStorageKey: storage.key };
}
async function storeInbound(payload) {
  if (payload.providerMessageId) {
    const duplicate = await SupportMessage.findOne({ providerMessageId: payload.providerMessageId }).select('conversationId').lean();
    if (duplicate) return { duplicate: true, conversationId: duplicate.conversationId };
  }
  let conversation = null;
  if (payload.inReplyTo) {
    const previous = await SupportMessage.findOne({ providerMessageId: payload.inReplyTo }).select('conversationId').lean();
    if (previous) conversation = await SupportConversation.findById(previous.conversationId);
  }
  if (!conversation) conversation = await SupportConversation.create({ contactEmail: payload.fromEmail, subject: payload.subject, lastMessageAt: new Date() });
  const message = await SupportMessage.create({ conversationId: conversation._id, direction: 'inbound', fromEmail: payload.fromEmail, toEmails: [DEFAULT_FROM_EMAIL], subject: payload.subject, text: payload.text, html: payload.html, providerMessageId: payload.providerMessageId, mailgunStorageUrl: payload.mailgunStorageUrl, mailgunStorageKey: payload.mailgunStorageKey, inReplyTo: payload.inReplyTo, references: payload.references });
  if (payload.attachments?.length) await SupportAttachment.insertMany(payload.attachments.map(attachment => ({ ...attachment, messageId: message._id })));
  await SupportConversation.updateOne({ _id: conversation._id }, { $set: { lastMessageAt: message.receivedAt, lastInboundMessageId: payload.providerMessageId }, $inc: { messageCount: 1 } });
  await notifyNewInboundMessage(payload);
  return { duplicate: false, conversationId: conversation._id, messageId: message._id, attachmentCount: payload.attachments?.length || 0 };
}
async function restoreMailgunAttachments(messageId, env = process.env) {
  const message = await SupportMessage.findById(messageId);
  if (!message) throw new Error('support_message_not_found');
  const apiKey = String(env.MAILGUN_API_KEY || '').trim();
  if (!apiKey) throw new Error('mailgun_api_key_not_configured');
  const url = mailgunStorageUrl(message.mailgunStorageUrl) || storageUrlFromKey(message.mailgunStorageKey, env);
  if (!url) throw new Error('mailgun_storage_reference_missing');
  const response = await axios.get(url, { auth: { username: 'api', password: apiKey }, headers: { Accept: 'message/rfc2822, application/json;q=0.9' }, timeout: 20000, maxContentLength: 16 * 1024 * 1024, maxBodyLength: 16 * 1024 * 1024 });
  const data = response.data || {};
  const mime = typeof data === 'string' ? data : Buffer.isBuffer(data) ? data.toString() : data['body-mime'] || data['Body-mime'] || data.bodyMime || data.mime;
  if (!mime) throw new Error('mailgun_stored_message_mime_missing');
  const parsed = await simpleParser(mime);
  const attachments = parsed.attachments || [];
  if (!attachments.length) return { restored: 0, messageId: message._id };
  const existing = await SupportAttachment.find({ messageId: message._id }).select('filename size').lean();
  const seen = new Set(existing.map(item => `${item.filename}:${item.size}`));
  const docs = attachments.map(item => ({ filename: clean(item.filename || 'attachment', 255).replace(/[\\/]/g, '_'), contentType: clean(item.contentType || 'application/octet-stream', 120).toLowerCase(), size: item.size || item.content?.length || 0, data: item.content })).filter(item => item.data?.length && item.size <= MAX_ATTACHMENT_BYTES && SAFE_CONTENT_TYPE.test(item.contentType) && !seen.has(`${item.filename}:${item.size}`)).slice(0, MAX_ATTACHMENTS);
  if (docs.length) await SupportAttachment.insertMany(docs.map(item => ({ ...item, messageId: message._id })));
  if (!message.text && parsed.text) message.text = clean(parsed.text, 100000);
  if (!message.html && parsed.html) message.html = clean(parsed.html, 200000);
  await message.save();
  return { restored: docs.length, messageId: message._id };
}

async function replyToConversation(conversationId, body, adminId) {
  const conversation = await SupportConversation.findById(conversationId);
  if (!conversation) throw new Error('support_conversation_not_found');
  const html = clean(body.html, 200000);
  const text = clean(body.text || '', 100000);
  const subject = clean(body.subject || `Re: ${conversation.subject}`, 200);
  if (!html && !text) throw new Error('reply_content_required');
  const last = await SupportMessage.findOne({ conversationId }).sort({ receivedAt: -1 }).lean();
  const content = html || `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`;
  const sent = await sendSupportEmail({ recipients: normalizeRecipients([conversation.contactEmail]), subject, html: content, inReplyTo: last?.providerMessageId || null, references: [...(last?.references || []), ...(last?.providerMessageId ? [last.providerMessageId] : [])] });
  const message = await SupportMessage.create({ conversationId, direction: 'outbound', fromEmail: DEFAULT_FROM_EMAIL, toEmails: [conversation.contactEmail], subject, html: content, text, providerMessageId: sent.messageId, inReplyTo: last?.providerMessageId || null, references: sent.messageId ? [sent.messageId] : [], sentBy: String(adminId || ''), receivedAt: new Date() });
  await SupportConversation.updateOne({ _id: conversationId }, { $set: { lastMessageAt: message.receivedAt, status: 'open' }, $inc: { messageCount: 1 } });
  return { messageId: message._id, providerMessageId: sent.messageId };
}
module.exports = { tokenMatches, parseInbound, normalizeAttachments, storeInbound, restoreMailgunAttachments, replyToConversation, getInboxNotificationRecipients, buildInboxNotificationHtml, notifyNewInboundMessage };
