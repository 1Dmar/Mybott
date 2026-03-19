const { Schema, model } = require("mongoose");

module.exports = model(
  "serverinformations-promc",
  new Schema({
    serverId: {
      type: String,
      required: true,
      unique: true,
    },
    serverName: {
      type: String,
    },
    javaIP: {
      type: String,
    },
    javaPort: {
      type: Number,
      default: 25565,
    },
    bedrockIP: {
      type: String,
    },
    bedrockPort: {
      type: Number,
      default: 19132,
    },
    serverType: {
      type: String,
    },
  })
);
