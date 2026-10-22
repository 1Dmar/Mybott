const { Schema, model } = require('mongoose');

const schema = new Schema({
  discordUserId: { type: String, required: true, unique: true, index: true },
  primaryIdentityId: { type: Schema.Types.ObjectId, ref: 'MinecraftIdentity', default: null },
  publicEnabled: { type: Boolean, default: true },
  globalPrivacy: {
    showUsername: { type: Boolean, default: true },
    showStats: { type: Boolean, default: true },
    showServers: { type: Boolean, default: false },
    showAchievements: { type: Boolean, default: true },
  },
}, { timestamps: true, versionKey: false });

module.exports = model('PlayerAccount', schema);
