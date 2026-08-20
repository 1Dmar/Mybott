// ── Live Leaderboards (promcbot.dev/my-servers/:id/leaderboard) ──
// Automatic weekly/monthly/all-time ranking boards for messages, voice,
// kills, playtime and event wins. Big MC servers use leaderboards as the
// main retention engine — everyone wants to be #1.
const { Schema, model } = require("mongoose");

module.exports = model(
  "live-leaderboards1",
  new Schema({
    // Server id
    guildId: { type: String, required: true, index: true },
    // Member id
    userId: { type: String, required: true, index: true },
    // Optional display name snapshot
    displayName: { type: String, maxlength: 80 },
    // Metric (each metric has its own board)
    metric: {
      type: String,
      enum: ["messages", "voice", "kills", "playtime", "events", "streak"],
      required: true,
      index: true
    },
    // Period bucket
    period: {
      type: String,
      enum: ["week", "month", "alltime"],
      required: true,
      index: true
    },
    // Bucket key like "2026-W34" or "2026-08" (alltime uses "all")
    bucket: { type: String, default: "all", index: true },
    // Score for this metric/period/bucket
    score: { type: Number, default: 0, min: 0 }
  }, { timestamps: true })
);

// Week bucket key for a Date
module.exports.weekBucket = (date = new Date()) => {
  const d = new Date(date);
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
};

// Month bucket key
module.exports.monthBucket = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
