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
  })
);
