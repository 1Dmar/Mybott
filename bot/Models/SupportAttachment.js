'use strict';
const mongoose = require('mongoose');

const supportAttachmentSchema = new mongoose.Schema({
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProMcBotSupportMessage', required: true, index: true },
  filename: { type: String, required: true, maxlength: 255 },
  contentType: { type: String, required: true, maxlength: 120 },
  size: { type: Number, required: true, min: 0, max: 12 * 1024 * 1024 },
  data: { type: Buffer, required: true },
}, { timestamps: true });

supportAttachmentSchema.index({ messageId: 1, createdAt: 1 });
module.exports = mongoose.models.ProMcBotSupportAttachment || mongoose.model('ProMcBotSupportAttachment', supportAttachmentSchema);
