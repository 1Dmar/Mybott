const mongoose = require('mongoose');
const { Schema } = mongoose;
const CONFIG = require('../config');
const dailyCountSchema = new Schema({
 serverId: { type: String, required: true, unique: true },
  statusChannelId: String,
  statusMessageId: String,
  updateInterval: { type: Number, default: CONFIG.DEFAULT_UPDATE_INTERVAL }
});
dailyCountSchema.index({ guildId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyCount', dailyCountSchema);
