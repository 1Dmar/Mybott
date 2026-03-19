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

  status: { type: String, default: "online" }, // “online” | “idle” | “dnd” | “invisible”
  })
);
