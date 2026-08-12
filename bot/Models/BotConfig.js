const { Schema, model } = require("mongoose");

module.exports = model(
  "bot",
  new Schema({
    guildId: { type: String, required: true, unique: true },

    nickname: { type: String, default: "" },
    description: { type: String, default: "" },
    premiumTier: { type: Number, default: 0 }, // 0 = free, 1 = Tier1, 2 = Tier2
    assignedRoles: [{ type: String }],
    avatarURL: { type: String, default: "" },
    status: { type: String, default: "online" }, // "online" | "idle" | "dnd" | "invisible"

    // Per-guild module toggles
    modules: {
      autoResponder:    { type: Boolean, default: false },
      welcomeMessages:  { type: Boolean, default: false },
      moderation:       { type: Boolean, default: false },
      logs:             { type: Boolean, default: false },
      tickets:          { type: Boolean, default: false },
      serverStatus:     { type: Boolean, default: false },
    },

    // Welcome message configuration
    welcome: {
      channelId:  { type: String, default: null },
      message:    { type: String, default: "Welcome {user} to {server}! 🎉" },
      embedColor: { type: String, default: "#4070f4" },
      enabled:    { type: Boolean, default: false },
    },

    // Log channel
    logChannelId: { type: String, default: null },

    // Ticket settings
    ticket: {
      channelId:    { type: String, default: null },
      categoryId:   { type: String, default: null },
      staffRoleId:  { type: String, default: null },
      message:      { type: String, default: "Click the button below to open a ticket." },
      enabled:      { type: Boolean, default: false },
    },
  })
);
