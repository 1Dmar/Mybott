const { Schema, model } = require("mongoose");

module.exports = model(
  "callback-userlogin",
  new Schema({
    discordId: { type: String, required: true, unique: true },

    username: String,

    email: String,

    lastLogin: { type: Date, default: Date.now }
  })
);
