// Server voting system — lets community members vote for their favorite Minecraft servers.
// Each user (discordId) can vote once per server per 12 hours.
const mongoose = require('mongoose');

const ServerVoteSchema = new mongoose.Schema({
  guildId:   { type: String, required: true, index: true },
  voterId:   { type: String, required: true }, // discord user id
  voterName: { type: String, default: '' },
}, { timestamps: true });

// One vote per user per server per 12h window
ServerVoteSchema.index({ guildId: 1, voterId: 1, createdAt: 1 });

module.exports = mongoose.model('ServerVote', ServerVoteSchema, 'server-votes-promc');
