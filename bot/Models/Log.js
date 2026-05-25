const { Schema } = require("mongoose");
const { defineModel } = require("../utils/dbManager");

const logSchema = new Schema({
    serverId: { type: String, required: true },
    logs: [{
        logType: { type: String, required: true },
        logChannelId: { type: String, required: true },
        embedColor: { type: String, default: '#FFFFFF' }
    }]
});

// Logs can be high volume, so we store them in secondary DB
module.exports = defineModel("serveroptions-logs", logSchema, true);
