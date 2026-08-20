// ── Server Events System (promcbot.dev/my-servers/:id/events) ──────
// Every server can host Minecraft events: PvP tournaments, build battles,
// parkour races, quiz nights... with categories, registered players and
// a winners podium that renders a luxurious Canvas card.
const { Schema, model } = require("mongoose");

const EventParticipantSchema = new Schema({
  // Minecraft username (or any display name)
  name: { type: String, required: true, maxlength: 40 },
  // Optional Minecraft UUID / head lookup helper
  uuid: { type: String },
  // Discord user id if linked
  discordId: { type: String },
  // Placement after the event ends: 1 = champion, 2, 3, or final rank
  rank: { type: Number, min: 1 },
  // Podium card stats (PixelMC-style leaderboard)
  elo: { type: Number, min: 0, max: 9999 },
  division: { type: String, maxlength: 40 },
  statWins: { type: Number, min: 0 },
  statLosses: { type: Number, min: 0 },
  statKills: { type: Number, min: 0 },
  statDeaths: { type: Number, min: 0 },
  statStreak: { type: Number, min: 0 }
});

module.exports = model(
  "mc-events-promc",
  new Schema({
    guildId: { type: String, required: true, index: true },
    // Event metadata
    title: { type: String, required: true, maxlength: 120 },
    description: { type: String, maxlength: 500 },
    // Event category — controls icons, colors and bracket style
    category: {
      type: String,
      enum: ["pvp", "build", "parkour", "quiz", "spleef", "speedrun", "minigame", "other"],
      default: "pvp"
    },
    // When it happens
    scheduledAt: { type: Date },
    // Event state machine
    status: {
      type: String,
      enum: ["upcoming", "live", "finished"],
      default: "upcoming",
      index: true
    },
    // Registered players
    participants: [EventParticipantSchema],
    // Winners — podium order [1st, 2nd, 3rd]
    winners: [EventParticipantSchema],
    // Map/mode details shown on the page
    mapName: { type: String },
    maxParticipants: { type: Number },
    // Custom theme accent (any hex)
    accent: { type: String },
    // Event reminder (sent 1h before the event starts)
    reminderEnabled: { type: Boolean, default: false },
    reminderSent: { type: Boolean, default: false },
    createdBy: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  })
);
