const { Schema, model } = require('mongoose');

const networkRoleSchema = new Schema({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, trim: true },
  role: { type: String, enum: ['owner', 'network_admin', 'server_manager', 'moderator', 'editor', 'viewer'], required: true },
  serverIds: { type: [String], default: [] },
  createdBy: { type: String, required: true },
}, { timestamps: true, versionKey: false });
networkRoleSchema.index({ guildId: 1, userId: 1 }, { unique: true });
module.exports = model('ProMcBotNetworkRole', networkRoleSchema);
