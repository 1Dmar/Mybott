'use strict';

const crypto = require('crypto');
const SupportConversation = require('../Models/SupportConversation');
const SupportMessage = require('../Models/SupportMessage');
const { sendSupportEmail, normalizeRecipients, DEFAULT_FROM_EMAIL } = require('./emailService');

function clean(value, max) { return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max); }
function email(value) { return clean(value, 254).toLowerCase(); }
function tokenMatches(req) {
  const expected = String(process.env.SUPPORT_INBOUND_TOKEN || '').trim();
  const received = String(req.get('x-support-inbound-token') || req.query?.token || '').trim();
  if (!expected || !received) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}
function parseInbound(body = {}) {
  const fromEmail = email(body.fromEmail || body.from?.email || body.sender?.email || body.from);
  const subject = clean(body.subject || '(No subject)', 200) || '(No subject)';
  const text = clean(body.text || body.textContent || body.body || '', 100000);
  const html = clean(body.html || body.htmlContent || '', 200000);
  const providerMessageId = clean(body.messageId || body['message-id'] || body.providerMessageId || '', 500) || null;
  const inReplyTo = clean(body.inReplyTo || body['in-reply-to'] || '', 500) || null;
  const references = (Array.isArray(body.references) ? body.references : String(body.references || '').split(/\s+/)).map(value => clean(value, 500)).filter(Boolean).slice(0, 20);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) throw new Error('invalid_inbound_sender');
  if (!text && !html) throw new Error('inbound_content_required');
  return { fromEmail, subject, text, html, providerMessageId, inReplyTo, references };
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
  if (!conversation) {
    conversation = await SupportConversation.create({ contactEmail: payload.fromEmail, subject: payload.subject, lastMessageAt: new Date() });
  }
  const message = await SupportMessage.create({ conversationId: conversation._id, direction: 'inbound', fromEmail: payload.fromEmail, toEmails: [DEFAULT_FROM_EMAIL], subject: payload.subject, text: payload.text, html: payload.html, providerMessageId: payload.providerMessageId, inReplyTo: payload.inReplyTo, references: payload.references });
  await SupportConversation.updateOne({ _id: conversation._id }, { $set: { lastMessageAt: message.receivedAt, lastInboundMessageId: payload.providerMessageId }, $inc: { messageCount: 1 } });
  return { duplicate: false, conversationId: conversation._id, messageId: message._id };
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
module.exports = { tokenMatches, parseInbound, storeInbound, replyToConversation };
