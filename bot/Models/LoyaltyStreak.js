// ── Streak & Loyalty System (promcbot.dev/my-servers/:id/loyalty) ──
// Tracks daily presence streaks of server members and awards loyalty
// points, milestones and ranks. Large MC servers use this to keep their
// community coming back every single day.
const { Schema, model } = require("mongoose");

module.exports = model(
  "loyalty-streaks1",
  new Schema({
    // Server (guild) id
    guildId: { type: String, required: true, index: true },
    // Discord user id
    userId: { type: String, required: true, index: true },
    // Optional display name snapshot
    displayName: { type: String, maxlength: 80 },
    // Current streak: consecutive days with at least one message / activity
    currentStreak: { type: Number, default: 0, min: 0 },
    // Longest streak ever
    bestStreak: { type: Number, default: 0, min: 0 },
    // Total loyalty points earned (points per message + streak bonus)
    points: { type: Number, default: 0, min: 0 },
    // Lifetime activity counters (per server)
    messagesAllTime: { type: Number, default: 0, min: 0 },
    voiceMinutesAllTime: { type: Number, default: 0, min: 0 },
    // Last day (YYYY-MM-DD) the user was active — used to detect breaks
    lastActiveDay: { type: String, maxlength: 10 },
    // Last raw activity timestamp
    lastActivityAt: { type: Date },
    // Joined date in the server (from Discord join)
    joinedAt: { type: Date },
    // Loyalty tier computed from points (bronze/silver/gold/diamond/master)
    tier: {
      type: String,
      enum: ["bronze", "silver", "gold", "diamond", "master"],
      default: "bronze"
    },
    // Milestones claimed: 7/30/100/365 days etc.
    claimedMilestones: [{ days: { type: Number }, claimedAt: { type: Date } }]
  }, { timestamps: true })
);

// Points needed per tier (server owners can tune via settings)
module.exports.TIER_THRESHOLDS = {
  bronze: 0,
  silver: 500,
  gold: 2000,
  diamond: 8000,
  master: 25000
};

// Compute tier from points
module.exports.computeTier = (points) => {
  const t = module.exports.TIER_THRESHOLDS;
  if (points >= t.master) return "master";
  if (points >= t.diamond) return "diamond";
  if (points >= t.gold) return "gold";
  if (points >= t.silver) return "silver";
  return "bronze";
};

// Points awarded per activity type
module.exports.POINT_RULES = {
  message: 2,
  voiceMinute: 1,
  streakBonus: 5, // per streak day beyond 2
  weeklyBonus: 20 // claimed once per week when streak >= 7
};
