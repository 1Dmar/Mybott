const { Schema, model } = require("mongoose");

module.exports = model(
  "serveroptions-mentions",
  new Schema({
      guildId: {
        type: String,
          required: true,
          unique: true
    },

      mention: {
        type: String,
          required: true,
    },

  })
);
