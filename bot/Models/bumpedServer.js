const { Schema, model } = require("mongoose");

module.exports = model(
  "bumped-server1",
  new Schema({
    guildId: {
      type: String,
      required: true,
      unique: true,
    },
    bumpedAt: {
      type: Date,
      required: true,
    },
    // Optional boost deadline — gives the server a 24h Featured boost
    boostedUntil: { type: Date, default: null },
  })
);
