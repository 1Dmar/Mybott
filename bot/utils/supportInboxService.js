'use strict';

const crypto = require('crypto');
const axios = require('axios');
const net = require('net');
const SupportConversation = require('../Models/SupportConversation');
const SupportMessage = require('../Models/SupportMessage');
const SupportAttachment = require('../Models/SupportAttachment');
const { sendSupportEmail, normalizeRecipients, DEFAULT_FROM_EMAIL } = require('./emailService');

function clean(value, max) { return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max); }
function email(value) { return clean(value, 254).toLowerCase(); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;
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
  const direct = [item.buffer, item.data, item.contentBytes].find(value => Buffer.isBuffer(value));
  if (direct) return direct;
  const encoded = item.base64 || (typeof item.content === 'string' && /^data:[^;]+;base64,|^[A-Za-z0-9+/=_-]{8,}$/.test(item.content) ? item.content : null);
  const decoded = decodeBase64(encoded);
  if (decoded) return decoded;
  const remote = safeAttachmentUrl(item.url || item.downloadUrl || item.download_url || item.attachmentUrl);
  if (!remote) return null;
  try {
    const response = await axios.get(remote.toString(), { responseType: 'arraybuffer', timeout: 15000, maxContentLength: MAX_ATTACHMENT_BYTES, maxBodyLength: MAX_ATTACHMENT_BYTES, validateStatus: status => status >= 200 && status < 300 });
    return Buffer.from(response.data);
  } catch (_) { return null; }
}
async function normalizeAttachments(body = {}) {
  const items = await Promise.all(attachmentCandidates(body).map(async (item, index) => {
    const filename = clean(item.originalname || item.filename || item.name || `attachment-${index + 1}`, 255).replace(/[\\/]/g, '_') || `attachment-${index + 1}`;
    const contentType = clean(item.mimetype || item.contentType || item.type || 'application/octet-stream', 120).toLowerCase();
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) throw new Error('invalid_inbound_sender');
  if (!text && !html && !attachments.length) throw new Error('inbound_content_required');
  return { fromEmail, subject, text, html, providerMessageId, inReplyTo, references, attachments };
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
  const message = await SupportMessage.create({ conversationId: conversation._id, direction: 'inbound', fromEmail: payload.fromEmail, toEmails: [DEFAULT_FROM_EMAIL], subject: payload.subject, text: payload.text, html: payload.html, providerMessageId: payload.providerMessageId, inReplyTo: payload.inReplyTo, references: payload.references });
  if (payload.attachments?.length) await SupportAttachment.insertMany(payload.attachments.map(attachment => ({ ...attachment, messageId: message._id })));
  await SupportConversation.updateOne({ _id: conversation._id }, { $set: { lastMessageAt: message.receivedAt, lastInboundMessageId: payload.providerMessageId }, $inc: { messageCount: 1 } });
  await notifyNewInboundMessage(payload);
  return { duplicate: false, conversationId: conversation._id, messageId: message._id, attachmentCount: payload.attachments?.length || 0 };
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
module.exports = { tokenMatches, parseInbound, normalizeAttachments, storeInbound, replyToConversation, getInboxNotificationRecipients, buildInboxNotificationHtml, notifyNewInboundMessage };
