const mongoose = require('mongoose');
const { Schema } = mongoose;

const statusBarSchema = new Schema({
  serverId: { type: String, required: true, unique: true },
  statusChannelId: String,
  statusMessageId: String,
  updateInterval: { type: Number, default: 5 },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StatusBar', statusBarSchema);
