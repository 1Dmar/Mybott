// ── Giveaway System (promcbot.dev/my-servers/:id/giveaways) ────────
// Server owners host giveaways on their public page. Players enter with
// their Discord id; a winner is drawn randomly and announced on the page.
// Every giveaway entry also counts as a community-vote (engagement).
const { Schema, model } = require("mongoose");

module.exports = model(
  "mc-giveaways-promc",
  new Schema({
    guildId: { type: String, required: true, index: true },
    // Prize description (e.g. "VIP Rank 30 days")
    prize: { type: String, required: true, maxlength: 120 },
    // Optional extra requirements
    requirements: { type: String, maxlength: 300 },
    // End date
    endsAt: { type: Date, required: true },
    // Entries
    entries: [{
      userId: { type: String, required: true },
      userName: { type: String, maxlength: 40 },
      joinedAt: { type: Date, default: Date.now }
    }],
    // Winner after draw
    winner: { type: Schema.Types.Mixed },
    // State
    status: {
      type: String,
      enum: ["active", "ended"],
      default: "active",
      index: true
    },
    createdAt: { type: Date, default: Date.now }
  })
);
