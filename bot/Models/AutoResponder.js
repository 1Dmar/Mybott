const { Schema, model } = require("mongoose");

module.exports = model(
  "serveroptions-auto_responder",
  new Schema({
     guildId: {
        type: String,
          required: true,
    },
        trigger: {
        type: String,
          required: true,
    },
        response: {
        type: String,
          required: true,
    },
        replyType: {
        type: String,
          required: true,
    },
        allowedRoles: {
        type: [String],
default: []
        },
        disallowedRoles: {
        type: [String],
default: []
        },
        date: {
        type: Date,
default: Date.now
        },

  })
);

