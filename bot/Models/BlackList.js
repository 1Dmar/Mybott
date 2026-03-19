const { Schema, model } = require("mongoose");

module.exports = model(
  "serveroptions-blacklist",
  new Schema({
    guildIds: {
      type: String,
      required: true,
      unique: true
    },
    isBlacklisted: {
      type: String,
      required: false
    },
    reason: {
      type: String,
      required: false
    },
    duration: {
      type: Number,
      required: false
    },
    expiresAt: {
      type: Number,
      required: false
    },
    isPermanent: {
      type: Boolean,
      required: false
    },
  })
);
