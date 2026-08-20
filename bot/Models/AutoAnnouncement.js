// ── Auto-Announcements (promcbot.dev/my-servers/:id/announcements) ──
// Scheduled recurring announcements for Discord servers: events, resets,
// reminders, rules, promotions. Sends to selected channels on a cron-like
// schedule. Every big MC server needs predictable community comms.
const { Schema, model } = require("mongoose");

module.exports = model(
  "auto-announcements1",
  new Schema({
    // Server id
    guildId: { type: String, required: true, index: true },
    // Title shown in dashboard list
    name: { type: String, required: true, maxlength: 120 },
    // Message content (supports {server} {time} {online} placeholders)
    content: { type: String, required: true, maxlength: 2000 },
    // Optional embed-like title
    embedTitle: { type: String, maxlength: 200 },
    // Channel(s) to post into
    channels: [{ type: String, required: true }],
    // Schedule type
    scheduleType: {
      type: String,
      enum: ["daily", "weekly", "custom", "interval"],
      required: true
    },
    // HH:MM time-of-day (daily/weekly)
    time: { type: String, maxlength: 5, default: "18:00" },
    // Day(s) of week for weekly: 0=Sun ... 6=Sat
    weekdays: [{ type: Number, min: 0, max: 6 }],
    // Interval in minutes (scheduleType=custom)
    intervalMin: { type: Number, min: 5, max: 43200 },
    // Enabled
    enabled: { type: Boolean, default: true, index: true },
    // Tracking
    lastSentAt: { type: Date },
    nextRunAt: { type: Date, index: true },
    sendCount: { type: Number, default: 0, min: 0 },
    createdBy: { type: String },
    createdByLabel: { type: String, maxlength: 80 }
  }, { timestamps: true })
);

// Compute nextRunAt from schedule
module.exports.nextRunFrom = (doc, now = Date.now()) => {
  const d = new Date(now);
  const [hh, mm] = (doc.time || '18:00').split(':').map(Number);
  if (doc.scheduleType === 'interval') {
    return new Date(now + (doc.intervalMin || 60) * 60000);
  }
  // Daily / weekly / custom -> next occurrence of hh:mm
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh || 0, mm || 0);
  if (next.getTime() <= now) next.setDate(next.getDate() + 1);
  if (doc.scheduleType === 'weekly' || doc.scheduleType === 'custom') {
    const days = (doc.weekdays || []).slice().sort((a, b) => a - b);
    if (!days.length) { next.setDate(next.getDate() + 1); return next; }
    let attempts = 8;
    while (attempts-- > 0) {
      if (days.includes(next.getDay())) return next;
      next.setDate(next.getDate() + 1);
    }
  }
  return next;
};
