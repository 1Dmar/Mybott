// ── In-app dashboard notification helper (no Discord sending) ──────
// Use from anywhere: dash routes, bot events, guildCreate, etc.

const Notification = require('../Models/Notification');

/** Create one dashboard notification for a specific user. */
function notifyUser(recipientId, { type = 'info', title = '', message = '', createdByLabel = 'System', actionUrl, actionLabel, expiresInMs } = {}) {
  return Notification.create({
    recipientId, type, title, message, createdByLabel, actionUrl, actionLabel,
    expiresAt: expiresInMs ? new Date(Date.now() + expiresInMs) : undefined
  }).catch(() => null);
}

/**
 * Create a notification but avoid spam: if an identical personal notification
 * (same recipientId + title) was already created within the last DEBOUNCE_MIN
 * minutes, refresh its timestamp/message instead of creating a duplicate.
 */
const DEBOUNCE_MIN = 15;
async function notifyUserOnce(recipientId, { type = 'info', title = '', message = '', createdByLabel = 'System', actionUrl, actionLabel, expiresInMs, debounceMin = DEBOUNCE_MIN } = {}) {
  try {
    const cutoff = new Date(Date.now() - debounceMin * 60 * 1000);
    const existing = await Notification.findOne({
      recipientId,
      title,
      createdAt: { $gte: cutoff }
    }).sort({ createdAt: -1 }).lean();
    const update = { message, type, createdByLabel };
    if (actionUrl) update.actionUrl = actionUrl;
    if (actionLabel) update.actionLabel = actionLabel;
    if (existing) {
      await Notification.findByIdAndUpdate(existing._id, { $set: update, read: false, createdAt: new Date() });
      return { deduped: true, id: existing._id };
    }
    const doc = await Notification.create({
      recipientId, type, title, message, createdByLabel, actionUrl, actionLabel,
      expiresAt: expiresInMs ? new Date(Date.now() + expiresInMs) : undefined
    });
    return { deduped: false, id: doc?._id };
  } catch (_) {
    return null;
  }
}

/** Announcement visible to every logged-in user. */
function notifyEveryone({ type = 'info', title = '', message = '', createdByLabel = 'System', actionUrl, actionLabel, forAdmin = false, expiresInMs } = {}) {
  return Notification.create({
    recipientId: null, forAdmin, type, title, message, createdByLabel, actionUrl, actionLabel,
    expiresAt: expiresInMs ? new Date(Date.now() + expiresInMs) : undefined
  }).catch(() => null);
}

/** Send notification(s) to a user + global announcements (helper used by API + events). */
async function createNotification(data = {}) {
  const { recipientId, forAdmin = false, systemEvent, type = 'info', title = '', message = '', createdByLabel = 'System', actionUrl, actionLabel } = data;
  // Individual
  if (recipientId) {
    await notifyUser(recipientId, { type, title, message, createdByLabel, actionUrl, actionLabel });
  }
  // Global announcement
  await notifyEveryone({ forAdmin, type, title, message, createdByLabel, actionUrl, actionLabel });
  return true;
}

/** Inbox for a logged-in user: personal unread + everyone + (admins: forAdmin). */
async function getInbox(userId, { isAdmin = false, limit = 50 } = {}) {
  const filters = [
    { recipientId: userId },
    { recipientId: null, forAdmin: false }
  ];
  if (isAdmin) filters.push({ recipientId: null, forAdmin: true });
  const docs = await Notification.find({ $or: filters })
    .sort({ pinned: -1, createdAt: -1 })
    .limit(limit)
    .lean();
  const unread = docs.filter(d => !d.read).length;
  return { notifications: docs, unread };
}

/** Mark one notification read (user must own it or it's global). */
async function markRead(notificationId, userId) {
  const doc = await Notification.findById(notificationId).lean();
  if (!doc) return false;
  if (doc.recipientId && doc.recipientId !== userId) return false;
  await Notification.findByIdAndUpdate(notificationId, { read: true });
  return true;
}

/** Mark all of a user's inbox read. */
async function markAllRead(userId) {
  await Notification.updateMany({ $or: [{ recipientId: userId }, { recipientId: null, forAdmin: false }] }, { read: true });
  return true;
}

/** Clear expired / very old notifications (keep last 30 days). */
async function cleanupNotifications() {
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const expired = await Notification.find({
    $or: [
      { expiresAt: { $lte: new Date() } },
      { createdAt: { $lte: cutoff }, read: true }
    ]
  }).select('_id');
  if (expired.length) await Notification.deleteMany({ _id: { $in: expired.map(d => d._id) } });
  return expired.length;
}

module.exports = { notifyUser, notifyUserOnce, notifyEveryone, createNotification, getInbox, markRead, markAllRead, cleanupNotifications };
