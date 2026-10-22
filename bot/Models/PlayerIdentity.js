const { Schema, model } = require('mongoose');

const schema = new Schema({
  discordUserId: { type: String, required: true, index: true },
  serverId: { type: String, required: true, index: true },
  uuid: { type: String, required: true, trim: true },
  username: { type: String, required: true, trim: true, maxlength: 32 },
  linkedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  privacy: {
    showUsername: { type: Boolean, default: true },
    showStats: { type: Boolean, default: true },
    showServer: { type: Boolean, default: false },
  },
}, { timestamps: true, versionKey: false });

schema.index({ serverId: 1, uuid: 1 }, { unique: true });
schema.index({ discordUserId: 1, serverId: 1 });
module.exports = model('PlayerIdentity', schema);
