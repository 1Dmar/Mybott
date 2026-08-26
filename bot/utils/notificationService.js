const Notification = require('../Models/Notification');

function sanitize(value, max = 1500) { return String(value || '').slice(0, max); }

async function createNotification({ guildId, userId = null, type, priority = 'medium', title, message, source, action = null, metadata = {} }) {
  return Notification.create({ guildId, userId, type: sanitize(type, 64), priority, title: sanitize(title, 160), message: sanitize(message), source: sanitize(source, 120), action: action ? sanitize(action, 255) : null, metadata, expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) });
}

async function listNotifications(guildId, limit = 50) {
  return Notification.find({ guildId }).sort({ createdAt: -1 }).limit(Math.min(100, Math.max(1, limit))).lean();
}

async function markRead(guildId, notificationId) {
  return Notification.findOneAndUpdate({ _id: notificationId, guildId }, { $set: { readAt: new Date() } }, { new: true }).lean();
}

module.exports = { createNotification, listNotifications, markRead };
