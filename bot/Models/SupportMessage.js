'use strict';
const mongoose = require('mongoose');

const supportMessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProMcBotSupportConversation', required: true, index: true },
  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  fromEmail: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  toEmails: { type: [String], default: [] },
  subject: { type: String, required: true, maxlength: 200 },
  text: { type: String, default: '', maxlength: 100000 },
  html: { type: String, default: '', maxlength: 200000 },
  providerMessageId: { type: String, default: null, maxlength: 500 },
  inReplyTo: { type: String, default: null, maxlength: 500 },
  references: { type: [String], default: [] },
  sentBy: { type: String, default: null, maxlength: 64 },
  receivedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

supportMessageSchema.index({ providerMessageId: 1 }, { unique: true, sparse: true });
supportMessageSchema.index({ conversationId: 1, receivedAt: 1 });
module.exports = mongoose.models.ProMcBotSupportMessage || mongoose.model('ProMcBotSupportMessage', supportMessageSchema);
