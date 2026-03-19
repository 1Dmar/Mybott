// models/Command.js
const mongoose = require('mongoose');

const commandSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  type: { type: String, required: true }, // 'slash' or 'message'
  enabled: { type: Boolean, default: true },
  settings: { type: Object, default: {} },
});

module.exports = mongoose.model('Command', commandSchema);
