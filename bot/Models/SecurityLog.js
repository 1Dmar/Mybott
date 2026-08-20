// ── Security Center (promcbot.dev/my-servers/:id/security) ──
// Raid detection events, anti-nuke stats, ban watchlist and moderation
// health score. Big MC servers get targeted by raids, nukers and raiders
// almost weekly — this gives owners one dashboard for the whole picture.
const { Schema, model } = require("mongoose");

// 1) Security events: raids, mass joins, mass bans, permission abuse...
module.exports.SecurityEvent = model(
  "security-events1",
  new Schema({
    guildId: { type: String, required: true, index: true },
    // Event type
    type: {
      type: String,
      enum: ["raid_detected", "mass_join", "mass_ban", "mass_kick",
             "permission_abuse", "suspicious_bot", "new_join_surge",
             "anti_nuke_action", "watchlist_hit", "manual"],
      required: true,
      index: true
    },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "warning"
    },
    // Who / what triggered it
    actorId: { type: String },
    actorName: { type: String, maxlength: 80 },
    // Detail snapshot
    detail: { type: String, maxlength: 1000 },
    // Numbers attached (joins in window, bans count...)
    count: { type: Number, default: 0, min: 0 },
    // Automatic mitigation applied?
    mitigated: { type: Boolean, default: false },
    mitigationNote: { type: String, maxlength: 300 },
    // Handled by staff?
    resolved: { type: Boolean, default: false },
    resolvedBy: { type: String },
    resolvedAt: { type: Date }
  }, { timestamps: true })
);

// 2) Ban watchlist: users flagged for watch across servers
module.exports.Watchlist = model(
  "ban-watchlist1",
  new Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, maxlength: 80 },
    reason: { type: String, maxlength: 500 },
    // Alert staff when this user joins?
    alertOnJoin: { type: Boolean, default: true },
    // Auto-ban on join? (handled by bot client side)
    autoBan: { type: Boolean, default: false },
    addedBy: { type: String },
    addedByLabel: { type: String, maxlength: 80 },
    expiresAt: { type: Date }
  }, { timestamps: true })
);

// 3) Security score snapshot (computed daily for charts)
module.exports.SecurityScore = model(
  "security-scores1",
  new Schema({
    guildId: { type: String, required: true, index: true },
    day: { type: String, required: true, maxlength: 10, index: true }, // YYYY-MM-DD
    score: { type: Number, min: 0, max: 100, default: 100 },
    raidsToday: { type: Number, default: 0 },
    bansToday: { type: Number, default: 0 },
    newJoinsToday: { type: Number, default: 0 },
    antiNukeActions: { type: Number, default: 0 }
  }, { timestamps: true })
);
