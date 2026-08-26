'use strict';

const Notification = require('../Models/Notification');

function sanitize(value, max = 1500) { return String(value || '').slice(0, max); }

async function createNotification({ guildId, userId = null, type, priority = 'medium', title, message, source, action = null, dedupeKey = null, metadata = {} }) {
  const safeDedupeKey = dedupeKey ? sanitize(dedupeKey, 180) : null;
  if (safeDedupeKey) {
    const existing = await Notification.findOne({ guildId, dedupeKey: safeDedupeKey, status: { $ne: 'resolved' }, expiresAt: { $gt: new Date() } }).lean();
    if (existing) return existing;
  }
  return Notification.create({
    guildId,
    userId,
    type: sanitize(type, 64),
    priority,
    title: sanitize(title, 160),
    message: sanitize(message),
    source: sanitize(source, 120),
    action: action ? sanitize(action, 255) : null,
    dedupeKey: safeDedupeKey,
    status: 'open',
    metadata,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  });
}

async function listNotifications(guildId, limit = 50) {
  return Notification.find({ guildId }).sort({ createdAt: -1 }).limit(Math.min(100, Math.max(1, limit))).lean();
}

async function markRead(guildId, notificationId) {
  return Notification.findOneAndUpdate({ _id: notificationId, guildId }, { $set: { readAt: new Date() } }, { new: true }).lean();
}

async function resolveNotification(guildId, notificationId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, guildId },
    { $set: { status: 'resolved', resolvedAt: new Date(), readAt: new Date() } },
    { new: true }
  ).lean();
}

module.exports = { createNotification, listNotifications, markRead, resolveNotification };
