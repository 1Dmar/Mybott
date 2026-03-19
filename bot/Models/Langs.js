const { Schema, model } = require("mongoose");

module.exports = model(
  "serveroptions-languagess",
  new Schema({
        guildIds: {
        type: String,
          required: true,
          unique: true
    },

      language: {
        type: String,
          required: true,
    },

  })
);