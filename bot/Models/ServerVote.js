'use strict';

const mongoose = require('mongoose');

const serverVoteSchema = new mongoose.Schema({
  guildId: { type: String, required: true, match: /^\d{5,25}$/ },
  voterId: { type: String, required: true, match: /^\d{5,25}$/ },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

serverVoteSchema.index({ guildId: 1, voterId: 1 }, { unique: true });
serverVoteSchema.index({ guildId: 1, createdAt: -1 });

module.exports = mongoose.models.ProMcBotServerVote || mongoose.model('ProMcBotServerVote', serverVoteSchema);
