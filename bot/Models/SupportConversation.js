'use strict';
const mongoose = require('mongoose');

const supportConversationSchema = new mongoose.Schema({
  contactEmail: { type: String, required: true, lowercase: true, trim: true, maxlength: 254, index: true },
  contactName: { type: String, default: '', maxlength: 160 },
  subject: { type: String, required: true, maxlength: 200 },
  status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  lastInboundMessageId: { type: String, default: null, maxlength: 500 },
  messageCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

supportConversationSchema.index({ status: 1, lastMessageAt: -1 });
module.exports = mongoose.models.ProMcBotSupportConversation || mongoose.model('ProMcBotSupportConversation', supportConversationSchema);
