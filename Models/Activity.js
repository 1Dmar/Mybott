const { Schema, model } = require("mongoose");

module.exports = model(
  "serveroptions-activity",
  new Schema({
   serverId: { type: String, required: true },
    activities: [
        {
            user: String,
            action: String,
            reason: String,
            timestamp: { type: Date, default: Date.now }
        }
    ]
  })
);


