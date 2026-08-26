const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, default: null, index: true },
  type: { type: String, required: true, maxlength: 64 },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  title: { type: String, required: true, maxlength: 160 },
  message: { type: String, required: true, maxlength: 1500 },
  source: { type: String, required: true, maxlength: 120 },
  action: { type: String, default: null, maxlength: 255 },
  dedupeKey: { type: String, default: null, index: true, maxlength: 180 },
  status: { type: String, enum: ['open', 'resolved', 'snoozed'], default: 'open', index: true },
  readAt: { type: Date, default: null, index: true },
  resolvedAt: { type: Date, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

notificationSchema.index({ guildId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ guildId: 1, dedupeKey: 1, status: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.ProMcBotNotification || mongoose.model('ProMcBotNotification', notificationSchema);
