const { Schema, model } = require("mongoose");

module.exports = model(
  "serveroptions-logs",
  new Schema({
    serverId: { type: String, required: true },
    logs: [{
        logType: { type: String, required: true },
        logChannelId: { type: String, required: true },
        embedColor: { type: String, default: '#FFFFFF' }
    }]
  })
);
