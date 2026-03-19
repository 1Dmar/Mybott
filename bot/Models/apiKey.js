const { Schema, model } = require("mongoose");

module.exports = model(
  "serveroptions-authCode",
  new Schema({
    guildId: {
      type: String,
      required: true,
      unique: true,
    },
    authCode: {
      type: String,
      required: true,
    },
  })
);
