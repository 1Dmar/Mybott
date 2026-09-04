const mongoose = require('mongoose');
const adminMemberSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true, index: true, match: /^\d{5,25}$/ },
  role: { type: String, enum: ['admin', 'editor'], required: true, default: 'editor' },
  createdBy: { type: String, required: true },
}, { timestamps: true });
module.exports = mongoose.models.ProMcBotAdminMember || mongoose.model('ProMcBotAdminMember', adminMemberSchema);
