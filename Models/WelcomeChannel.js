const { Schema, model } = require("mongoose");

module.exports = model(
  "serveroptions-welcome",
  new Schema({
    guildId: {
      type: String,
      required: true,
      unique: true,
    },
    channelId: {
      type: String,
      required: true,
    },
  })
);
