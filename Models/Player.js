const { Schema, model } = require("mongoose");

module.exports = model(
  "player-card",
  new Schema({
    ign: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },
    uuid: {
      type: String
    },
    serverId: {
      type: String
    },
    cardTemplate: {
      type: String,
      enum: ['darkmode', 'glass'],
      default: 'darkmode'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  })
);
